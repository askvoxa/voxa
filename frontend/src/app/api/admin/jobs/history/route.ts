import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('admin_job_runs')
    .select('id, job_name, triggered_by, started_at, duration_ms, status, result')
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Buscar emails dos admins que dispararam os jobs
  const userIds = [...new Set((data ?? []).map(r => r.triggered_by).filter(Boolean))]
  const emailMap: Record<string, string> = {}

  for (const uid of userIds) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(uid)
    if (userData?.user?.email) emailMap[uid] = userData.user.email
  }

  const rows = (data ?? []).map(r => ({
    ...r,
    triggered_by_email: r.triggered_by ? (emailMap[r.triggered_by] ?? r.triggered_by) : null,
  }))

  return NextResponse.json(rows)
}
