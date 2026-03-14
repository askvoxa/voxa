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

  const body = await request.json()
  const { is_active } = body

  if (typeof is_active !== 'boolean') {
    return NextResponse.json({ error: 'Campo is_active obrigatório (boolean)' }, { status: 400 })
  }

  // Impede banir outro admin
  const { data: target } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', params.id)
    .single()

  if (target?.is_admin) {
    return NextResponse.json({ error: 'Não é possível alterar o status de outro admin' }, { status: 422 })
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ is_active })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: 'Erro ao atualizar perfil' }, { status: 500 })
  }

  return NextResponse.json({ success: true, is_active })
}
