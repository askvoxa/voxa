import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { CheckCircle, Clock, AlertCircle, MessageSquare } from 'lucide-react'

// Client service role — usado server-side para leitura das perguntas do fã.
// O JWT do usuário não é encaminhado corretamente pelo @supabase/ssr em Server Components
// aninhados, então usamos service role com filtro explícito por user.id validado.
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function FanQuestionsPage({
  searchParams,
}: {
  searchParams: { page?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, account_type')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/setup')

  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const perPage = 20
  const offset = (page - 1) * perPage

  const { data: questions, count, error: questionsError } = await supabaseAdmin
    .from('questions')
    .select('id, content, price_paid, status, created_at, response_text, response_audio_url, creator_id, is_support_only', { count: 'exact' })
    .eq('sender_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (questionsError) {
    console.error('[fan/questions] erro ao buscar perguntas:', questionsError.message, '| user.id:', user.id)
  }

  // Buscar usernames dos criadores (profiles é pública — client autenticado é suficiente)
  const creatorIds = [...new Set((questions ?? []).map((q: any) => q.creator_id))]
  let creatorMap = new Map<string, string>()
  if (creatorIds.length > 0) {
    const { data: creators } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', creatorIds)
    creatorMap = new Map((creators ?? []).map((c: any) => [c.id, c.username]))
  }

  const totalPages = Math.ceil((count ?? 0) / perPage)

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 w-full">
      <h1 className="text-2xl font-bold text-gray-800">Meu Histórico</h1>

      {(!questions || questions.length === 0) ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Você ainda não enviou nenhuma pergunta.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q: any) => (
            <div key={q.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {q.status === 'answered' && <CheckCircle className="w-4 h-4 text-green-500" />}
                  {q.status === 'pending' && <Clock className="w-4 h-4 text-yellow-500" />}
                  {q.status === 'expired' && <AlertCircle className="w-4 h-4 text-red-500" />}
                  <span className="text-xs font-medium text-gray-500">
                    Para @{creatorMap.get(q.creator_id) ?? 'desconhecido'}
                  </span>
                  {q.is_support_only && (
                    <span className="text-xs bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full font-medium">Apoio</span>
                  )}
                </div>
                <span className="text-xs font-bold text-gray-500">
                  R$ {Number(q.price_paid).toFixed(2).replace('.', ',')}
                </span>
              </div>

              <p className="text-sm text-gray-800 mb-2">{q.content}</p>

              {q.status === 'answered' && q.response_text && (
                <div className="bg-gray-50 rounded-xl p-3 mt-2">
                  <p className="text-xs text-gray-500 mb-1 font-medium">Resposta:</p>
                  <p className="text-sm text-gray-700">{q.response_text}</p>
                </div>
              )}

              {q.status === 'answered' && q.response_audio_url && (
                <div className="mt-2">
                  <audio controls src={q.response_audio_url} className="w-full" preload="none" />
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">
                  {new Date(q.created_at).toLocaleDateString('pt-BR')}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  q.status === 'answered' ? 'bg-green-100 text-green-700' :
                  q.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {q.status === 'answered' ? 'Respondida' : q.status === 'pending' ? 'Pendente' : 'Expirada'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          {page > 1 && (
            <a href={`/dashboard/questions?page=${page - 1}`} className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              Anterior
            </a>
          )}
          <span className="px-4 py-2 text-sm text-gray-500">{page} / {totalPages}</span>
          {page < totalPages && (
            <a href={`/dashboard/questions?page=${page + 1}`} className="px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              Próxima
            </a>
          )}
        </div>
      )}
    </div>
  )
}
