import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }
  const { action } = body as any

  if (action !== 'approve' && action !== 'dismiss') {
    return NextResponse.json({ error: 'Ação inválida. Use "approve" ou "dismiss"' }, { status: 400 })
  }

  // Buscar o report
  const { data: report, error: fetchError } = await supabaseAdmin
    .from('question_reports')
    .select('id, question_id, status')
    .eq('id', params.id)
    .single()

  if (fetchError || !report) {
    return NextResponse.json({ error: 'Denúncia não encontrada' }, { status: 404 })
  }

  if (report.status === 'admin_approved' || report.status === 'dismissed') {
    return NextResponse.json({ error: 'Denúncia já foi processada' }, { status: 422 })
  }

  if (action === 'approve') {
    // Aprovar denúncia: criador fica com o dinheiro, pergunta permanece como 'reported'
    const { error } = await supabaseAdmin
      .from('question_reports')
      .update({
        status: 'admin_approved',
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: 'Erro ao aprovar denúncia' }, { status: 500 })
    }

    console.log(`[admin/audit] Admin ${admin.id} aprovou denúncia ${params.id} — criador mantém pagamento`)
  } else {
    // Dispensar denúncia: pergunta volta a 'pending'
    const { error: reportError } = await supabaseAdmin
      .from('question_reports')
      .update({
        status: 'dismissed',
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (reportError) {
      return NextResponse.json({ error: 'Erro ao dispensar denúncia' }, { status: 500 })
    }

    // Restaurar pergunta para pending
    const { error: questionError } = await supabaseAdmin
      .from('questions')
      .update({ status: 'pending' })
      .eq('id', report.question_id)

    if (questionError) {
      console.error('[admin/reports] Erro ao restaurar pergunta:', questionError)
      return NextResponse.json({ error: 'Erro ao restaurar pergunta' }, { status: 500 })
    }

    console.log(`[admin/audit] Admin ${admin.id} dispensou denúncia ${params.id} — pergunta restaurada`)
  }

  return NextResponse.json({ success: true, action })
}
