import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'
import MercadoPagoConfig, { PaymentRefund } from 'mercadopago'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { question_id } = body

  if (typeof question_id !== 'string' || !UUID_RE.test(question_id)) {
    return NextResponse.json({ error: 'question_id inválido' }, { status: 400 })
  }

  // Find the associated transaction
  const { data: transaction, error: tError } = await supabaseAdmin
    .from('transactions')
    .select('id, mp_payment_id, amount, status')
    .eq('question_id', question_id)
    .single()

  if (tError || !transaction) {
    return NextResponse.json({ error: 'Transação não encontrada para esta pergunta' }, { status: 404 })
  }

  if (!transaction.mp_payment_id) {
    return NextResponse.json({ error: 'ID de pagamento MP não encontrado' }, { status: 422 })
  }

  // Optimistic lock: atomically mark as 'refunded' only if not already so.
  // This prevents double-refund race conditions between concurrent admin requests.
  const { data: locked } = await supabaseAdmin
    .from('transactions')
    .update({ status: 'refunded' })
    .eq('id', transaction.id)
    .neq('status', 'refunded')
    .select('id')

  if (!locked || locked.length === 0) {
    return NextResponse.json({ error: 'Transação já foi reembolsada' }, { status: 422 })
  }

  try {
    const refundClient = new PaymentRefund(mp)
    await refundClient.create({
      payment_id: transaction.mp_payment_id,
      body: { amount: transaction.amount },
    })

    // Mark question as expired (pending questions manually refunded by admin)
    await supabaseAdmin
      .from('questions')
      .update({ status: 'expired' })
      .eq('id', question_id)

    console.log(`[admin/audit] Admin ${admin.id} reembolsou question ${question_id} (mp_payment: ${transaction.mp_payment_id}, valor: ${transaction.amount})`)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    // MP call failed — revert the transaction status so the admin can retry
    await supabaseAdmin
      .from('transactions')
      .update({ status: transaction.status })
      .eq('id', transaction.id)

    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[admin/refunds] Erro ao reembolsar:', message)
    return NextResponse.json({ error: 'Erro ao processar reembolso no Mercado Pago' }, { status: 500 })
  }
}
