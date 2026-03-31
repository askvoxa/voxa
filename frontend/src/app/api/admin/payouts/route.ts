import { NextResponse, type NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

  // Resumo para dashboard — usar RPC em vez de 3 queries separadas (elimina N+1)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: summaryData, error: summaryError } = await supabaseAdmin
    .rpc('get_payout_summary', { p_week_ago: weekAgo })

  if (summaryError) {
    console.error('[admin/payouts] Erro ao buscar resumo:', summaryError.message)
    return NextResponse.json({ error: 'Erro ao buscar resumo.' }, { status: 500 })
  }

  const summary = summaryData?.[0] ?? { week_total: 0, pending_total: 0, failed_count: 0 }
  const { week_total: weekTotal, pending_total: pendingTotal, failed_count: failedCount } = summary

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
