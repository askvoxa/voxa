export const dynamic = 'force-dynamic'

import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import VerifiedBadge from '@/components/VerifiedBadge'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function AdminCreatorsPage() {
  const adminId = await requireAdmin()
  if (!adminId) redirect('/dashboard')

  const nowUTC = new Date()
  const brtNow = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000)
  const todayStartBRT = new Date(
    Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate()) + 3 * 60 * 60 * 1000
  )

  const [{ data: creatorsRaw }, { data: answeredRows }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, username, avatar_url, is_active, is_verified, min_price, created_at')
      .in('account_type', ['influencer', 'admin'])
      .order('created_at', { ascending: false }),
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

  const creators = (creatorsRaw ?? []).map(c => ({
    ...c,
    answered_today: answeredTodayMap[c.id] ?? 0,
  }))

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Influenciadores</h1>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Criador</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Preço mínimo</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Respondidas hoje</th>
              <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cadastro</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(creators ?? []).map((creator) => {
              const avatarUrl = creator.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.username}`
              const joinedAt = new Date(creator.created_at).toLocaleDateString('pt-BR')
              return (
                <tr key={creator.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={avatarUrl} alt={creator.username} className="w-8 h-8 rounded-full object-cover" />
                      <span className="font-medium text-gray-900 flex items-center gap-1">@{creator.username} <VerifiedBadge isVerified={!!creator.is_verified} size="sm" /></span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    R$ {Number(creator.min_price).toFixed(2).replace('.', ',')}
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
                  <td className="px-6 py-4 text-gray-500">{joinedAt}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/influencers/${creator.id}`} className="text-[#DD2A7B] text-xs font-semibold hover:underline">
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              )
            })}
            {(creators ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500 text-sm">Nenhum criador cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
