import { NextResponse, type NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/admin/payouts
 * Lista payouts com filtros e retorna resumo para o dashboard admin.
 */
export async function GET(request: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const creatorId = searchParams.get('creator_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') ?? '20')))
  const rangeFrom = (page - 1) * perPage
  const rangeTo = rangeFrom + perPage - 1

  // Query de payouts com filtros
  let query = supabaseAdmin
    .from('payout_requests')
    .select(`
      id, creator_id, amount, status, mp_payout_id, failure_reason,
      retry_count, requested_at, processed_at,
      profiles!inner (username, avatar_url)
    `, { count: 'exact' })
    .order('requested_at', { ascending: false })
    .range(rangeFrom, rangeTo)

  if (status) query = query.eq('status', status)
  if (creatorId) query = query.eq('creator_id', creatorId)
  if (from) query = query.gte('requested_at', from)
  if (to) query = query.lte('requested_at', to)

  const { data, count, error } = await query

  if (error) {
    console.error('[admin/payouts] Erro:', error.message)
    return NextResponse.json({ error: 'Erro ao buscar payouts.' }, { status: 500 })
  }

  // Resumo para dashboard
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [weekTotal, pendingTotal, failedCount] = await Promise.all([
    // Total pago na semana
    supabaseAdmin
      .from('payout_requests')
      .select('amount')
      .eq('status', 'completed')
      .gte('processed_at', weekAgo)
      .then(({ data }) => (data ?? []).reduce((sum, p) => sum + Number(p.amount), 0)),

    // Total pendente
    supabaseAdmin
      .from('payout_requests')
      .select('amount')
      .eq('status', 'pending')
      .then(({ data }) => (data ?? []).reduce((sum, p) => sum + Number(p.amount), 0)),

    // Falhas ativas (retry < 3)
    supabaseAdmin
      .from('payout_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .lt('retry_count', 3)
      .then(({ count }) => count ?? 0),
  ])

  return NextResponse.json({
    payouts: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    summary: {
      week_total: weekTotal,
      pending_total: pendingTotal,
      failed_count: failedCount,
    },
  })
}
