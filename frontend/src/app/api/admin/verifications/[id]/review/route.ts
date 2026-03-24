import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
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
  const { action, rejection_reason } = body as any

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Ação inválida. Use "approve" ou "reject"' }, { status: 400 })
  }

  if (action === 'reject' && !rejection_reason?.trim()) {
    return NextResponse.json({ error: 'Motivo da rejeição é obrigatório' }, { status: 400 })
  }

  // Buscar solicitação
  const { data: verificationReq, error: fetchError } = await supabaseAdmin
    .from('verification_requests')
    .select('id, creator_id, status')
    .eq('id', params.id)
    .single()

  if (fetchError || !verificationReq) {
    return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })
  }

  if (verificationReq.status !== 'pending') {
    return NextResponse.json({ error: 'Solicitação já foi processada' }, { status: 422 })
  }

  const now = new Date().toISOString()

  if (action === 'approve') {
    // Marcar perfil como verificado PRIMEIRO — se falhar, a solicitação permanece pending
    // e o admin pode tentar novamente (evita estado inconsistente)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ is_verified: true })
      .eq('id', verificationReq.creator_id)

    if (profileError) {
      console.error('[admin/verifications] Erro ao marcar perfil como verificado:', profileError)
      return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
    }

    // Atualizar solicitação
    const { error: updateError } = await supabaseAdmin
      .from('verification_requests')
      .update({ status: 'approved', reviewed_by: admin.id, reviewed_at: now })
      .eq('id', params.id)

    if (updateError) {
      console.error('[admin/verifications] Perfil marcado como verificado mas erro ao atualizar request:', updateError)
      // Perfil já está verificado — retorna sucesso parcial
    }

    console.log(`[admin/audit] Admin ${admin.id} aprovou verificação ${params.id} — criador ${verificationReq.creator_id} agora verificado`)
  } else {
    // Rejeitar
    const { error: updateError } = await supabaseAdmin
      .from('verification_requests')
      .update({
        status: 'rejected',
        rejection_reason: rejection_reason.trim(),
        reviewed_by: admin.id,
        reviewed_at: now,
      })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao rejeitar solicitação' }, { status: 500 })
    }

    console.log(`[admin/audit] Admin ${admin.id} rejeitou verificação ${params.id} — motivo: ${rejection_reason}`)
  }

  return NextResponse.json({ success: true, action })
}
