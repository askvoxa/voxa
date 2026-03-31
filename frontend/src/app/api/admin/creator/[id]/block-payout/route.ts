import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase/admin'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * PATCH /api/admin/creator/[id]/block-payout
 * Bloqueia ou desbloqueia saques de um criador específico.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  let body: { blocked: boolean; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  if (typeof body.blocked !== 'boolean') {
    return NextResponse.json({ error: 'Campo blocked deve ser boolean.' }, { status: 400 })
  }

  // Não permitir bloquear outro admin
  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('account_type')
    .eq('id', params.id)
    .single()

  if (!target) {
    return NextResponse.json({ error: 'Criador não encontrado.' }, { status: 404 })
  }

  if (target.account_type === 'admin') {
    return NextResponse.json({ error: 'Não é possível bloquear saques de um admin.' }, { status: 422 })
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ payouts_blocked: body.blocked })
    .eq('id', params.id)

  if (error) {
    console.error('[admin/block-payout] Erro:', error.message)
    return NextResponse.json({ error: 'Erro ao atualizar status de bloqueio.' }, { status: 500 })
  }

  const action = body.blocked ? 'bloqueou' : 'desbloqueou'
  const reason = body.reason ? ` Motivo: ${body.reason}` : ''
  console.log(`[admin/audit] Admin ${admin.id} ${action} payouts do criador ${params.id}.${reason}`)

  return NextResponse.json({ success: true, payouts_blocked: body.blocked })
}
