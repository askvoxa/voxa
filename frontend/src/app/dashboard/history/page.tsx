import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import VisibilityToggle from './VisibilityToggle'
import BottomNav from '@/components/BottomNav'
import { CREATOR_NET_RATE } from '@/lib/constants'

// Revalidar dados a cada 30s — evita queries em cada request
export const revalidate = 30

type AnsweredQuestion = {
  id: string
  sender_name: string
  content: string
  price_paid: number
  service_type: string
  is_anonymous: boolean
  is_shareable: boolean
  response_text: string | null
  response_audio_url: string | null
  answered_at: string
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { periodo?: string; page?: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/setup')

  const periodo = searchParams.periodo ?? 'tudo'
  const page = Math.max(1, Number(searchParams.page ?? '1'))
  const pageSize = 20
  const offset = (page - 1) * pageSize

  // Filtro por período
  let dateFilter: string | null = null
  const now = new Date()
  if (periodo === 'semana') {
    const d = new Date(now)
    d.setDate(d.getDate() - 7)
    dateFilter = d.toISOString()
  } else if (periodo === 'mes') {
    const d = new Date(now)
    d.setMonth(d.getMonth() - 1)
    dateFilter = d.toISOString()
  }

  let query = supabase
    .from('questions')
    .select('id, sender_name, content, price_paid, service_type, is_anonymous, is_shareable, response_text, response_audio_url, answered_at', { count: 'exact' })
    .eq('creator_id', profile.id)
    .eq('status', 'answered')
    .order('answered_at', { ascending: false })

  if (dateFilter) {
    query = query.gte('answered_at', dateFilter)
  }

  query = query.range(offset, offset + pageSize - 1)

  const { data: questions, count } = await query.returns<AnsweredQuestion[]>()

  // Totais (sem paginação — para métricas)
  let totalQuery = supabase
    .from('questions')
    .select('price_paid', { count: 'exact' })
    .eq('creator_id', profile.id)
    .eq('status', 'answered')

  if (dateFilter) {
    totalQuery = totalQuery.gte('answered_at', dateFilter)
  }

  const { data: allAnswered } = await totalQuery

  const totalGrossEarnings = (allAnswered ?? []).reduce((sum, q) => sum + Number(q.price_paid), 0)
  const totalNetEarnings = totalGrossEarnings * CREATOR_NET_RATE
  const totalCount = count ?? 0
  const avgPerQuestion = totalCount > 0 ? totalNetEarnings / totalCount : 0
  const totalPages = Math.ceil(totalCount / pageSize)

  // Projeção mensal e comparativo semanal (sempre relativo a hoje, ignorando filtro de período)
  const last7DaysStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const prev7DaysStr = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const monthStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [{ data: currentWeekData }, { data: prevWeekData }, { data: monthData }] = await Promise.all([
    supabase.from('questions').select('price_paid')
      .eq('creator_id', profile.id).eq('status', 'answered').eq('is_support_only', false)
      .gte('answered_at', last7DaysStr),
    supabase.from('questions').select('price_paid')
      .eq('creator_id', profile.id).eq('status', 'answered').eq('is_support_only', false)
      .gte('answered_at', prev7DaysStr).lt('answered_at', last7DaysStr),
    supabase.from('questions').select('price_paid')
      .eq('creator_id', profile.id).eq('status', 'answered').eq('is_support_only', false)
      .gte('answered_at', monthStartStr),
  ])

  const currentWeekNet = (currentWeekData || []).reduce((s, q) => s + Number(q.price_paid) * CREATOR_NET_RATE, 0)
  const prevWeekNet = (prevWeekData || []).reduce((s, q) => s + Number(q.price_paid) * CREATOR_NET_RATE, 0)
  const weekDiff = currentWeekNet - prevWeekNet
  const dailyAvg = currentWeekNet / 7
  const monthToDate = (monthData || []).reduce((s, q) => s + Number(q.price_paid) * CREATOR_NET_RATE, 0)
  const daysRemaining = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
  const monthProjection = monthToDate + dailyAvg * daysRemaining

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="font-bold text-xl text-gradient-instagram">VOXA</h1>
          </div>
          <span className="text-sm text-gray-500">Histórico de Respostas</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-1">Total recebido (líquido)</p>
            <p className="text-3xl font-bold text-green-600">
              R$ {totalNetEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-1">Perguntas respondidas</p>
            <p className="text-3xl font-bold text-[#DD2A7B]">{totalCount}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-1">Média por resposta</p>
            <p className="text-3xl font-bold">
              R$ {avgPerQuestion.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Projeção mensal */}
        {dailyAvg > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100 rounded-2xl p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Projeção para este mês</p>
            <p className="text-2xl font-bold text-gray-900">
              R$ {monthProjection.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Se mantiver o ritmo dos últimos 7 dias
            </p>
            {weekDiff !== 0 && (
              <p className={`text-sm mt-2 font-medium ${weekDiff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {weekDiff > 0 ? '↑' : '↓'} R$ {Math.abs(weekDiff).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} vs semana passada
              </p>
            )}
          </div>
        )}

        {/* Entenda seus ganhos */}
        <details className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
          <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors">
            Entenda seus ganhos
          </summary>
          <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
            <p>
              O fã paga <span className="font-semibold text-gray-700">R$ 10,00</span> →
              Voxa retém 10% (<span className="text-gray-600">R$ 1,00</span>) →
              Você recebe <span className="font-bold text-green-600">R$ 9,00</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">Todos os valores exibidos já são líquidos.</p>
          </div>
        </details>

        {/* Filtros por período */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'semana', label: 'Esta semana' },
            { key: 'mes', label: 'Este mês' },
            { key: 'tudo', label: 'Tudo' },
          ].map(({ key, label }) => (
            <a
              key={key}
              href={`/dashboard/history?periodo=${key}`}
              className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                periodo === key
                  ? 'bg-gradient-instagram text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Lista */}
        {!questions || questions.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 shadow-sm border border-gray-100 text-center">
            <p className="text-4xl mb-4" role="img" aria-label="Caixa vazia">📭</p>
            <p className="text-xl font-bold text-gray-700">Nenhuma resposta {periodo !== 'tudo' ? 'neste período' : 'ainda'}</p>
            <p className="text-gray-400 mt-2">
              {periodo !== 'tudo'
                ? <a href="/dashboard/history?periodo=tudo" className="text-[#DD2A7B] underline">Ver todo o histórico</a>
                : 'Responda perguntas para ver seu histórico aqui.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map(q => (
              <div key={q.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm">
                      <span role="img" aria-label={q.is_anonymous ? 'Anônimo' : 'Usuário'}>{q.is_anonymous ? '👻' : '👤'}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-800">
                        {q.is_anonymous ? 'Anônimo' : q.sender_name}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(q.answered_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <VisibilityToggle questionId={q.id} initialVisible={q.is_shareable} />
                    <span className="text-green-600 font-bold bg-green-50 border border-green-200 px-2 py-1 rounded-lg text-sm">
                      +R$ {(Number(q.price_paid) * CREATOR_NET_RATE).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                <p className="text-gray-700 mb-3 leading-relaxed">&ldquo;{q.content}&rdquo;</p>

                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {q.response_audio_url && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500"><span role="img" aria-label="Microfone">🎙️</span> Resposta em áudio</span>
                      <audio controls src={q.response_audio_url} className="flex-1" preload="none" style={{ height: 32 }} />
                    </div>
                  )}
                  {q.response_text && !q.response_audio_url && (
                    <p className="text-gray-600 text-sm leading-relaxed">{q.response_text}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {page > 1 && (
              <a
                href={`/dashboard/history?periodo=${periodo}&page=${page - 1}`}
                aria-label="Página anterior"
                className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-gray-300"
              >
                ← Anterior
              </a>
            )}
            <span className="px-4 py-2 text-sm text-gray-500">
              Página {page} de {totalPages}
            </span>
            {page < totalPages && (
              <a
                href={`/dashboard/history?periodo=${periodo}&page=${page + 1}`}
                aria-label="Próxima página"
                className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-gray-300"
              >
                Próxima →
              </a>
            )}
          </div>
        )}
      </main>

      <BottomNav username={profile.username} />
    </div>
  )
}
