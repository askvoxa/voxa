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

  // Impede banir a si mesmo
  if (params.id === admin.id) {
    return NextResponse.json({ error: 'Não é possível alterar sua própria conta' }, { status: 422 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }
  const { is_active, is_verified } = body as any

  if (typeof is_active !== 'boolean' && typeof is_verified !== 'boolean') {
    return NextResponse.json({ error: 'Campo is_active ou is_verified obrigatório (boolean)' }, { status: 400 })
  }

  // Impede alterar outro admin
  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('account_type')
    .eq('id', params.id)
    .single()

  if (target?.account_type === 'admin') {
    return NextResponse.json({ error: 'Não é possível alterar o status de outro admin' }, { status: 422 })
  }

  const updates: Record<string, boolean> = {}
  if (typeof is_active === 'boolean') updates.is_active = is_active
  if (typeof is_verified === 'boolean') updates.is_verified = is_verified

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
  }

  if (typeof is_active === 'boolean') {
    console.log(`[admin/audit] Admin ${admin.id} ${is_active ? 'reativou' : 'baniu'} criador ${params.id}`)
  }
  if (typeof is_verified === 'boolean') {
    console.log(`[admin/audit] Admin ${admin.id} ${is_verified ? 'verificou' : 'removeu verificação de'} criador ${params.id}`)
  }

  return NextResponse.json({ success: true, ...updates })
}
