import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const VALID_REASONS = ['offensive', 'harassment', 'spam', 'threat', 'other'] as const

// Rate limiting em memória: máximo 5 reports por criador a cada 10 minutos
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5
const reportTimestamps = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const timestamps = reportTimestamps.get(userId) ?? []
  // Limpar timestamps fora da janela
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) return false
  recent.push(now)
  reportTimestamps.set(userId, recent)
  return true
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Rate limiting por usuário
    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: 'Muitas denúncias em pouco tempo. Tente novamente mais tarde.' }, { status: 429 })
    }

    const body = await request.json()
    const { reason, reason_detail } = body

    if (!reason || !VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: 'Motivo inválido' }, { status: 400 })
    }

    // Verificar que a pergunta pertence ao criador e está pendente
    const { data: question, error: fetchError } = await supabase
      .from('questions')
      .select('id, creator_id, status')
      .eq('id', params.id)
      .single()

    if (fetchError || !question) {
      return NextResponse.json({ error: 'Pergunta não encontrada' }, { status: 404 })
    }

    if (question.creator_id !== user.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    if (question.status !== 'pending') {
      return NextResponse.json({ error: 'Apenas perguntas pendentes podem ser denunciadas' }, { status: 422 })
    }

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verificar se já existe report ativo para esta pergunta
    const { data: existingReport } = await supabaseAdmin
      .from('question_reports')
      .select('id')
      .eq('question_id', params.id)
      .in('status', ['pending_review', 'admin_approved'])
      .maybeSingle()

    if (existingReport) {
      return NextResponse.json({ error: 'Esta pergunta já foi denunciada' }, { status: 422 })
    }

    // Criar report e congelar pergunta
    const { data: report, error: insertError } = await supabaseAdmin
      .from('question_reports')
      .insert({
        question_id: params.id,
        creator_id: user.id,
        reason,
        reason_detail: reason_detail || null,
      })
      .select('id')
      .single()

    if (insertError || !report) {
      console.error('[report] Erro ao criar denúncia:', insertError)
      return NextResponse.json({ error: 'Erro ao criar denúncia' }, { status: 500 })
    }

    // Congelar pergunta (status = reported) — guard TOCTOU
    await supabaseAdmin
      .from('questions')
      .update({ status: 'reported' })
      .eq('id', params.id)
      .eq('status', 'pending')

    return NextResponse.json({ report_id: report.id })
  } catch (error: any) {
    console.error('POST /api/questions/[id]/report error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
