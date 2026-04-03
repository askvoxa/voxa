import { NextResponse, type NextRequest } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase/admin'

const JOB_NAMES = ['expire-questions', 'cleanup-intents', 'process-payouts', 'release-earnings'] as const
type JobName = typeof JOB_NAMES[number]

function buildCronRequest(job: JobName): { url: string; headers: Record<string, string> } {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (job === 'expire-questions' || job === 'cleanup-intents') {
    return {
      url: `${base}/api/cron/${job}`,
      headers: { 'x-cron-secret': process.env.CRON_SECRET ?? '' },
    }
  }

  return {
    url: `${base}/api/cron/${job}`,
    headers: { Authorization: `Bearer ${process.env.PAYOUT_SECRET ?? ''}` },
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { job: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const { job } = body
  if (!JOB_NAMES.includes(job as JobName)) {
    return NextResponse.json({ error: 'Job inválido.' }, { status: 400 })
  }

  const { url, headers } = buildCronRequest(job as JobName)
  const startedAt = Date.now()

  let status: 'success' | 'error' = 'error'
  let result: Record<string, unknown> = {}

  try {
    const res = await fetch(url, { method: 'POST', headers })
    result = await res.json()
    status = res.ok ? 'success' : 'error'
  } catch (err) {
    result = { error: err instanceof Error ? err.message : 'Erro de conexão' }
  }

  const duration_ms = Date.now() - startedAt

  await supabaseAdmin.from('admin_job_runs').insert({
    job_name: job,
    triggered_by: admin.id,
    started_at: new Date(startedAt).toISOString(),
    duration_ms,
    status,
    result,
  })

  return NextResponse.json({ status, duration_ms, result })
}
