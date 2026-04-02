export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import ApprovalActions from './ApprovalActions'
import Link from 'next/link'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PAGE_SIZE = 20

function getPaginationPages(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]

  if (current > 3) pages.push('...')

  for (let p = Math.max(2, current - 2); p <= Math.min(total - 1, current + 2); p++) {
    pages.push(p)
  }

  if (current < total - 2) pages.push('...')

  pages.push(total)
  return pages
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams?: { tab?: string; page?: string }
}) {
  const adminId = await requireAdmin()
  if (!adminId) redirect('/dashboard')

  const activeTab = searchParams?.tab === 'history' ? 'history' : 'pending'
  const currentPage = Math.max(1, Number(searchParams?.page) || 1)

  // Pendentes — sempre buscado (badge de contagem + conteúdo da aba)
  const { data: pending } = await supabaseAdmin
    .from('profiles')
    .select('id, username, avatar_url, bio, social_link, created_at')
    .eq('approval_status', 'pending_review')
    .eq('account_type', 'influencer')
    .order('created_at', { ascending: true })

  const creatorIds = (pending ?? []).map(p => p.id)
  let nichesMap: Record<string, string[]> = {}

  if (creatorIds.length > 0) {
    const { data: creatorNiches } = await supabaseAdmin
      .from('creator_niches')
      .select('creator_id, niche_id, niches(label)')
      .in('creator_id', creatorIds)

    if (creatorNiches) {
      for (const cn of creatorNiches) {
        const label = (cn as any).niches?.label
        if (label) {
          if (!nichesMap[cn.creator_id]) nichesMap[cn.creator_id] = []
          nichesMap[cn.creator_id].push(label)
        }
      }
    }
  }

  // Histórico — só buscado quando a aba está ativa
  let history: any[] = []
  let totalHistory = 0

  if (activeTab === 'history') {
    const offset = (currentPage - 1) * PAGE_SIZE
    const { data, count } = await supabaseAdmin
      .from('profiles')
      .select(
        `id, username, avatar_url, approval_status, approval_reviewed_at, rejection_reason,
         reviewer:profiles!approval_reviewed_by(username)`,
        { count: 'exact' }
      )
      .in('approval_status', ['approved', 'rejected'])
      .not('approval_reviewed_at', 'is', null)
      .order('approval_reviewed_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    history = data ?? []
    totalHistory = count ?? 0
  }

  const totalPages = Math.ceil(totalHistory / PAGE_SIZE)
  const pendingCount = (pending ?? []).length

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Aprovações de Criadores</h1>

      {/* Abas */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <Link
          href="/admin/approvals"
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Pendentes
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
              {pendingCount}
            </span>
          )}
        </Link>
        <Link
          href="/admin/approvals?tab=history"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Histórico
        </Link>
      </div>

      {/* Aba: Pendentes */}
      {activeTab === 'pending' && (
        pendingCount === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-gray-400 text-lg mb-1">Nenhum criador aguardando aprovação</p>
            <p className="text-gray-400 text-sm">Novos cadastros aparecerão aqui.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(pending ?? []).map(creator => {
              const avatarUrl = creator.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.username}`
              const niches = nichesMap[creator.id] ?? []
              return (
                <div key={creator.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="flex items-start gap-4">
                    <img
                      src={avatarUrl}
                      alt={creator.username}
                      className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-bold text-gray-900">@{creator.username}</h2>
                        <span className="text-xs text-gray-400">
                          {new Date(creator.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      {creator.bio && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{creator.bio}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {niches.map(n => (
                          <span key={n} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                            {n}
                          </span>
                        ))}

                        {creator.social_link && (
                          <a
                            href={creator.social_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#DD2A7B] font-semibold hover:underline flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Ver rede social
                          </a>
                        )}
                      </div>

                      <ApprovalActions creatorId={creator.id} username={creator.username} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Aba: Histórico */}
      {activeTab === 'history' && (
        history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <p className="text-gray-400 text-lg mb-1">Nenhuma decisão registrada ainda</p>
            <p className="text-gray-400 text-sm">Aprovações e rejeições aparecerão aqui.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-4">
              {totalHistory} decisão{totalHistory !== 1 ? 'ões' : ''} registrada{totalHistory !== 1 ? 's' : ''}
            </p>

            <div className="space-y-3">
              {history.map(entry => {
                const avatarUrl = entry.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.username}`
                const isApproved = entry.approval_status === 'approved'
                const reviewerUsername = (entry.reviewer as any)?.username

                return (
                  <div key={entry.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start gap-4">
                      <img
                        src={avatarUrl}
                        alt={entry.username}
                        className="w-11 h-11 rounded-full object-cover border-2 border-gray-100 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-bold text-gray-900">@{entry.username}</span>
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                              Aprovado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                              Rejeitado
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-400">
                          {new Date(entry.approval_reviewed_at).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {reviewerUsername && (
                            <> · por @{reviewerUsername}</>
                          )}
                        </p>

                        {!isApproved && entry.rejection_reason && (
                          <p className="text-sm text-gray-600 mt-2 bg-red-50 rounded-lg px-3 py-2">
                            {entry.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-6">
                {currentPage > 1 && (
                  <Link
                    href={`/admin/approvals?tab=history&page=${currentPage - 1}`}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
                  >
                    ←
                  </Link>
                )}

                {getPaginationPages(currentPage, totalPages).map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-sm text-gray-400">…</span>
                  ) : (
                    <Link
                      key={p}
                      href={`/admin/approvals?tab=history&page=${p}`}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                        p === currentPage
                          ? 'bg-gray-900 text-white'
                          : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
                      }`}
                    >
                      {p}
                    </Link>
                  )
                )}

                {currentPage < totalPages && (
                  <Link
                    href={`/admin/approvals?tab=history&page=${currentPage + 1}`}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
                  >
                    →
                  </Link>
                )}
              </div>
            )}
          </>
        )
      )}
    </div>
  )
}
