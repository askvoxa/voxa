export const dynamic = 'force-dynamic'

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

  const nowUTC = new Date()
  const brtNow = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)
  const todayStartBRT = new Date(
    Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate()) + 3 * 60 * 60 * 1000
  )

  const [
    { data: approvedTx },
    { data: refundedTx },
    { count: pendingCount },
    { count: answeredCount },
    { count: expiredCount },
    { count: totalUsers },
    { count: totalInfluencers },
    { count: totalFans },
    { count: bannedCreators },
    { count: refundQueueCount },
    { count: pendingReportsCount },
    { count: pendingApprovalsCount },
    { data: creatorsRaw },
    { data: answeredRows },
  ] = await Promise.all([
    supabaseAdmin.from('transactions').select('amount, processing_fee, platform_fee, creator_net').eq('status', 'approved'),
    supabaseAdmin.from('transactions').select('amount').eq('status', 'refunded'),
    supabaseAdmin.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'answered'),
    supabaseAdmin.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'expired'),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).in('account_type', ['influencer', 'admin']),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('account_type', 'fan'),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', false),
    supabaseAdmin.from('refund_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('question_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending_review').eq('account_type', 'influencer'),
    supabaseAdmin
      .from('profiles')
      .select('id, username, avatar_url, is_active, account_type')
      .in('account_type', ['influencer', 'admin']),
    supabaseAdmin
      .from('questions')
      .select('creator_id')
      .eq('status', 'answered')
      .gte('answered_at', todayStartBRT.toISOString()),
  ])

  const answeredTodayMap = (answeredRows ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.creator_id] = (acc[r.creator_id] ?? 0) + 1
    return acc
  }, {})

  const creators = (creatorsRaw ?? [])
    .map(c => ({ ...c, answered_today: answeredTodayMap[c.id] ?? 0 }))
    .sort((a, b) => b.answered_today - a.answered_today)
    .slice(0, 20)

  // Financial (still need row data for sum — transactions table is small)
  const gmv = (approvedTx ?? []).reduce((sum, t) => sum + Number(t.amount), 0)
  const refundsTotal = (refundedTx ?? []).reduce((sum, t) => sum + Number(t.amount), 0)
  // Totais reais de taxas de processamento, receita da plataforma e repasse
  const totalProcessingFee = (approvedTx ?? []).reduce((sum, t) => sum + Number((t as any).processing_fee ?? 0), 0)
  const totalPlatformFee = (approvedTx ?? []).reduce((sum, t) => sum + Number((t as any).platform_fee ?? 0), 0)
  const totalCreatorNet = (approvedTx ?? []).reduce((sum, t) => sum + Number((t as any).creator_net ?? 0), 0)
  const feePct = `${(platformSettings.platform_fee_rate * 100).toFixed(1).replace(/\.0$/, '')}%`

  const totalQuestions = (pendingCount ?? 0) + (answeredCount ?? 0) + (expiredCount ?? 0)
  const answerRate = totalQuestions > 0 ? Math.round(((answeredCount ?? 0) / totalQuestions) * 100) : 0

  const fmt = (n: number) =>
    `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 md:mb-8">Visão Geral da Plataforma</h1>

      {/* Row 1: Financial */}
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Financeiro</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <MetricCard label="GMV Total" value={fmt(gmv)} sub="Pagamentos aprovados" />
        <MetricCard label={`Receita da Plataforma (${feePct})`} value={fmt(totalPlatformFee)} />
        <MetricCard label="Reembolsos Processados" value={fmt(refundsTotal)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <MetricCard label="Custo de Processamento MP" value={fmt(totalProcessingFee)} sub="Taxas pagas ao Mercado Pago" />
        <MetricCard label="Líquido a Pagar — Influenciadores" value={fmt(totalCreatorNet)} sub="Valor líquido acumulado" />
      </div>

      {/* Row 2: Activity */}
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Atividade</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
        <MetricCard label="Usuários" value={String(totalUsers ?? 0)} />
        <MetricCard label="Influencers" value={String(totalInfluencers ?? 0)} />
        <MetricCard label="Fãs" value={String(totalFans ?? 0)} />
        <MetricCard label="Perguntas Totais" value={String(totalQuestions)} />
        <MetricCard label="Taxa de Resposta" value={`${answerRate}%`} sub={`${answeredCount ?? 0} respondidas`} />
      </div>

      {/* Row 3: Operational */}
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Saúde Operacional</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        <MetricCard label="Fila de Reembolsos" value={String(refundQueueCount ?? 0)} sub="Aguardando processamento" />
        <MetricCard label="Perguntas Expiradas" value={String(expiredCount ?? 0)} sub={`Sem resposta em ${platformSettings.response_deadline_hours}h`} />
        <MetricCard label="Denúncias Pendentes" value={String(pendingReportsCount ?? 0)} sub="Aguardando moderação" />
        <MetricCard label="Usuários Banidos" value={String(bannedCreators ?? 0)} sub={`de ${totalUsers ?? 0} total`} />
        <Link href="/admin/approvals" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-[#DD2A7B]/30 transition-colors">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Aprovações Pendentes</p>
          <p className={`text-2xl font-bold ${(pendingApprovalsCount ?? 0) > 0 ? 'text-[#DD2A7B]' : 'text-gray-900'}`}>{String(pendingApprovalsCount ?? 0)}</p>
          <p className="text-xs text-[#DD2A7B] font-medium mt-1">Gerenciar →</p>
        </Link>
      </div>

      {/* Creators table */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Top Criadores</h2>
        <Link href="/admin/influencers" className="text-sm text-[#DD2A7B] font-medium hover:underline">
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
                  <td className="px-6 py-4 text-right text-gray-600">{creator.answered_today}</td>
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
                    <Link href={`/admin/influencers/${creator.id}`} className="text-[#DD2A7B] text-xs font-semibold hover:underline">
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
