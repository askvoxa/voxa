import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import MercadoPagoConfig, { PaymentRefund } from 'mercadopago'
import { sendExpirationNotification, sendUrgencyReminder } from '@/lib/email'
import { timingSafeEqual } from 'crypto'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  const cronSecret = process.env.CRON_SECRET
  // Previne bypass quando ambos são undefined e usa comparação timing-safe
  if (!cronSecret || !secret || secret.length !== cronSecret.length
      || !timingSafeEqual(Buffer.from(secret), Buffer.from(cronSecret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const refundsEnabled = process.env.FEATURE_REFUNDS_ENABLED === 'true'
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Se refunds/process está ativo, pular expiração aqui (evita duplicação de emails)
  // Apenas enviar nudges de urgência ao criador
  if (refundsEnabled) {
    await sendUrgencyNudges(supabase)
    return NextResponse.json({ ok: true, expired: 0, skipped: 'refunds/process handles expiration' })
  }

  // Buscar deadline padrão da plataforma
  const { data: platformSettings } = await supabase
    .from('platform_settings')
    .select('response_deadline_hours')
    .eq('id', 1)
    .single()
  const defaultDeadlineHours = platformSettings?.response_deadline_hours ?? 36

  // 1. Buscar perguntas pendentes com deadline do criador (custom_deadline_hours) ou padrão da plataforma
  const { data: expired, error: fetchError } = await supabase
    .from('questions')
    .select('id, creator_id, price_paid, sender_email, sender_name, created_at, profiles!inner(username, custom_deadline_hours), transactions(mp_payment_id, amount)')
    .eq('status', 'pending')
    .eq('is_support_only', false)

  // Filtrar no app-level respeitando deadline customizado de cada criador
  const now = Date.now()
  const expiredFiltered = (expired ?? []).filter(q => {
    const profile = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles
    const deadlineHours = (profile as any)?.custom_deadline_hours ?? defaultDeadlineHours
    const cutoff = now - deadlineHours * 60 * 60 * 1000
    return new Date(q.created_at).getTime() < cutoff
  })

  if (fetchError) {
    console.error('[cron/expire-questions] erro ao buscar expiradas:', fetchError)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (expiredFiltered.length === 0) {
    // Ainda precisa enviar nudges mesmo sem expiradas
    await sendUrgencyNudges(supabase)
    return NextResponse.json({ ok: true, expired: 0 })
  }

  const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
  const refundClient = new PaymentRefund(mp)
  let refunded = 0
  let failed = 0

  for (const q of expiredFiltered) {
    try {
      // Guard .eq('status', 'pending') previne race condition TOCTOU (criador pode ter respondido)
      const { data: updated } = await supabase
        .from('questions')
        .update({ status: 'expired' })
        .eq('id', q.id)
        .eq('status', 'pending')
        .select('id')

      if (!updated || updated.length === 0) continue // Já foi processada por outro caminho

      const tx = Array.isArray(q.transactions) ? q.transactions[0] : q.transactions

      if (tx?.mp_payment_id) {
        try {
          await refundClient.create({
            payment_id: String(tx.mp_payment_id),
            body: { amount: tx.amount }, // Refund explícito (consistente com refunds/process)
          })
          refunded++
        } catch (refundErr: any) {
          // 423 = reembolso já submetido anteriormente — não é falha
          if (refundErr?.status === 423 || refundErr?.error === 'resource_already_locked') {
            console.warn(`[cron/expire-questions] reembolso já existia para ${q.id} — ignorando`)
            refunded++
          } else {
            throw refundErr // propaga outros erros para o catch externo
          }
        }
      }

      // Notificar o fã que a pergunta expirou (fire-and-forget)
      if (q.sender_email) {
        const profile = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles
        sendExpirationNotification({
          fanEmail: q.sender_email,
          fanName: q.sender_name ?? 'Fã',
          creatorUsername: profile?.username ?? '',
          amount: q.price_paid ?? 0,
        }).catch((e) => console.error('[cron/expire-questions] erro ao notificar fã:', e))
      }
    } catch (err) {
      console.error(`[cron/expire-questions] falha em ${q.id}:`, err)
      failed++
    }
  }

  // 2. Disparar nudges de urgência ao criador para perguntas próximas de expirar
  await sendUrgencyNudges(supabase)

  return NextResponse.json({ ok: true, expired: expiredFiltered.length, refunded, failed })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendUrgencyNudges(supabase: SupabaseClient<any, any, any>) {
  // Thresholds: enviar nudge quando restar X horas para expirar
  // Janela de ±30min para evitar reenvio entre rodadas do cron (executa a cada 30min)
  const deadlineHours = parseInt(process.env.RESPONSE_DEADLINE_HOURS || '36')
  const thresholds = [
    { hoursUntilExpiry: 6,  hoursElapsed: deadlineHours - 6 },
    { hoursUntilExpiry: 12, hoursElapsed: deadlineHours - 12 },
    { hoursUntilExpiry: 24, hoursElapsed: deadlineHours - 24 },
  ].filter(t => t.hoursElapsed > 0)

  for (const { hoursUntilExpiry, hoursElapsed } of thresholds) {
    const windowStart = new Date(Date.now() - (hoursElapsed + 0.5) * 60 * 60 * 1000).toISOString()
    const windowEnd   = new Date(Date.now() - hoursElapsed * 60 * 60 * 1000).toISOString()

    const { data: questions } = await supabase
      .from('questions')
      .select('id, creator_id, profiles!inner(username)')
      .eq('status', 'pending')
      .eq('is_support_only', false)
      .gte('created_at', windowStart)
      .lt('created_at', windowEnd)

    if (!questions || questions.length === 0) continue

    // Agrupar por criador
    const byCreator = new Map<string, { username: string; count: number }>()
    for (const q of questions) {
      const profile = Array.isArray(q.profiles) ? q.profiles[0] : q.profiles
      const username = profile?.username ?? ''
      const existing = byCreator.get(q.creator_id)
      byCreator.set(q.creator_id, {
        username,
        count: (existing?.count ?? 0) + 1,
      })
    }

    // Buscar email do criador via auth.users e enviar nudge
    for (const [creatorId, { username, count }] of byCreator.entries()) {
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(creatorId)
        const email = userData?.user?.email
        if (email) {
          await sendUrgencyReminder({
            creatorEmail: email,
            creatorUsername: username,
            pendingCount: count,
            hoursUntilExpiry,
          })
        }
      } catch (e) {
        console.error(`[cron/nudge] falha ao notificar ${creatorId}:`, e)
      }
    }

    console.log(`[cron/nudge ${hoursUntilExpiry}h restantes] ${questions.length} perguntas, ${byCreator.size} criadores notificados`)
  }
}
