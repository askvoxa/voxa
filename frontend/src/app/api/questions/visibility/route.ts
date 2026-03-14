import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/questions/visibility
 * Body: { question_id: string, is_shareable: boolean }
 *
 * Permite que o criador controle se uma pergunta respondida
 * aparece ou não no feed público do seu perfil.
 */
export async function PATCH(request: Request) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const { question_id, is_shareable } = body

  if (!question_id || typeof is_shareable !== 'boolean') {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  // Verificar que a pergunta pertence ao criador logado
  const { data: question } = await supabase
    .from('questions')
    .select('id, creator_id, status')
    .eq('id', question_id)
    .single()

  if (!question) {
    return NextResponse.json({ error: 'Pergunta não encontrada' }, { status: 404 })
  }

  // Verificar que o usuário logado é o criador dessa pergunta
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (!profile || question.creator_id !== profile.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  if (question.status !== 'answered') {
    return NextResponse.json({ error: 'Só perguntas respondidas podem ter visibilidade alterada' }, { status: 422 })
  }

  const { error: updateError } = await supabase
    .from('questions')
    .update({ is_shareable })
    .eq('id', question_id)

  if (updateError) {
    return NextResponse.json({ error: 'Erro ao atualizar visibilidade' }, { status: 500 })
  }

  return NextResponse.json({ success: true, is_shareable })
}
