import { NextResponse } from 'next/server'
import MercadoPagoConfig, { Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

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
 * Se MP_WEBHOOK_SECRET não estiver configurado, loga um aviso e permite passar
 * (compatibilidade com ambientes de desenvolvimento sem secret configurado).
 */
function verifyMPSignature(
  xSignature: string | null,
  xRequestId: string | null,
  dataId: string | null,
): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[webhook] MP_WEBHOOK_SECRET não configurado — verificação de assinatura desabilitada')
    return true
  }
  if (!xSignature || !xRequestId) return false

  const parts = xSignature.split(',')
  const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1]
  const v1 = parts.find(p => p.startsWith('v1='))?.split('=')[1]

  if (!ts || !v1) return false

  // MP envia o payment ID como query param ?data.id=XXX — usar para o manifest
  const manifest = `id:${dataId ?? ''};request-id:${xRequestId};ts:${ts};`
  const hash = createHmac('sha256', secret).update(manifest).digest('hex')

  return hash === v1
}

export async function POST(request: Request) {
  try {
    const xSignature = request.headers.get('x-signature')
    const xRequestId = request.headers.get('x-request-id')
    // MP envia o payment ID como query string ?data.id=XXX — necessário para o manifest HMAC
    const dataId = new URL(request.url).searchParams.get('data.id')

    if (!verifyMPSignature(xSignature, xRequestId, dataId)) {
      console.error('[webhook] Assinatura inválida — request rejeitado')
      return NextResponse.json({ received: true }) // Retornar 200 para não revelar o motivo da rejeição
    }

    const body = await request.json()

    // MP envia diferentes tipos de notificação
    // Nos interessa apenas: type='payment' ou topic='payment'
    const paymentId = body?.data?.id ?? body?.id
    const type = body?.type ?? body?.topic

    if (!paymentId || (type !== 'payment' && type !== 'merchant_order')) {
      return NextResponse.json({ received: true })
    }

    // Buscar detalhes do pagamento no MP
    const paymentClient = new Payment(mp)
    const payment = await paymentClient.get({ id: String(paymentId) })

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

    // Inserir a pergunta no banco
    const { data: question, error: questionError } = await supabaseAdmin
      .from('questions')
      .insert({
        creator_id: qd.creator_id,
        sender_name: qd.sender_name,
        content: qd.content,
        price_paid: qd.price_paid,
        service_type: qd.service_type,
        is_anonymous: qd.is_anonymous,
        is_shareable: qd.is_shareable,
        status: 'pending',
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
      // Não deletar o payment_intent — manter para diagnóstico e possível reprocessamento
      console.error('[webhook] Erro ao inserir transaction:', transactionError)
      return NextResponse.json({ error: 'Erro ao salvar transação' }, { status: 500 })
    }

    // Limpar o payment_intent (já foi processado com sucesso)
    await supabaseAdmin.from('payment_intents').delete().eq('id', externalRef)

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[webhook] Erro inesperado:', error)
    // Retornar 200 para o MP não retentar indefinidamente
    return NextResponse.json({ received: true })
  }
}
