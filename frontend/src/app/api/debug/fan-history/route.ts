import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ENDPOINT DE DIAGNÓSTICO — remover após resolver o bug
// Acesse /api/debug/fan-history enquanto autenticado para ver o estado real

export async function GET() {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado', authError })
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Query com service role — mesmo código que questions/page.tsx usa
  const { data: questions, count, error: queryError } = await supabaseAdmin
    .from('questions')
    .select('id, status, sender_id, creator_id, created_at', { count: 'exact' })
    .eq('sender_id', user.id)

  // Query sem filtro para ver TODOS os sender_ids únicos no banco (confirmar que o UUID bate)
  const { data: expiredSample } = await supabaseAdmin
    .from('questions')
    .select('id, status, sender_id')
    .eq('status', 'expired')
    .limit(5)

  return NextResponse.json({
    auth: {
      user_id: user.id,
      email: user.email,
    },
    query_result: {
      count,
      error: queryError,
      first_5: questions?.slice(0, 5),
    },
    expired_questions_sample: expiredSample,
    env_check: {
      has_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
  })
}
