'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import QuestionList from './QuestionList'
import { CREATOR_NET_RATE } from '@/lib/constants'
import { computeMilestones, CreatorStats, Milestone } from '@/lib/milestones'
import MilestoneProgress from '@/components/milestones/MilestoneProgress'
import { MessageSquare, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { useDashboardContext } from './layout'

type Question = {
  id: string
  sender_name: string
  content: string
  price_paid: number
  service_type: string
  is_shareable: boolean
  is_anonymous: boolean
  created_at: string
  status: string
  transactions?: { creator_net: number | null }[]
}

type SentQuestion = {
  id: string
  content: string
  price_paid: number
  status: string
  created_at: string
  response_text: string | null
  response_audio_url: string | null
  creator: { username: string } | null
}

type ProfileData = {
  id: string
  username: string
  min_price: number
  daily_limit: number
  questions_answered_today: number
  account_type: string
  approval_status: string | null
  rejection_reason: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const ctx = useDashboardContext()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [sentQuestions, setSentQuestions] = useState<SentQuestion[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Se veio de um fluxo OAuth com returnUrl pendente, redirecionar de volta
    const pendingReturnUrl = sessionStorage.getItem('voxa_return_url')
    if (pendingReturnUrl) {
      sessionStorage.removeItem('voxa_return_url')
      if (pendingReturnUrl.startsWith('/') && !pendingReturnUrl.startsWith('//')) {
        router.push(pendingReturnUrl)
        return
      }
    }

    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, min_price, daily_limit, questions_answered_today, account_type, approval_status, rejection_reason')
        .eq('id', user.id)
        .single()

      if (!profileData) return
      setProfile(profileData)

      const isInfluencer = profileData.account_type === 'influencer' || profileData.account_type === 'admin'

      // Carregar dados do criador (se influencer)
      if (isInfluencer) {
        const [{ data: questionsData }, { data: statsData }] = await Promise.all([
          supabase
            .from('questions')
            .select('id, sender_name, content, price_paid, service_type, is_shareable, is_anonymous, created_at, status, transactions(creator_net)')
            .eq('creator_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('creator_stats')
            .select('*')
            .eq('creator_id', user.id)
            .single<CreatorStats>(),
        ])

        setQuestions(questionsData ?? [])
        setMilestones(computeMilestones(statsData ?? null))
      }

      // Carregar perguntas enviadas (para todos - fã e influencer no modo fã)
      const { data: sentData } = await supabase
        .from('questions')
        .select('id, content, price_paid, status, created_at, response_text, response_audio_url, creator_id')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      // Buscar usernames dos criadores
      if (sentData && sentData.length > 0) {
        const creatorIds = [...new Set(sentData.map((q: any) => q.creator_id))]
        const { data: creators } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', creatorIds)

        const creatorMap = new Map((creators ?? []).map((c: any) => [c.id, c.username]))
        setSentQuestions(sentData.map((q: any) => ({
          ...q,
          creator: creatorMap.has(q.creator_id) ? { username: creatorMap.get(q.creator_id)! } : null,
        })))
      }

      setIsLoading(false)
    }
    load()
  }, [router])

  if (isLoading || !profile) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        {[0, 1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-3" />
            <div className="h-16 w-full bg-gray-100 rounded-xl animate-pulse" />
          </div>
        ))}
      </main>
    )
  }

  const isInfluencer = profile.account_type === 'influencer' || profile.account_type === 'admin'
  const showCreatorView = isInfluencer && ctx?.dashboardMode === 'creator'

  // Creator metrics
  const pendingEarnings = questions.reduce((sum, q) => {
    const net = q.transactions?.[0]?.creator_net
    return sum + (net != null ? Number(net) : Number(q.price_paid) * CREATOR_NET_RATE)
  }, 0)
  const questionsLeft = Math.max(0, profile.daily_limit - profile.questions_answered_today - questions.length)

  // Fan metrics
  const sentPending = sentQuestions.filter(q => q.status === 'pending').length
  const totalSpent = sentQuestions.reduce((sum, q) => sum + Number(q.price_paid), 0)

  const isFan = profile.account_type === 'fan'
  const isPendingReview = profile.approval_status === 'pending_review'
  const isRejected = profile.approval_status === 'rejected'

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 w-full">

      {/* Banner: perfil em análise */}
      {isPendingReview && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-2xl">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-800">Seu perfil está em análise</p>
              <p className="text-sm text-yellow-700 mt-1">Nossa equipe está verificando seus dados. Assim que aprovado, seu perfil ficará disponível para receber perguntas.</p>
            </div>
          </div>
        </div>
      )}

      {/* Banner: perfil rejeitado */}
      {isRejected && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Seu perfil não foi aprovado</p>
              {profile.rejection_reason && (
                <p className="text-sm text-red-700 mt-1">Motivo: {profile.rejection_reason}</p>
              )}
              <a
                href="/setup/creator"
                className="inline-block mt-2 text-sm font-semibold text-red-600 hover:text-red-800 transition-colors"
              >
                Corrigir e reenviar →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* CTA: Quero ser criador (apenas para fans) */}
      {isFan && (
        <div className="bg-gradient-to-br from-[#DD2A7B]/10 via-[#4C1D95]/10 to-transparent border border-[#DD2A7B]/20 rounded-2xl p-6">
          <h2 className="font-bold text-lg text-gray-800 mb-1">Quer ganhar dinheiro respondendo perguntas?</h2>
          <p className="text-sm text-gray-500 mb-4">Crie seu perfil de criador e comece a monetizar sua audiência na VOXA.</p>
          <a
            href="/setup/creator"
            className="inline-flex items-center justify-center w-full min-h-[44px] bg-gradient-instagram text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Quero ser criador
          </a>
        </div>
      )}

      {showCreatorView ? (
        <>
          {/* ── MODO CRIADOR ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Pendentes</p>
              <p className="text-2xl font-bold text-gray-800">{questions.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">A receber</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {pendingEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">líquido após taxas</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Vagas hoje</p>
              <p className="text-2xl font-bold text-gray-800">{questionsLeft}<span className="text-sm text-gray-500 font-normal">/{profile.daily_limit}</span></p>
            </div>
          </div>

          <MilestoneProgress milestones={milestones} />

          <QuestionList
            questions={questions}
            creatorUsername={profile.username}
            creatorId={profile.id}
          />
        </>
      ) : (
        <>
          {/* ── MODO FÃ ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Enviadas</p>
              <p className="text-2xl font-bold text-gray-800">{sentQuestions.length}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Aguardando resposta</p>
              <p className="text-2xl font-bold text-yellow-600">{sentPending}</p>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Total gasto</p>
              <p className="text-2xl font-bold text-gray-800">
                R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Lista de perguntas enviadas */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-800">Suas perguntas</h2>
            {sentQuestions.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Você ainda não enviou nenhuma pergunta.</p>
                <p className="text-sm text-gray-400 mt-1">Encontre um criador e envie sua primeira pergunta!</p>
              </div>
            ) : (
              sentQuestions.map((q) => (
                <div key={q.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {q.status === 'answered' && <CheckCircle className="w-4 h-4 text-green-500" />}
                      {q.status === 'pending' && <Clock className="w-4 h-4 text-yellow-500" />}
                      {q.status === 'expired' && <AlertCircle className="w-4 h-4 text-red-500" />}
                      {q.status === 'rejected' && <AlertCircle className="w-4 h-4 text-orange-500" />}
                      {q.status === 'reported' && <Clock className="w-4 h-4 text-gray-400" />}
                      <span className="text-xs font-medium text-gray-500">
                        Para @{q.creator?.username ?? 'desconhecido'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-500">
                      R$ {Number(q.price_paid).toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 mb-2 line-clamp-2">{q.content}</p>
                  {q.status === 'answered' && q.response_text && (
                    <div className="bg-gray-50 rounded-xl p-3 mt-2">
                      <p className="text-xs text-gray-500 mb-1 font-medium">Resposta:</p>
                      <p className="text-sm text-gray-700 line-clamp-3">{q.response_text}</p>
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
                      q.status === 'rejected' ? 'bg-orange-100 text-orange-700' :
                      q.status === 'reported' ? 'bg-gray-100 text-gray-600' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {q.status === 'answered' ? 'Respondida' :
                       q.status === 'pending' ? 'Pendente' :
                       q.status === 'rejected' ? 'Recusada' :
                       q.status === 'reported' ? 'Em análise' :
                       'Expirada (reembolso)'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </main>
  )
}
