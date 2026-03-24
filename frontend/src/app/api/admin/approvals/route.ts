import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAdminUser } from '@/lib/admin'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// PATCH — Aprovar ou rejeitar um criador
export async function PATCH(request: Request) {
  const adminUser = await getAdminUser()
  if (!adminUser) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }
  const { creator_id, action, rejection_reason } = body as any

  if (!creator_id || !action) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  if (action === 'reject' && !rejection_reason?.trim()) {
    return NextResponse.json({ error: 'Motivo da rejeição é obrigatório' }, { status: 400 })
  }

  // Verificar que o criador existe e está pending_review
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, approval_status')
    .eq('id', creator_id)
    .single()

  if (!profile || profile.approval_status !== 'pending_review') {
    return NextResponse.json({ error: 'Criador não encontrado ou não está em análise' }, { status: 404 })
  }

  if (action === 'approve') {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        approval_status: 'approved',
        creator_setup_completed: true, // Libera acesso ao dashboard
        approval_reviewed_by: adminUser.id,
        approval_reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', creator_id)

    if (error) {
      return NextResponse.json({ error: 'Erro ao aprovar' }, { status: 500 })
    }
  } else {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        approval_status: 'rejected',
        approval_reviewed_by: adminUser.id,
        approval_reviewed_at: new Date().toISOString(),
        rejection_reason: String(rejection_reason).trim().slice(0, 500),
      })
      .eq('id', creator_id)

    if (error) {
      return NextResponse.json({ error: 'Erro ao rejeitar' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
