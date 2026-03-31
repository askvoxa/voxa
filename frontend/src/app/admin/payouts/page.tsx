export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { supabaseAdmin } from '@/lib/supabase/admin'
import PayoutSettingsForm from './PayoutSettingsForm'
import PayoutPauseButton from './PayoutPauseButton'
import PayoutRetryButton from './PayoutRetryButton'
import BlockPayoutToggle from './BlockPayoutToggle'

const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-green-50 text-green-600 border-green-200',
  failed: 'bg-red-50 text-red-600 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  completed: 'Concluído',
  failed: 'Falhou',
}

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: { tab?: string; status?: string; page?: string }
}) {
  const adminId = await requireAdmin()
  if (!adminId) redirect('/dashboard')

  const tab = searchParams.tab ?? 'dashboard'
  const currentPage = Math.max(1, parseInt(searchParams.page ?? '1'))
  const perPage = 20

  // Dados compartilhados
  const { data: settings } = await supabaseAdmin
    .from('platform_settings')
    .select('payouts_paused')
    .eq('id', 1)
    .single()

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Payouts</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {(['dashboard', 'payouts', 'creators'] as const).map(t => (
          <a
            key={t}
            href={`/admin/payouts?tab=${t}`}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'dashboard' ? 'Dashboard' : t === 'payouts' ? 'Payouts' : 'Criadores'}
          </a>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab paused={settings?.payouts_paused ?? false} />}
      {tab === 'payouts' && <PayoutsTab statusFilter={searchParams.status} page={currentPage} perPage={perPage} />}
      {tab === 'creators' && <CreatorsTab page={currentPage} perPage={perPage} />}
    </div>
  )
}

// ===== Aba Dashboard =====
async function DashboardTab({ paused }: { paused: boolean }) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Dados resumo — usar RPC em vez de 3 queries (elimina N+1)
  const { data: summaryData, error: summaryError } = await supabaseAdmin
    .rpc('get_payout_summary', { p_week_ago: weekAgo })

  if (summaryError) {
    console.error('[admin/payouts] Erro ao buscar resumo:', summaryError.message)
  }

  const summary = summaryData?.[0] ?? { week_total: 0, pending_total: 0, failed_count: 0 }
  const weekTotal = Number(summary.week_total ?? 0)
  const pendingTotal = Number(summary.pending_total ?? 0)
  const failedCount = Number(summary.failed_count ?? 0)

  return (
    <div className="space-y-6">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pago esta semana</p>
          <p className="text-2xl font-bold text-gray-900">{fmtBRL(weekTotal)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pendente</p>
          <p className="text-2xl font-bold text-gray-900">{fmtBRL(pendingTotal)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Falhas ativas</p>
          <p className="text-2xl font-bold text-gray-900">{failedCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${
              paused ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${paused ? 'bg-red-500' : 'bg-green-500'}`} />
              {paused ? 'Pausado' : 'Ativo'}
            </span>
          </div>
        </div>
      </div>

      {/* Pausa global */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base text-gray-900">Controle Global</h2>
          <PayoutPauseButton initialPaused={paused} />
        </div>
      </div>

      {/* Configurações */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <h2 className="font-bold text-base text-gray-900 mb-4">Configurações de Payout</h2>
        <PayoutSettingsForm />
      </div>
    </div>
  )
}

// ===== Aba Payouts =====
async function PayoutsTab({ statusFilter, page, perPage }: { statusFilter?: string; page: number; perPage: number }) {
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabaseAdmin
    .from('payout_requests')
    .select(`
      id, creator_id, amount, status, mp_payout_id, failure_reason,
      retry_count, requested_at, processed_at,
      profiles!inner (username, avatar_url)
    `, { count: 'exact' })
    .order('requested_at', { ascending: false })
    .range(from, to)

  if (statusFilter) query = query.eq('status', statusFilter)

  const { data: payouts, count } = await query
  const totalPages = Math.ceil((count ?? 0) / perPage)

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {['', 'pending', 'processing', 'completed', 'failed'].map(s => (
          <a
            key={s}
            href={`/admin/payouts?tab=payouts${s ? `&status=${s}` : ''}`}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              (statusFilter ?? '') === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {s === '' ? 'Todos' : STATUS_LABEL[s]}
          </a>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Criador</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Valor</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Solicitado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Processado</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tentativas</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ação</th>
              </tr>
            </thead>
            <tbody>
              {(payouts ?? []).map((p: Record<string, unknown>) => {
                const profile = p.profiles as unknown as { username: string; avatar_url: string | null }
                return (
                  <tr key={p.id as string} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gray-200" />
                        )}
                        <span className="font-medium text-gray-900">@{profile.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {fmtBRL(Number(p.amount))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_BADGE[p.status as string]}`}>
                        {STATUS_LABEL[p.status as string]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(p.requested_at as string).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.processed_at ? new Date(p.processed_at as string).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {p.retry_count as number}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.status === 'failed' && (
                        <PayoutRetryButton payoutId={p.id as string} />
                      )}
                    </td>
                  </tr>
                )
              })}
              {(payouts ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Nenhum payout encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <a
              key={p}
              href={`/admin/payouts?tab=payouts${statusFilter ? `&status=${statusFilter}` : ''}&page=${p}`}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold ${
                p === page ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== Aba Criadores =====
async function CreatorsTab({ page, perPage }: { page: number; perPage: number }) {
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  const { data: creators, count } = await supabaseAdmin
    .from('profiles')
    .select('id, username, avatar_url, available_balance, payouts_blocked', { count: 'exact' })
    .eq('account_type', 'influencer')
    .order('available_balance', { ascending: false })
    .range(from, to)

  const totalCreators = count ?? 0
  const totalPages = Math.ceil(totalCreators / perPage)

  // Verificar quais têm chave PIX
  const creatorIds = (creators ?? []).map(c => c.id)
  const { data: pixKeys } = await supabaseAdmin
    .from('creator_pix_keys')
    .select('creator_id')
    .in('creator_id', creatorIds.length > 0 ? creatorIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('is_active', true)

  const pixKeySet = new Set((pixKeys ?? []).map(k => k.creator_id))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Criador</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Saldo</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Chave PIX</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Saques</th>
            </tr>
          </thead>
          <tbody>
            {(creators ?? []).map(c => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gray-200" />
                    )}
                    <span className="font-medium text-gray-900">@{c.username}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {fmtBRL(Number(c.available_balance ?? 0))}
                </td>
                <td className="px-4 py-3 text-center">
                  {pixKeySet.has(c.id) ? (
                    <span className="text-xs font-semibold text-green-600">Sim</span>
                  ) : (
                    <span className="text-xs text-gray-400">Não</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <BlockPayoutToggle creatorId={c.id} initialBlocked={c.payouts_blocked ?? false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação com windowing (L4: não renderiza todos os números) */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {/* Primeira página */}
          {page > 1 && (
            <a
              href="/admin/payouts?tab=creators&page=1"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            >
              1
            </a>
          )}

          {/* Reticências se houver gap > 1 */}
          {page > 3 && (
            <span className="w-8 h-8 flex items-center justify-center text-gray-400">...</span>
          )}

          {/* Janela de 5 páginas ao redor da página atual */}
          {Array.from(
            { length: Math.min(5, totalPages) },
            (_, i) => {
              const start = Math.max(2, page - 2)
              const end = Math.min(totalPages - 1, page + 2)
              const windowSize = end - start + 1
              const offset = Math.max(0, 5 - windowSize)
              return start + i - offset
            }
          )
            .filter((p) => p >= 2 && p <= totalPages - 1 && p > 0)
            .map((p) => (
              <a
                key={p}
                href={`/admin/payouts?tab=creators&page=${p}`}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold ${
                  p === page
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {p}
              </a>
            ))}

          {/* Reticências se houver gap > 1 */}
          {page < totalPages - 2 && (
            <span className="w-8 h-8 flex items-center justify-center text-gray-400">...</span>
          )}

          {/* Última página */}
          {page < totalPages && (
            <a
              href={`/admin/payouts?tab=creators&page=${totalPages}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            >
              {totalPages}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
