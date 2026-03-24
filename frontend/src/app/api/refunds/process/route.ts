import { NextResponse } from 'next/server'
import MercadoPagoConfig, { PaymentRefund } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'
// Deadline dinâmico: busca da platform_settings (não mais constante hardcoded)
import { sendExpirationNotification, sendRefundConfirmation } from '@/lib/email'

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/refunds/process
 *
 * Pipeline completo de expiração e reembolso:
 *   1. Expira perguntas pendentes > 36h → enfileira reembolso + email de expiração
 *   2. Processa fila de reembolsos no Mercado Pago → email de confirmação
 *
 * Deve ser chamado por um cron job a cada 30 minutos.
 * Autenticação via header Authorization: Bearer {REFUND_SECRET}
 *
 * No Render.com: configurar Cron Job com:
 *   Schedule: 0,30 * * * * (a cada 30 min)
 *   Command: curl -s -H "Authorization: Bearer {REFUND_SECRET}" "{APP_URL}/api/refunds/process"
 */
export async function GET(request: Request) {
  // Feature flag — desabilitado enquanto não houver cron configurado
  if (process.env.FEATURE_REFUNDS_ENABLED !== 'true') {
    return NextResponse.json({ disabled: true, message: 'Reembolsos automáticos desabilitados' })
  }

  // Autenticação via header (evita vazamento do secret em logs de proxy/CDN)
  const authHeader = request.headers.get('authorization')
  const secret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  const refundSecret = process.env.REFUND_SECRET
  if (!refundSecret || !secret) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  // Comparação timing-safe para evitar timing attacks
  const secretsMatch = secret.length === refundSecret.length &&
    timingSafeEqual(Buffer.from(secret), Buffer.from(refundSecret))
  if (!secretsMatch) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // ── Etapa 1: Expirar perguntas pendentes que ultrapassaram o prazo ──

  // Buscar deadline padrão da plataforma (consistente com expire-questions cron)
  const { data: platformSettings } = await supabaseAdmin
    .from('platform_settings')
    .select('response_deadline_hours')
    .eq('id', 1)
    .single()
  const defaultDeadlineHours = platformSettings?.response_deadline_hours ?? 36

  // Buscar perguntas pendentes com deadline do criador
  const { data: allPending, error: expireError } = await supabaseAdmin
    .from('questions')
    .select('id, sender_name, sender_email, creator_id, created_at, profiles!inner(custom_deadline_hours)')
    .eq('status', 'pending')
    .eq('is_support_only', false) // Apoios nunca expiram (já são 'answered')
    .limit(50)

  // Filtrar respeitando deadline customizado de cada criador
  const now = Date.now()
  const expiredQuestions = (allPending ?? []).filter(q => {
    const profile = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles
    const deadlineHours = (profile as any)?.custom_deadline_hours ?? defaultDeadlineHours
    const cutoff = now - deadlineHours * 60 * 60 * 1000
    return new Date(q.created_at).getTime() < cutoff
  })

  let expired = 0

  if (expireError) {
    console.error('[refunds] Erro ao buscar perguntas expiradas:', expireError)
  } else if (expiredQuestions.length > 0) {
    for (const question of expiredQuestions) {
      // Guard TOCTOU: só expirar se ainda estiver pending (criador pode ter respondido)
      const { data: updated } = await supabaseAdmin
        .from('questions')
        .update({ status: 'expired' })
        .eq('id', question.id)
        .eq('status', 'pending')
        .select('id')

      if (!updated || updated.length === 0) continue // Já processada por outro caminho

      // Buscar transação associada para enfileirar reembolso
      const { data: transaction } = await supabaseAdmin
        .from('transactions')
        .select('mp_payment_id, amount')
        .eq('question_id', question.id)
        .single()

      if (transaction?.mp_payment_id) {
        await supabaseAdmin.from('refund_queue').insert({
          question_id: question.id,
          mp_payment_id: transaction.mp_payment_id,
          amount: transaction.amount,
        })
      }

      // Email de expiração (fire-and-forget)
      if (question.sender_email) {
        const { data: creator } = await supabaseAdmin
          .from('profiles')
          .select('username')
          .eq('id', question.creator_id)
          .single()

        if (creator) {
          sendExpirationNotification({
            fanEmail: question.sender_email,
            fanName: question.sender_name ?? 'Fã',
            creatorUsername: creator.username,
            amount: transaction?.amount ?? 0,
          }).catch(err => console.error('[email] Erro ao notificar expiração:', err))
        }
      }

      expired++
    }
  }

  // ── Etapa 2: Processar fila de reembolsos pendentes no Mercado Pago ──

  const { data: pending, error: fetchError } = await supabaseAdmin
    .from('refund_queue')
    .select('id, question_id, mp_payment_id, amount')
    .eq('status', 'pending')
    .limit(20)

  if (fetchError) {
    console.error('[refunds] Erro ao buscar fila:', fetchError)
    return NextResponse.json({ expired, refunded: 0, failed: 0, error: 'Erro ao buscar fila' }, { status: 500 })
  }

  const refundClient = new PaymentRefund(mp)
  let refunded = 0
  let failed = 0

  if (pending && pending.length > 0) {
    for (const item of pending) {
      try {
        await refundClient.create({
          payment_id: item.mp_payment_id,
          body: { amount: item.amount },
        })

        await supabaseAdmin
          .from('refund_queue')
          .update({ status: 'processed', processed_at: new Date().toISOString() })
          .eq('id', item.id)

        // Email de confirmação de reembolso (fire-and-forget)
        const { data: questionData } = await supabaseAdmin
          .from('questions')
          .select('sender_email, sender_name, creator_id')
          .eq('id', item.question_id)
          .single()

        if (questionData?.sender_email) {
          const { data: creator } = await supabaseAdmin
            .from('profiles')
            .select('username')
            .eq('id', questionData.creator_id)
            .single()

          if (creator) {
            sendRefundConfirmation({
              fanEmail: questionData.sender_email,
              fanName: questionData.sender_name ?? 'Fã',
              creatorUsername: creator.username,
              amount: item.amount ?? 0,
            }).catch(err => console.error('[email] Erro ao confirmar reembolso:', err))
          }
        }

        refunded++
      } catch (err: any) {
        console.error(`[refunds] Falha ao reembolsar ${item.mp_payment_id}:`, err?.message)
        await supabaseAdmin
          .from('refund_queue')
          .update({ status: 'failed', processed_at: new Date().toISOString() })
          .eq('id', item.id)
        failed++
      }
    }
  }

  return NextResponse.json({ expired, refunded, failed })
}
