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

  // Verificar se estamos na virada do dia em São Paulo (BRT/BRST)
  // O cron deve rodar a cada hora; só resetar se for entre 00:00-00:59 BRT
  const nowBRT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const currentHourBRT = nowBRT.getHours()

  if (currentHourBRT !== 0) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: `Horário atual em BRT: ${currentHourBRT}h — reset só ocorre às 00:00 BRT`,
    })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await supabase
    .from('profiles')
    .update({ questions_answered_today: 0 })
    .gte('questions_answered_today', 0)

  if (error) {
    console.error('[cron/reset-daily] erro:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[cron/reset-daily] reset concluído às', new Date().toISOString(), '(00h BRT)')
  return NextResponse.json({ ok: true })
}
