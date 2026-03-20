import { createClient } from '@supabase/supabase-js'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { getPlatformSettings, effectiveCreatorRate } from '@/lib/platform-settings'
import BanToggle from './BanToggle'
import RefundButton from './RefundButton'
import CreatorParamsForm from './CreatorParamsForm'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function AdminCreatorDetailPage({ params }: { params: { id: string } }) {
  const adminId = await requireAdmin()
  if (!adminId) redirect('/dashboard')

  const [{ data: profile }, { data: questions }, platformSettings] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, username, bio, avatar_url, min_price, daily_limit, questions_answered_today, is_active, created_at')
      .eq('id', params.id)
      .single(),
    supabaseAdmin
      .from('questions')
      .select('id, sender_name, content, price_paid, status, is_anonymous, created_at, answered_at')
      .eq('creator_id', params.id)
      .order('created_at', { ascending: false }),
    getPlatformSettings(),
  ])

  if (!profile) notFound()

  // Fetch new columns separately — graceful fallback if migration hasn't run yet
  let customCreatorRate: number | null = null
  let customDeadlineHours: number | null = null
  try {
    const { data: overrides } = await supabaseAdmin
      .from('profiles')
      .select('custom_creator_rate, custom_deadline_hours')
      .eq('id', params.id)
      .single()
    if (overrides) {
      customCreatorRate = overrides.custom_creator_rate ?? null
      customDeadlineHours = overrides.custom_deadline_hours ?? null
    }
  } catch {
    // Migration not yet applied — form will default to platform settings
  }

  const qs = questions ?? []

  const creatorRate = effectiveCreatorRate(platformSettings, customCreatorRate)
  const platformFeeRate = 1 - creatorRate

  const totalGross = qs
    .filter(q => q.status === 'answered')
    .reduce((sum, q) => sum + Number(q.price_paid), 0)
  const platformFee = totalGross * platformFeeRate
  const netEarnings = totalGross * creatorRate
  const answeredCount = qs.filter(q => q.status === 'answered').length
  const answerRate = qs.length > 0 ? Math.round((answeredCount / qs.length) * 100) : 0
  const avgPrice = answeredCount > 0 ? totalGross / answeredCount : 0

  const avatarUrl = profile.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`
  const joinedAt = new Date(profile.created_at).toLocaleDateString('pt-BR')

  const fmt = (n: number) =>
    `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const fmtPct = (r: number) => `${(r * 100).toFixed(1).replace(/\.0$/, '')}%`

  return (
    <div className="p-4 md:p-8">
      <Link href="/admin/creators" className="text-sm text-gray-400 hover:text-gray-700 mb-6 inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Voltar para Criadores
      </Link>

      {/* Creator header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <img src={avatarUrl} alt={profile.username} className="w-16 h-16 rounded-full object-cover" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">@{profile.username}</h1>
            {profile.bio && <p className="text-sm text-gray-500 mt-0.5 max-w-md">{profile.bio}</p>}
            <p className="text-xs text-gray-400 mt-1">Cadastro: {joinedAt}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile.is_active === false ? (
            <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500"></span> Banido
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-600 border border-green-200 text-xs font-semibold px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-500"></span> Ativo
            </span>
          )}
          <BanToggle creatorId={profile.id} isActive={profile.is_active !== false} username={profile.username} />
          <a
            href={`/perfil/${profile.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            Ver perfil público
          </a>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Receita Bruta</p>
          <p className="text-xl font-bold text-gray-900">{fmt(totalGross)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
            Líquido do Criador
            {customCreatorRate !== null && (
              <span className="ml-1 text-purple-600">(individual)</span>
            )}
          </p>
          <p className="text-xl font-bold text-green-600">{fmt(netEarnings)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Taxa ({fmtPct(platformFeeRate)}): {fmt(platformFee)}
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Taxa de Resposta</p>
          <p className="text-xl font-bold text-gray-900">{answerRate}%</p>
          <p className="text-xs text-gray-400 mt-0.5">{answeredCount} de {qs.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Ticket Médio</p>
          <p className="text-xl font-bold text-gray-900">{fmt(avgPrice)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Hoje: {profile.questions_answered_today}/{profile.daily_limit}</p>
        </div>
      </div>

      {/* Individual params form */}
      <CreatorParamsForm
        creatorId={profile.id}
        username={profile.username}
        customCreatorRate={customCreatorRate}
        customDeadlineHours={customDeadlineHours}
        platformSettings={platformSettings}
      />

      {/* Questions table */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Histórico de Perguntas ({qs.length})</h2>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Data</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fã</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Pergunta</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Valor</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {qs.map((q) => {
              const date = new Date(q.created_at).toLocaleDateString('pt-BR')
              const fanName = q.is_anonymous ? 'Anônimo' : q.sender_name
              return (
                <tr key={q.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-gray-400 whitespace-nowrap">{date}</td>
                  <td className="px-6 py-4 text-gray-600">{fanName}</td>
                  <td className="px-6 py-4 text-gray-700 max-w-xs truncate">{q.content}</td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {fmt(Number(q.price_paid))}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {q.status === 'answered' && (
                      <span className="bg-green-50 text-green-700 border border-green-200 text-xs font-semibold px-2 py-0.5 rounded-full">Respondida</span>
                    )}
                    {q.status === 'pending' && (
                      <span className="bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs font-semibold px-2 py-0.5 rounded-full">Pendente</span>
                    )}
                    {q.status === 'expired' && (
                      <span className="bg-red-50 text-red-700 border border-red-200 text-xs font-semibold px-2 py-0.5 rounded-full">Expirada</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {(q.status === 'expired' || q.status === 'pending') && (
                      <RefundButton questionId={q.id} />
                    )}
                  </td>
                </tr>
              )
            })}
            {qs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">Nenhuma pergunta encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
