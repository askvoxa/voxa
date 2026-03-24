import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  const cronSecret = process.env.CRON_SECRET
  // Previne bypass quando ambos são undefined e usa comparação timing-safe
  if (!cronSecret || !secret || secret.length !== cronSecret.length
      || !timingSafeEqual(Buffer.from(secret), Buffer.from(cronSecret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Limpar payment_intents abandonados (mais de 48 horas sem webhook do MP)
  // Mercado Pago pode retentar webhooks por até 48h — janela menor causaria perda de pagamentos
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const { error, count } = await supabase
    .from('payment_intents')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)

  if (error) {
    console.error('[cron/cleanup-intents] erro:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[cron/cleanup-intents] ${count ?? 0} intents removidos às`, new Date().toISOString())
  return NextResponse.json({ ok: true, removed: count ?? 0 })
}
