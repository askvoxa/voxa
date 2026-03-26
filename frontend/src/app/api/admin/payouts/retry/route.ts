import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/admin/payouts/retry
 * Re-processa um payout falho (reseta status para pending).
 */
export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { payout_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const { payout_id } = body
  if (!payout_id || !UUID_RE.test(payout_id)) {
    return NextResponse.json({ error: 'ID de payout inválido.' }, { status: 400 })
  }

  // Resetar status para pending e zerar retry_count
  const { data, error } = await supabaseAdmin
    .from('payout_requests')
    .update({ status: 'pending', retry_count: 0, failure_reason: null })
    .eq('id', payout_id)
    .eq('status', 'failed')
    .select('id, status')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Payout não encontrado ou não está em status failed.' }, { status: 404 })
  }

  console.log(`[admin/audit] Admin ${admin.id} re-tentou payout ${payout_id}`)

  return NextResponse.json({ success: true, payout: data })
}
