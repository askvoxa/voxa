import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { FALLBACK_SETTINGS } from '@/lib/platform-settings'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .select('platform_fee_rate, response_deadline_hours, updated_at')
    .eq('id', 1)
    .single()

  if (error || !data) {
    return NextResponse.json(FALLBACK_SETTINGS)
  }

  return NextResponse.json({
    platform_fee_rate: Number(data.platform_fee_rate),
    response_deadline_hours: Number(data.response_deadline_hours),
    updated_at: data.updated_at,
  })
}

export async function PATCH(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }
  const { platform_fee_rate, response_deadline_hours } = body

  // Validate
  if (platform_fee_rate !== undefined) {
    const rate = Number(platform_fee_rate)
    if (isNaN(rate) || rate < 0 || rate > 0.5) {
      return NextResponse.json(
        { error: 'Taxa da plataforma deve estar entre 0% e 50%.' },
        { status: 400 }
      )
    }
  }
  if (response_deadline_hours !== undefined) {
    const hours = Number(response_deadline_hours)
    if (!Number.isInteger(hours) || hours < 1 || hours > 720) {
      return NextResponse.json(
        { error: 'Prazo deve ser entre 1 e 720 horas.' },
        { status: 400 }
      )
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (platform_fee_rate !== undefined) updates.platform_fee_rate = Number(platform_fee_rate)
  if (response_deadline_hours !== undefined) updates.response_deadline_hours = Number(response_deadline_hours)

  const { error } = await supabaseAdmin
    .from('platform_settings')
    .upsert({ id: 1, ...updates })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
