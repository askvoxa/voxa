import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  // Autenticação
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Autenticação necessária' }, { status: 401 })
  }

  // Paginação
  const { searchParams } = request.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') ?? '10')))
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  // Buscar saques do criador
  const { data, count, error } = await supabaseAdmin
    .from('payout_requests')
    .select('id, amount, status, failure_reason, retry_count, requested_at, processed_at', { count: 'exact' })
    .eq('creator_id', user.id)
    .order('requested_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[payout/history] Erro ao buscar histórico:', error.message)
    return NextResponse.json({ error: 'Erro ao buscar histórico.' }, { status: 500 })
  }

  return NextResponse.json({
    payouts: data ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
  })
}
