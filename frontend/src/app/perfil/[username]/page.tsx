import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import QuestionForm from './QuestionForm'
import AnswerFeedback from './AnswerFeedback'
import PerfilAnalytics from './PerfilAnalytics'
import TopSupporters from './TopSupporters'
import { RESPONSE_DEADLINE_HOURS } from '@/lib/constants'
import { computeMilestones, CreatorStats } from '@/lib/milestones'
import { SupporterRow } from '@/lib/supporters'
import MilestoneBadgeRow from '@/components/milestones/MilestoneBadgeRow'
import MilestoneSection from '@/components/milestones/MilestoneSection'

type Profile = {
  id: string
  username: string
  bio: string | null
  avatar_url: string | null
  min_price: number
  daily_limit: number
  questions_answered_today: number
  is_active: boolean | null
  fast_ask_suggestions?: Array<{ label: string; question: string; amount: number }>
}

type PublicAnswer = {
  id: string
  sender_name: string
  content: string
  service_type: string
  is_anonymous: boolean
  price_paid: number
  response_text: string | null
  response_audio_url: string | null
  answered_at: string | null
}

const DEMO_PROFILE: Profile = {
  id: 'demo',
  username: 'exemplo',
  bio: 'Criadora de conteúdo fitness 💪 | Nutricionista e personal trainer. Respondendo suas dúvidas sobre treino, dieta e saúde.',
  avatar_url: null,
  min_price: 15,
  daily_limit: 20,
  questions_answered_today: 3,
  is_active: true,
}

const DEMO_STATS: CreatorStats = {
  creator_id: 'demo',
  total_answered: 127,
  total_received: 130,
  total_expired: 3,
  current_streak: 14,
  max_streak: 14,
  last_active_date: new Date().toISOString().split('T')[0],
  avg_response_seconds: 4 * 3600,
  soldout_days_last30: 8,
  marathon_count: 3,
}

const DEMO_SUPPORTERS: SupporterRow[] = [
  {
    display_name: 'Maria Silva',
    is_anonymous: false,
    total_paid: 125.0,
    email_hash: '5d41402abc4b2a76b9719d911017c592',
  },
  {
    display_name: 'João Santos',
    is_anonymous: false,
    total_paid: 90.0,
    email_hash: '6512bd43d9caa6e02c990b0a82652dca',
  },
  {
    display_name: 'unknown',
    is_anonymous: true,
    total_paid: 75.5,
    email_hash: 'c20ad4d76fe97759aa27a0c99bff6710',
  },
  {
    display_name: 'Ana Costa',
    is_anonymous: false,
    total_paid: 55.0,
    email_hash: 'c4ca4238a0b923820dcc509a6f75849b',
  },
  {
    display_name: 'unknown',
    is_anonymous: true,
    total_paid: 40.0,
    email_hash: 'a87ff679a2f3e71d9181a67b7542122c',
  },
]

const DEMO_ANSWERS: PublicAnswer[] = [
  {
    id: '1',
    sender_name: 'João',
    content: 'Qual é a melhor proteína para quem está começando na academia?',
    service_type: 'base',
    is_anonymous: false,
    price_paid: 25,
    response_text: 'Para iniciantes, o Whey Concentrado é a melhor escolha custo-benefício. Consuma 1 dose logo após o treino com água ou leite desnatado. Priorize marcas com pelo menos 20g de proteína por porção.',
    response_audio_url: null,
    answered_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: '2',
    sender_name: 'Anônimo',
    content: 'Como perder gordura abdominal sem perder massa muscular?',
    service_type: 'base',
    is_anonymous: true,
    price_paid: 40,
    response_text: 'O segredo é déficit calórico moderado (300–500 kcal) mantendo proteína alta (2g/kg de peso). Combine treino de força com cardio leve. Evite dietas muito restritivas que quebram músculo.',
    response_audio_url: null,
    answered_at: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
]

function AnswerFeed({ publicAnswers, avatarUrl, displayName }: { publicAnswers: PublicAnswer[], avatarUrl: string, displayName: string }) {
  return (
    <div className="w-full max-w-2xl mt-16 px-2">
      <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
        <svg className="w-6 h-6 text-[#DD2A7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        Respostas Recentes
      </h3>
      <div className="space-y-6">
        {publicAnswers.map((item) => (
          <div key={item.id} className="bg-[#111] rounded-[24px] p-6 border border-white/5 shadow-sm hover:border-white/10 transition-colors">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1a1a1a] rounded-full flex items-center justify-center text-lg shadow-inner">
                  <span role="img" aria-label={item.is_anonymous ? 'Anônimo' : 'Usuário'}>{item.is_anonymous ? '👻' : '👤'}</span>
                </div>
                <div>
                  <p className="font-bold text-white text-sm">
                    {item.is_anonymous ? 'Usuário Anônimo' : item.sender_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.service_type === 'premium' ? <><span role="img" aria-label="Vídeo">🎥</span> Vídeo</> : item.service_type === 'support' ? <><span role="img" aria-label="Apoio">❤️</span> Apoio</> : <><span role="img" aria-label="Mensagem">💬</span> Resposta Base</>}
                  </p>
                </div>
              </div>
              <span className="text-green-400 font-bold bg-[#16A34A]/10 border border-green-500/20 px-2 py-1 rounded-lg text-xs">
                R$ {Number(item.price_paid).toFixed(2).replace('.', ',')}
              </span>
            </div>

            <p className="text-gray-300 text-lg font-medium mb-4 leading-relaxed">
              &ldquo;{item.content}&rdquo;
            </p>

            <div className="bg-[#1a1a1a] shadow-inner rounded-2xl p-4 border border-white/5 mb-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-gradient-instagram p-[1px]">
                  <img className="w-full h-full rounded-full object-cover" src={avatarUrl} alt="Creator" />
                </div>
                <span className="text-xs font-bold text-gray-500">{displayName} respondeu:</span>
              </div>

              {item.response_audio_url && (
                <audio controls src={item.response_audio_url} className="w-full mt-1" preload="none" />
              )}

              {item.response_text && !item.response_audio_url && (
                <p className="text-gray-200 text-sm leading-relaxed">{item.response_text}</p>
              )}
            </div>

            {/* Sistema de avaliação */}
            <AnswerFeedback answerId={item.id} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default async function PerfilPage({
  params,
  searchParams,
}: {
  params: { username: string }
  searchParams: { payment_status?: string; payment_id?: string }
}) {
  const paymentStatus = searchParams.payment_status ?? null
  const paymentId = searchParams.payment_id ?? null

  // Perfil de demonstração — não requer banco de dados
  if (params.username === 'exemplo') {
    const profile = DEMO_PROFILE
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=exemplo`
    const displayName = `@${profile.username}`
    const demoMilestones = computeMilestones(DEMO_STATS)

    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center py-12 px-4 sm:px-6 relative">
        <a href="/dashboard" className="fixed top-4 left-4 z-50 p-2 md:p-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-white/20 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </a>
        <div className="w-full max-w-lg bg-[#12121A] rounded-[14px] shadow-2xl border border-white/7 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-[250px] h-[250px] md:w-[400px] md:h-[400px] bg-[#DD2A7B] opacity-8 blur-[60px] md:blur-[100px] rounded-full pointer-events-none -mt-16 sm:-mt-32 -mr-16 sm:-mr-32"></div>
          <div className="h-32 bg-gradient-to-br from-[#DD2A7B]/80 via-[#4C1D95]/60 to-[#12121A] relative">
            <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 rounded-full p-1 bg-[#12121A] hover:scale-105 transition-transform duration-200">
              <img className="w-24 h-24 rounded-full border-4 border-[#12121A] object-cover" src={avatarUrl} alt={displayName} />
            </div>
          </div>
          <div className="pt-16 pb-8 px-8 text-center border-b border-white/5 relative z-10">
            <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1 rounded-full text-xs text-yellow-400 font-semibold mb-3">
              ✨ Perfil de demonstração
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">{displayName}</h1>
            {profile.bio && <p className="text-[#9CA3AF] text-sm mb-4 leading-relaxed">{profile.bio}</p>}
            <div className="flex justify-center mb-3">
              <MilestoneBadgeRow milestones={demoMilestones} size="md" />
            </div>
            <div className="inline-flex items-center gap-1.5 bg-[#DD2A7B]/10 border border-[#DD2A7B]/20 px-3 py-1 rounded-full text-xs font-semibold text-[#F77737]">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Aceitando perguntas hoje (17/20)
            </div>
          </div>
          <QuestionForm
            username={profile.username}
            minPrice={profile.min_price}
            avatarUrl={avatarUrl}
            displayName={displayName}
            disabled={true}
          />
        </div>
        <MilestoneSection milestones={demoMilestones} />
        <TopSupporters supporters={DEMO_SUPPORTERS} />
        <AnswerFeed publicAnswers={DEMO_ANSWERS} avatarUrl={avatarUrl} displayName={displayName} />
      </div>
    )
  }

  const supabase = createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, bio, avatar_url, min_price, daily_limit, questions_answered_today, is_active, fast_ask_suggestions')
    .eq('username', params.username)
    .single<Profile>()

  if (!profile) notFound()

  if (profile.is_active === false) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center">
          <p className="text-4xl mb-4" role="img" aria-label="Indisponível">🚫</p>
          <h1 className="text-xl font-bold text-white mb-2">Perfil indisponível</h1>
          <p className="text-[#9CA3AF] text-sm">Esta conta foi desativada.</p>
          <a href="/" className="inline-flex min-h-[44px] items-center p-2 mt-6 text-sm text-[#6B7280] hover:text-white transition-colors">
            ← Voltar para a página inicial
          </a>
        </div>
      </div>
    )
  }

  const [{ data: publicAnswers }, { data: statsData }, { data: topSupporters }] = await Promise.all([
    supabase
      .from('questions')
      .select('id, sender_name, content, service_type, is_anonymous, price_paid, response_text, response_audio_url, answered_at')
      .eq('creator_id', profile.id)
      .eq('status', 'answered')
      .eq('is_shareable', true)
      .eq('is_support_only', false)
      .order('answered_at', { ascending: false })
      .limit(10)
      .returns<PublicAnswer[]>(),
    supabase
      .from('creator_stats')
      .select('*')
      .eq('creator_id', profile.id),
    supabase.rpc('get_top_supporters', { p_creator_id: profile.id }).returns<SupporterRow[]>(),
  ])

  const milestones = computeMilestones(statsData?.[0] ?? null)
  const stats = statsData?.[0]
  const responseRate = stats && stats.total_received >= 5
    ? Math.round((stats.total_answered / stats.total_received) * 100)
    : null
  const questionsLeft = Math.max(0, profile.daily_limit - profile.questions_answered_today)
  const avatarUrl = profile.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`
  const displayName = `@${profile.username}`

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center py-12 px-4 sm:px-6 relative">
      <a href="/dashboard" className="fixed top-4 left-4 z-50 p-2 md:p-3 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-white hover:bg-white/20 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]" style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </a>
      <div className="w-full max-w-lg bg-[#12121A] rounded-[14px] shadow-2xl border border-white/7 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[250px] h-[250px] md:w-[400px] md:h-[400px] bg-[#DD2A7B] opacity-8 blur-[60px] md:blur-[100px] rounded-full pointer-events-none -mt-16 sm:-mt-32 -mr-16 sm:-mr-32"></div>

        {/* Header do criador */}
        <div className="h-32 bg-gradient-to-br from-[#DD2A7B]/80 via-[#4C1D95]/60 to-[#12121A] relative">
          <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 rounded-full p-1 bg-[#12121A] hover:scale-105 transition-transform duration-200">
            <img
              className="w-24 h-24 rounded-full border-4 border-[#12121A] object-cover"
              src={avatarUrl}
              alt={displayName}
            />
          </div>
        </div>

        <div className="pt-16 pb-8 px-8 text-center border-b border-white/5 relative z-10">
          <h1 className="text-2xl font-bold text-white mb-1">{displayName}</h1>
          {profile.bio && (
            <p className="text-[#9CA3AF] text-sm mb-4 leading-relaxed">{profile.bio}</p>
          )}
          {responseRate !== null && (
            <div className="flex items-center justify-center gap-1.5 text-sm mb-3">
              <span className={responseRate >= 90 ? 'text-green-400' : responseRate >= 75 ? 'text-yellow-400' : 'text-red-400'}>
                ●
              </span>
              <span className="text-gray-500">Responde {responseRate}% das perguntas</span>
            </div>
          )}
          {milestones.some(m => m.tier !== null) && (
            <div className="flex justify-center mb-3">
              <MilestoneBadgeRow milestones={milestones} size="md" />
            </div>
          )}
          {questionsLeft > 0 ? (
            <div className="inline-flex items-center gap-1.5 bg-[#DD2A7B]/10 border border-[#DD2A7B]/20 px-3 py-1 rounded-full text-xs font-semibold text-[#F77737]">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Aceitando perguntas hoje ({questionsLeft}/{profile.daily_limit})
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-semibold text-gray-500">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Limite diário atingido — volte amanhã
            </div>
          )}
        </div>

        {/* Banner de retorno do Mercado Pago */}
        {paymentStatus === 'approved' && (
          <div className="mx-6 mt-6 p-4 bg-[#16A34A]/10 border border-green-500/30 rounded-2xl text-center">
            <p className="text-green-400 font-bold text-sm">✓ Pagamento aprovado!</p>
            <p className="text-gray-500 text-xs mt-1">Sua pergunta foi enviada para o criador. Você receberá a resposta em até {RESPONSE_DEADLINE_HOURS} horas.</p>
          </div>
        )}
        {paymentStatus === 'pending' && (
          <div className="mx-6 mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl text-center">
            <p className="text-yellow-400 font-bold text-sm">⏳ Pagamento em processamento</p>
            <p className="text-gray-500 text-xs mt-1">Se pagou via PIX, pode levar até 5 minutos para confirmar. Sua pergunta será enviada automaticamente assim que o pagamento for aprovado.</p>
          </div>
        )}
        {paymentStatus === 'failure' && (
          <div className="mx-6 mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-center">
            <p className="text-red-400 font-bold text-sm">✗ Pagamento não aprovado</p>
            <p className="text-gray-500 text-xs mt-1">Tente novamente com outro método de pagamento.</p>
          </div>
        )}

        <PerfilAnalytics
          creatorUsername={profile.username}
          minPrice={profile.min_price}
          paymentStatus={paymentStatus}
          paymentId={paymentId}
        />

        {/* Formulário interativo (Client Component) */}
        <QuestionForm
          username={profile.username}
          minPrice={profile.min_price}
          avatarUrl={avatarUrl}
          displayName={displayName}
          disabled={questionsLeft === 0}
          fastAskSuggestions={profile.fast_ask_suggestions}
        />
      </div>

      {/* Conquistas */}
      <MilestoneSection milestones={milestones} />

      {/* Top Apoiadores do Mês */}
      <TopSupporters supporters={(topSupporters as SupporterRow[]) ?? []} />

      {/* Feed de respostas públicas */}
      {publicAnswers && publicAnswers.length > 0 ? (
        <AnswerFeed publicAnswers={publicAnswers} avatarUrl={avatarUrl} displayName={displayName} />
      ) : (
        <div className="w-full max-w-2xl mt-12 px-4 text-center">
          <p className="text-[#6B7280] text-sm">Ainda não há respostas públicas neste perfil.</p>
        </div>
      )}
    </div>
  )
}
