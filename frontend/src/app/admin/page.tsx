import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { getPlatformSettings } from '@/lib/platform-settings'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default async function AdminPage() {
  // Defense in depth: verify admin beyond middleware
  const adminId = await requireAdmin()
  if (!adminId) redirect('/dashboard')

  const platformSettings = await getPlatformSettings()

  const [
    { data: approvedTx },
    { data: refundedTx },
    { count: pendingCount },
    { count: answeredCount },
    { count: expiredCount },
    { count: totalCreators },
    { count: bannedCreators },
    { count: refundQueueCount },
    { data: creators },
  ] = await Promise.all([
    supabaseAdmin.from('transactions').select('amount').eq('status', 'approved'),
    supabaseAdmin.from('transactions').select('amount').eq('status', 'refunded'),
    supabaseAdmin.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'answered'),
    supabaseAdmin.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', false),
    supabaseAdmin.from('refund_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin
      .from('profiles')
      .select('id, username, avatar_url, is_active, questions_answered_today')
      .order('questions_answered_today', { ascending: false })
      .limit(20),
  ])

  // Financial (still need row data for sum — transactions table is small)
  const gmv = (approvedTx ?? []).reduce((sum, t) => sum + Number(t.amount), 0)
  const fees = gmv * platformSettings.platform_fee_rate
  const feePct = `${(platformSettings.platform_fee_rate * 100).toFixed(1).replace(/\.0$/, '')}%`
  const refundsTotal = (refundedTx ?? []).reduce((sum, t) => sum + Number(t.amount), 0)

  const totalQuestions = (pendingCount ?? 0) + (answeredCount ?? 0) + (expiredCount ?? 0)
  const answerRate = totalQuestions > 0 ? Math.round(((answeredCount ?? 0) / totalQuestions) * 100) : 0

  const fmt = (n: number) =>
    `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const cronDisabled = process.env.FEATURE_REFUNDS_ENABLED !== 'true'

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 md:mb-8">Visão Geral da Plataforma</h1>

      {/* Alerta operacional: cron jobs desabilitados */}
      {cronDisabled && (
        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <span className="text-amber-500 text-lg leading-none mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Cron jobs desabilitados</p>
            <p className="text-xs text-amber-700 mt-0.5">
              O reset diário de limites (<code className="font-mono">questions_answered_today</code>) e a expiração automática de perguntas não estão rodando.
              Criadores podem travar no limite diário após o primeiro dia.{' '}
              <Link href="/admin/settings" className="underline font-medium">Configure pg_cron ou chame o endpoint manualmente.</Link>
            </p>
          </div>
        </div>
      )}

      {/* Row 1: Financial */}
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Financeiro</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <MetricCard label="GMV Total" value={fmt(gmv)} sub="Pagamentos aprovados" />
        <MetricCard label={`Receita da Plataforma (${feePct})`} value={fmt(fees)} />
        <MetricCard label="Reembolsos Processados" value={fmt(refundsTotal)} />
      </div>

      {/* Row 2: Activity */}
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Atividade</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Criadores" value={String(totalCreators ?? 0)} />
        <MetricCard label="Perguntas Totais" value={String(totalQuestions)} />
        <MetricCard label="Taxa de Resposta" value={`${answerRate}%`} sub={`${answeredCount ?? 0} respondidas`} />
        <MetricCard label="Perguntas Pendentes" value={String(pendingCount ?? 0)} />
      </div>

      {/* Row 3: Operational */}
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Saúde Operacional</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <MetricCard label="Fila de Reembolsos" value={String(refundQueueCount ?? 0)} sub="Aguardando processamento" />
        <MetricCard label="Perguntas Expiradas" value={String(expiredCount ?? 0)} sub={`Sem resposta em ${platformSettings.response_deadline_hours}h`} />
        <MetricCard label="Criadores Banidos" value={String(bannedCreators ?? 0)} sub={`de ${totalCreators ?? 0} total`} />
      </div>

      {/* Creators table */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Top Criadores</h2>
        <Link href="/admin/creators" className="text-sm text-[#DD2A7B] font-medium hover:underline">
          Ver todos
        </Link>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Criador</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Respondidas hoje</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(creators ?? []).map((creator) => {
              const avatarUrl = creator.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.username}`
              return (
                <tr key={creator.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={avatarUrl} alt={creator.username} className="w-8 h-8 rounded-full object-cover" />
                      <span className="font-medium text-gray-900">@{creator.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">{creator.questions_answered_today}</td>
                  <td className="px-6 py-4 text-center">
                    {creator.is_active === false ? (
                      <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Banido
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 border border-green-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span> Ativo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/creators/${creator.id}`} className="text-[#DD2A7B] text-xs font-semibold hover:underline">
                      Ver
                    </Link>
                  </td>
                </tr>
              )
            })}
            {(creators ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500 text-sm">Nenhum criador cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
