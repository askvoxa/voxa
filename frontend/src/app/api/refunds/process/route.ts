import { NextResponse } from 'next/server'
import MercadoPagoConfig, { PaymentRefund } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/refunds/process?secret=REFUND_SECRET
 *
 * Processa a fila de reembolsos pendentes.
 * Deve ser chamado por um cron job a cada 30 minutos.
 *
 * No Render.com: configurar Cron Job com:
 *   Schedule: 0,30 * * * * (a cada 30 min)
 *   Command: curl -s "{APP_URL}/api/refunds/process?secret={REFUND_SECRET}"
 *
 * Alternativamente, usar pg_cron no Supabase para chamar expire_pending_questions()
 * e este endpoint separadamente para processar os reembolsos.
 */
export async function GET(request: Request) {
  // Feature flag — desabilitado enquanto não houver cron configurado (plano gratuito Render)
  if (process.env.FEATURE_REFUNDS_ENABLED !== 'true') {
    return NextResponse.json({ disabled: true, message: 'Reembolsos automáticos desabilitados' })
  }

  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!process.env.REFUND_SECRET || secret !== process.env.REFUND_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data: pending, error: fetchError } = await supabaseAdmin
    .from('refund_queue')
    .select('*')
    .eq('status', 'pending')
    .limit(20) // Processar em lotes para não exceder tempo de request

  if (fetchError) {
    console.error('[refunds] Erro ao buscar fila:', fetchError)
    return NextResponse.json({ error: 'Erro ao buscar fila de reembolsos' }, { status: 500 })
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ processed: 0, message: 'Nenhum reembolso pendente' })
  }

  const refundClient = new PaymentRefund(mp)
  let processed = 0
  let failed = 0

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

      processed++
    } catch (err: any) {
      console.error(`[refunds] Falha ao reembolsar ${item.mp_payment_id}:`, err?.message)
      await supabaseAdmin
        .from('refund_queue')
        .update({ status: 'failed', processed_at: new Date().toISOString() })
        .eq('id', item.id)
      failed++
    }
  }

  return NextResponse.json({ processed, failed, total: pending.length })
}
