import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { Receipt } from 'lucide-react'

export default async function FanSpendingPage({
  searchParams,
}: {
  searchParams: { period?: string }
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

  // Criado dentro da função para garantir acesso às env vars no request time
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const period = searchParams.period ?? 'all'
  let dateFilter: string | null = null
  const now = new Date()
  if (period === 'week') {
    dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  } else if (period === 'month') {
    dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }

  let query = supabaseAdmin
    .from('questions')
    .select('id, content, price_paid, status, created_at, creator_id, is_support_only')
    .eq('sender_id', user.id)
    .order('created_at', { ascending: false })

  if (dateFilter) {
    query = query.gte('created_at', dateFilter)
  }

  const { data: questions, error: questionsError } = await query

  if (questionsError) {
    console.error('[fan/spending] erro ao buscar perguntas:', questionsError.message, '| user.id:', user.id)
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

  const totalSpent = (questions ?? []).reduce((sum: number, q: any) => sum + Number(q.price_paid), 0)
  const refundedCount = (questions ?? []).filter((q: any) => q.status === 'expired').length
  const refundedAmount = (questions ?? []).filter((q: any) => q.status === 'expired').reduce((sum: number, q: any) => sum + Number(q.price_paid), 0)

  const periodLabel = period === 'week' ? 'Última semana' : period === 'month' ? 'Último mês' : 'Todo o período'

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Meus Gastos</h1>
        <div className="flex gap-1">
          {['week', 'month', 'all'].map(p => (
            <a
              key={p}
              href={`/dashboard/spending?period=${p}`}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                period === p ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p === 'week' ? '7d' : p === 'month' ? '30d' : 'Tudo'}
            </a>
          ))}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Total gasto</p>
          <p className="text-2xl font-bold text-gray-800">
            R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">{periodLabel}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Perguntas</p>
          <p className="text-2xl font-bold text-gray-800">{(questions ?? []).length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Reembolsos</p>
          <p className="text-2xl font-bold text-red-600">
            R$ {refundedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">{refundedCount} pergunta{refundedCount !== 1 ? 's' : ''} expirada{refundedCount !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Tabela */}
      {(!questions || questions.length === 0) ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Nenhum gasto encontrado no período.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide px-5 py-3">Data</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide px-5 py-3">Criador</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide px-5 py-3">Valor</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {questions.map((q: any) => (
                <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {new Date(q.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-800 font-medium">
                    @{creatorMap.get(q.creator_id) ?? '...'}
                  </td>
                  <td className="px-5 py-3 text-sm font-bold text-gray-800">
                    R$ {Number(q.price_paid).toFixed(2).replace('.', ',')}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      q.status === 'answered' ? 'bg-green-100 text-green-700' :
                      q.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {q.status === 'answered' ? 'Respondida' : q.status === 'pending' ? 'Pendente' : 'Reembolsada'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
