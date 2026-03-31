import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'
import { invalidateSettingsCache } from '@/lib/platform-settings'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/admin/payouts/settings
 * Retorna configurações de payout da plataforma.
 */
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('platform_settings')
    .select('payout_day_of_week, min_payout_amount, payout_release_days, payouts_paused, updated_at')
    .eq('id', 1)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar configurações.' }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/admin/payouts/settings
 * Atualiza configurações de payout.
 */
export async function PATCH(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  // Construir objeto de update apenas com campos válidos
  const update: Record<string, unknown> = {}

  if (body.payout_day_of_week !== undefined) {
    const day = Number(body.payout_day_of_week)
    if (isNaN(day) || day < 0 || day > 6 || !Number.isInteger(day)) {
      return NextResponse.json({ error: 'Dia da semana deve ser entre 0 (domingo) e 6 (sábado).' }, { status: 400 })
    }
    update.payout_day_of_week = day
  }

  if (body.min_payout_amount !== undefined) {
    const amount = Number(body.min_payout_amount)
    if (isNaN(amount) || amount <= 0 || amount > 10000) {
      return NextResponse.json({ error: 'Valor mínimo deve ser entre R$0,01 e R$10.000.' }, { status: 400 })
    }
    update.min_payout_amount = amount
  }

  if (body.payout_release_days !== undefined) {
    const days = Number(body.payout_release_days)
    if (isNaN(days) || days < 1 || days > 90 || !Number.isInteger(days)) {
      return NextResponse.json({ error: 'Dias de carência deve ser entre 1 e 90.' }, { status: 400 })
    }
    update.payout_release_days = days
  }

  if (body.payouts_paused !== undefined) {
    update.payouts_paused = Boolean(body.payouts_paused)
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('platform_settings')
    .update(update)
    .eq('id', 1)

  if (error) {
    console.error('[admin/payouts/settings] Erro:', error.message)
    return NextResponse.json({ error: 'Erro ao salvar configurações.' }, { status: 500 })
  }

  // Invalidar cache de settings
  invalidateSettingsCache()

  console.log(`[admin/audit] Admin ${admin.id} atualizou configurações de payout:`, JSON.stringify(update))

  return NextResponse.json({ success: true, updated: update })
}
