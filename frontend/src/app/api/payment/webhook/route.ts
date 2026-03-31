import { NextResponse } from 'next/server'
import MercadoPagoConfig, { Payment, PaymentRefund } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import { sendNewQuestionNotification, sendSupportNotification } from '@/lib/email'

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

  // Rejeitar webhooks com timestamp muito antigo (proteção contra replay attacks)
  // Tolerância de 5 minutos para acomodar clock drift entre servidores
  const tsNum = Number(ts)
  if (isNaN(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false

  // MP envia o payment ID como query param ?data.id=XXX — usar para o manifest
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hash = createHmac('sha256', secret).update(manifest).digest('hex')

  // Comparação timing-safe para prevenir ataques de timing na validação HMAC
  const hashBuffer = Buffer.from(hash)
  const v1Buffer = Buffer.from(v1)
  if (hashBuffer.length !== v1Buffer.length) return false
  return timingSafeEqual(hashBuffer, v1Buffer)
}

export async function POST(request: Request) {
  try {
    const xSignature = request.headers.get('x-signature')
    const xRequestId = request.headers.get('x-request-id')
    // MP envia o payment ID como query string ?data.id=XXX — necessário para o manifest HMAC
    const dataId = new URL(request.url).searchParams.get('data.id')

    const signatureResult = verifyMPSignature(xSignature, xRequestId, dataId)
    if (signatureResult === null) {
      console.warn('[webhook] AVISO: MP_WEBHOOK_SECRET não configurado. Validando webhook apenas pela API do Mercado Pago.')
    } else if (!signatureResult) {
      console.warn('[webhook] AVISO: Assinatura MP inválida ou ausente (possível erro no secret ou webhooks de teste). Ignorando validação HMAC e utilizando fallback seguro (API GET).')
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
      // Retornar 500 para que o MP retente — idempotência protege contra duplicatas
      return NextResponse.json({ error: 'MP API error' }, { status: 500 })
    }

    if (!payment || payment.status !== 'approved') {
      return NextResponse.json({ received: true })
    }

    // Extrair taxa de processamento cobrada pelo MP (soma de todos os fees do coletor)
    const processingFee = ((payment as any).fee_details ?? [])
      .filter((f: any) => f.fee_payer === 'collector')
      .reduce((sum: number, f: any) => sum + Number(f.amount ?? 0), 0)

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

    if (intentError) {
      // Erro real de banco — retornar 500 para que o MP retente
      console.error('[webhook] Erro ao buscar payment_intent:', intentError)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
    if (!intent) {
      // Intent não encontrado — provavelmente já foi processado por notificação anterior (idempotência)
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
    // entre o check em create-preference e a inserção aqui no webhook).
    // Passamos p_exclude_intent_id para excluir o intent do FÃ ATUAL da contagem —
    // sem isso, o próprio intent sendo processado contaria contra o limite, causando
    // falso-positivo de "limite atingido" para criadores com daily_limit baixo.
    const { data: canAccept } = await supabaseAdmin
      .rpc('can_accept_question', { p_creator_id: qd.creator_id, p_exclude_intent_id: externalRef })

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

    // Calcular taxa da plataforma e valor líquido do criador
    // Busca username junto para reutilizar na notificação por email (evita segunda query)
    const [{ data: platformSettings }, { data: creatorProfileData }] = await Promise.all([
      supabaseAdmin.from('platform_settings').select('platform_fee_rate').eq('id', 1).single(),
      supabaseAdmin.from('profiles').select('custom_creator_rate, username').eq('id', qd.creator_id).single(),
    ])
    const platformFeeRate = Number(platformSettings?.platform_fee_rate ?? 0.1)
    const rawCustomRate = creatorProfileData?.custom_creator_rate
    const customCreatorRate = rawCustomRate != null ? Number(rawCustomRate) : null
    const creatorRate = customCreatorRate ?? (1 - platformFeeRate)
    // Garantir que a taxa de processamento não excede o valor bruto (caso extremo)
    const netBeforePlatform = Math.max(0, Number(intent.amount) - processingFee)
    // Arredondar creator_net para 2 casas e derivar platform_fee como remainder (garante fechamento contábil)
    const creatorNet = Math.round(netBeforePlatform * creatorRate * 100) / 100
    const platformFee = Math.round((netBeforePlatform - creatorNet) * 100) / 100

    // Inserção atômica via RPC — garante que question e transaction são criadas juntas ou nenhuma
    const { data: questionId, error: rpcError } = await supabaseAdmin.rpc('insert_question_and_transaction', {
      p_question: {
        creator_id: qd.creator_id,
        sender_id: qd.sender_id ?? '',
        sender_name: qd.sender_name,
        sender_email: qd.sender_email ?? '',
        content: qd.content,
        price_paid: qd.price_paid,
        service_type: qd.service_type,
        is_anonymous: qd.is_anonymous,
        is_shareable: isSupportOnly ? false : qd.is_shareable,
        is_support_only: isSupportOnly,
        status: isSupportOnly ? 'answered' : 'pending',
        answered_at: isSupportOnly ? now : '',
        response_text: isSupportOnly ? '❤️ Apoio recebido!' : '',
      },
      p_transaction: {
        amount: intent.amount,
        processing_fee: processingFee,
        platform_fee: platformFee,
        creator_net: creatorNet,
        status: 'approved',
        payment_method: payment.payment_type_id ?? 'unknown',
        mp_payment_id: String(paymentId),
        mp_preference_id: intent.mp_preference_id ?? '',
      },
    })

    if (rpcError || !questionId) {
      console.error('[webhook] Erro ao inserir question+transaction via RPC:', rpcError)
      // Retornar 500 para que o MP retente — payment_intent é mantido para reprocessar
      return NextResponse.json({ error: 'Erro ao salvar pergunta e transação' }, { status: 500 })
    }

    // Limpar o payment_intent (já foi processado com sucesso)
    await supabaseAdmin.from('payment_intents').delete().eq('id', externalRef)

    // Notificar criador (fire-and-forget — não bloqueia o webhook)
    try {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(qd.creator_id)
      const creatorEmail = userData?.user?.email

      if (creatorEmail && creatorProfileData?.username) {
        if (isSupportOnly) {
          sendSupportNotification({
            creatorEmail,
            creatorUsername: creatorProfileData.username,
            senderName: qd.sender_name,
            amount: qd.price_paid,
            isAnonymous: qd.is_anonymous,
          }).catch((e) => console.error('[webhook] erro ao notificar apoio:', e))
        } else {
          sendNewQuestionNotification(
            creatorEmail,
            creatorProfileData.username,
            qd.sender_name,
            qd.price_paid,
            qd.content,
            qd.is_anonymous,
            creatorNet
          ).catch((e) => console.error('[webhook] erro ao notificar criador:', e))
        }
      }
    } catch (e) {
      console.error('[webhook] erro ao buscar dados do criador para notificação:', e)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[webhook] Erro inesperado:', error)
    // Retornar 500 para que o MP retente — idempotência protege contra duplicatas
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
