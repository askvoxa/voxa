import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { getPlatformSettings } from '@/lib/platform-settings'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  // Autenticação
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Autenticação necessária' }, { status: 401 })
  }

  // Buscar saldo via RPC
  const { data: balanceData, error: balanceError } = await supabaseAdmin
    .rpc('get_creator_balance', { p_creator_id: user.id })
    .single<{ available_balance: number; pending_release: number; total_withdrawn: number }>()

  if (balanceError) {
    console.error('[payout/balance] Erro ao buscar saldo:', balanceError.message)
    return NextResponse.json({ error: 'Erro ao consultar saldo.' }, { status: 500 })
  }

  // Verificar se tem chave PIX ativa
  const { count } = await supabaseAdmin
    .from('creator_pix_keys')
    .select('id', { count: 'exact', head: true })
    .eq('creator_id', user.id)
    .eq('is_active', true)

  const hasPixKey = (count ?? 0) > 0

  // Verificar se criador está bloqueado
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('payouts_blocked')
    .eq('id', user.id)
    .single()

  const settings = await getPlatformSettings()

  const availableBalance = Number(balanceData?.available_balance ?? 0)
  const canRequest = availableBalance >= settings.min_payout_amount
    && hasPixKey
    && !settings.payouts_paused
    && !profile?.payouts_blocked

  return NextResponse.json({
    available_balance: availableBalance,
    pending_release: Number(balanceData?.pending_release ?? 0),
    total_withdrawn: Number(balanceData?.total_withdrawn ?? 0),
    has_pix_key: hasPixKey,
    min_payout_amount: settings.min_payout_amount,
    payout_day_of_week: settings.payout_day_of_week,
    payouts_paused: settings.payouts_paused,
    payouts_blocked: profile?.payouts_blocked ?? false,
    can_request: canRequest,
  })
}
