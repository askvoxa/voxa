import { NextResponse } from 'next/server'
import MercadoPagoConfig, { Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
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
      console.error('Erro ao inserir question:', questionError)
      return NextResponse.json({ error: 'Erro ao salvar pergunta' }, { status: 500 })
    }

    // Inserir a transação
    await supabaseAdmin.from('transactions').insert({
      question_id: question.id,
      amount: intent.amount,
      status: 'approved',
      payment_method: payment.payment_type_id ?? 'unknown',
      mp_payment_id: String(paymentId),
      mp_preference_id: intent.mp_preference_id,
    })

    // Limpar o payment_intent (já foi processado)
    await supabaseAdmin.from('payment_intents').delete().eq('id', externalRef)

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('webhook error:', error)
    // Retornar 200 para o MP não retentar indefinidamente
    return NextResponse.json({ received: true })
  }
}
