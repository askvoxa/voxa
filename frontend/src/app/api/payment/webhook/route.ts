import { NextResponse } from 'next/server'
import MercadoPagoConfig, { Payment, PaymentRefund } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { sendNewQuestionNotification } from '@/lib/email'

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Verifica a assinatura HMAC do webhook do Mercado Pago.
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *
 * Formato do manifest: id:{data.id};request-id:{x-request-id};ts:{ts};
 * Onde data.id é o payment ID enviado como query param pelo MP.
 *
 * Se MP_WEBHOOK_SECRET não estiver configurado, retorna null para indicar erro de configuração
 * (diferente de assinatura inválida — o chamador deve retornar 500 para forçar retry do MP).
 */
function verifyMPSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null,
): boolean | null {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    // Retorna null (não false) para que o chamador distinga "sem secret" de "assinatura inválida"
    // Sem secret: retornar 500 para que o MP retente (pagamento não deve ser silenciosamente descartado)
    return null
  }
  if (!xSignature || !xRequestId || !dataId) return false

  const parts = xSignature.split(',')
  const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1]
  const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1]

  if (!ts || !v1) return false

  // MP envia o payment ID como query param ?data.id=XXX — usar para o manifest
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hash = createHmac('sha256', secret).update(manifest).digest('hex')

  return hash === v1
}

export async function POST(request: Request) {
  try {
    const xSignature = request.headers.get('x-signature')
    const xRequestId = request.headers.get('x-request-id')
    // MP envia o payment ID como query string ?data.id=XXX — necessário para o manifest HMAC
    const dataId = new URL(request.url).searchParams.get('data.id')

    const signatureResult = verifyMPSignature(xSignature, xRequestId, dataId)
    if (signatureResult === null) {
      // MP_WEBHOOK_SECRET não configurado — erro de servidor, não de assinatura
      // Retornar 500 para que o MP retente e o pagamento não seja perdido silenciosamente
      console.error('[webhook] CRÍTICO: MP_WEBHOOK_SECRET não configurado — todos os webhooks serão rejeitados até que seja configurado')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }
    if (!signatureResult) {
      console.error('[webhook] Assinatura inválida — request rejeitado')
      return NextResponse.json({ received: true }) // 200 para não revelar o motivo da rejeição
    }

    const body = await request.json()

    // MP envia diferentes tipos de notificação
    // Nos interessa apenas: type='payment' ou topic='payment'
    const paymentId = body?.data?.id ?? body?.id
    const type = body?.type ?? body?.topic

    if (!paymentId || type !== 'payment') {
      return NextResponse.json({ received: true })
    }

    // Buscar detalhes do pagamento no MP
    let payment
    try {
      const paymentClient = new Payment(mp)
      payment = await paymentClient.get({ id: String(paymentId) })
    } catch (mpError: any) {
      console.error('[webhook] Erro ao buscar payment no MP:', mpError?.message || mpError)
      // Retornar 200 para o MP não retentar indefinidamente em caso de falha temporária
      return NextResponse.json({ received: true })
    }

    if (!payment || payment.status !== 'approved') {
      return NextResponse.json({ received: true })
    }

    const externalRef = payment.external_reference
    if (!externalRef) {
      return NextResponse.json({ received: true })
    }

    // Buscar a intenção de pagamento armazenada
    const { data: intent, error: intentError } = await supabaseAdmin
      .from('payment_intents')
      .select('*')
      .eq('id', externalRef)
      .single()

    if (intentError || !intent) {
      // Pode ter sido já processado por uma notificação duplicada do MP
      return NextResponse.json({ received: true })
    }

    const qd = intent.question_data

    if (!qd || !qd.creator_id || !qd.content) {
      console.error('[webhook] question_data inválido no intent:', externalRef)
      return NextResponse.json({ received: true })
    }

    // Idempotência: verificar se este pagamento já foi processado antes de inserir
    const { data: existingTransaction } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('mp_payment_id', String(paymentId))
      .maybeSingle()

    if (existingTransaction) {
      // Pagamento já processado — limpar intent residual (se houver) e retornar sucesso
      await supabaseAdmin.from('payment_intents').delete().eq('id', externalRef)
      return NextResponse.json({ received: true })
    }

    // Re-verificar limite diário atomicamente antes de inserir (evita race condition
    // entre o check em create-preference e a inserção aqui no webhook)
    const { data: canAccept } = await supabaseAdmin
      .rpc('can_accept_question', { p_creator_id: qd.creator_id })

    if (!canAccept) {
      // Limite atingido entre o momento do pagamento e a confirmação — reembolsar imediatamente
      console.warn('[webhook] Limite diário atingido para creator:', qd.creator_id, '— iniciando reembolso automático para pagamento:', paymentId)
      try {
        const refundClient = new PaymentRefund(mp)
        await refundClient.create({
          payment_id: String(paymentId),
          body: { amount: intent.amount },
        })
        console.log('[webhook] Reembolso automático iniciado com sucesso para pagamento:', paymentId)
      } catch (refundErr: any) {
        console.error('[webhook] ATENÇÃO: Falha ao reembolsar automaticamente pagamento:', paymentId, refundErr?.message || refundErr)
        // Falha no reembolso — admin precisará processar manualmente via /api/admin/refunds
      }
      // Limpar o payment_intent independente do resultado do reembolso
      await supabaseAdmin.from('payment_intents').delete().eq('id', externalRef)
      return NextResponse.json({ received: true })
    }

    // Apoios (is_support_only) não exigem resposta — criados já como 'answered'
    const isSupportOnly = Boolean(qd.is_support_only)
    const now = new Date().toISOString()

    // Inserir a pergunta no banco
    const { data: question, error: questionError } = await supabaseAdmin
      .from('questions')
      .insert({
        creator_id: qd.creator_id,
        sender_name: qd.sender_name,
        sender_email: qd.sender_email ?? null,
        content: qd.content,
        price_paid: qd.price_paid,
        service_type: qd.service_type,
        is_anonymous: qd.is_anonymous,
        // Apoios nunca aparecem no feed público — is_shareable é ignorado para evitar confusão
        is_shareable: isSupportOnly ? false : qd.is_shareable,
        is_support_only: isSupportOnly,
        status: isSupportOnly ? 'answered' : 'pending',
        ...(isSupportOnly && { answered_at: now, response_text: '❤️ Apoio recebido!' }),
      })
      .select('id')
      .single()

    if (questionError || !question) {
      console.error('[webhook] Erro ao inserir question:', questionError)
      return NextResponse.json({ error: 'Erro ao salvar pergunta' }, { status: 500 })
    }

    // Inserir a transação
    const { error: transactionError } = await supabaseAdmin.from('transactions').insert({
      question_id: question.id,
      amount: intent.amount,
      status: 'approved',
      payment_method: payment.payment_type_id ?? 'unknown',
      mp_payment_id: String(paymentId),
      mp_preference_id: intent.mp_preference_id,
    })

    if (transactionError) {
      // Rollback: deletar a question para manter consistência (sem question órfã sem transaction)
      // O payment_intent é mantido intencionalmente para que o MP possa re-entregar e reprocessar
      const { error: rollbackError } = await supabaseAdmin.from('questions').delete().eq('id', question.id)
      if (rollbackError) {
        // Question órfã — quando o MP retentar, a tentativa de inserir nova question pode gerar duplicata
        // Admin deve verificar manualmente questions sem transaction correspondente para o payment: paymentId
        console.error('[webhook] CRÍTICO: rollback da question falhou — question órfã criada. payment_id:', paymentId, 'question_id:', question.id, rollbackError)
      }
      console.error('[webhook] Erro ao inserir transaction:', transactionError)
      return NextResponse.json({ error: 'Erro ao salvar transação' }, { status: 500 })
    }

    // Limpar o payment_intent (já foi processado com sucesso)
    await supabaseAdmin.from('payment_intents').delete().eq('id', externalRef)

    // Notificar criador quando pergunta real chega (fire-and-forget — não bloqueia o webhook)
    if (!isSupportOnly) {
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(qd.creator_id)
        const creatorEmail = userData?.user?.email
        const { data: creatorProfile } = await supabaseAdmin
          .from('profiles')
          .select('username')
          .eq('id', qd.creator_id)
          .single()

        if (creatorEmail && creatorProfile?.username) {
          sendNewQuestionNotification(
            creatorEmail,
            creatorProfile.username,
            qd.sender_name,
            qd.price_paid,
            qd.content,
            qd.is_anonymous
          ).catch((e) => console.error('[webhook] erro ao notificar criador:', e))
        }
      } catch (e) {
        console.error('[webhook] erro ao buscar dados do criador para notificação:', e)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[webhook] Erro inesperado:', error)
    // Retornar 200 para o MP não retentar indefinidamente
    return NextResponse.json({ received: true })
  }
}
