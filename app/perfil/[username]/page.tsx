import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import QuestionForm from './QuestionForm'

type Profile = {
  id: string
  username: string
  bio: string | null
  avatar_url: string | null
  min_price: number
  daily_limit: number
  questions_answered_today: number
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

export default async function PerfilPage({
  params,
  searchParams,
}: {
  params: { username: string }
  searchParams: { payment_status?: string }
}) {
  const paymentStatus = searchParams.payment_status
  const supabase = createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, bio, avatar_url, min_price, daily_limit, questions_answered_today')
    .eq('username', params.username)
    .single<Profile>()

  if (!profile) notFound()

  const { data: publicAnswers } = await supabase
    .from('questions')
    .select('id, sender_name, content, service_type, is_anonymous, price_paid, response_text, response_audio_url, answered_at')
    .eq('creator_id', profile.id)
    .eq('status', 'answered')
    .eq('is_shareable', true)
    .order('answered_at', { ascending: false })
    .limit(10)
    .returns<PublicAnswer[]>()

  const questionsLeft = Math.max(0, profile.daily_limit - profile.questions_answered_today)
  const avatarUrl = profile.avatar_url ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`
  const displayName = `@${profile.username}`

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-lg bg-[#111] rounded-[32px] shadow-2xl border border-white/10 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#DD2A7B] opacity-5 blur-[100px] rounded-full pointer-events-none -mt-32 -mr-32"></div>

        {/* Header do criador */}
        <div className="h-32 bg-gradient-instagram relative">
          <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 rounded-full p-1 bg-[#111]">
            <img
              className="w-24 h-24 rounded-full border-4 border-[#111] object-cover"
              src={avatarUrl}
              alt={displayName}
            />
          </div>
        </div>

        <div className="pt-16 pb-8 px-8 text-center border-b border-white/5 relative z-10">
          <h1 className="text-2xl font-bold text-white mb-1">{displayName}</h1>
          {profile.bio && (
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">{profile.bio}</p>
          )}
          {questionsLeft > 0 ? (
            <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-semibold text-gray-300">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Aceitando perguntas hoje ({questionsLeft}/{profile.daily_limit})
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-semibold text-gray-400">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              Limite diário atingido — volte amanhã
            </div>
          )}
        </div>

        {/* Banner de retorno do Mercado Pago */}
        {paymentStatus === 'approved' && (
          <div className="mx-6 mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl text-center">
            <p className="text-green-400 font-bold text-sm">✓ Pagamento aprovado!</p>
            <p className="text-gray-400 text-xs mt-1">Sua pergunta foi enviada com sucesso. O criador responderá em até 36h.</p>
          </div>
        )}
        {paymentStatus === 'pending' && (
          <div className="mx-6 mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl text-center">
            <p className="text-yellow-400 font-bold text-sm">⏳ Pagamento em processamento</p>
            <p className="text-gray-400 text-xs mt-1">PIX ou boleto pendente. Sua pergunta será ativada assim que o pagamento for confirmado.</p>
          </div>
        )}
        {paymentStatus === 'failure' && (
          <div className="mx-6 mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-center">
            <p className="text-red-400 font-bold text-sm">✗ Pagamento não aprovado</p>
            <p className="text-gray-400 text-xs mt-1">Tente novamente com outro método de pagamento.</p>
          </div>
        )}

        {/* Formulário interativo (Client Component) */}
        <QuestionForm
          username={profile.username}
          minPrice={profile.min_price}
          avatarUrl={avatarUrl}
          displayName={displayName}
          disabled={questionsLeft === 0}
        />
      </div>

      {/* Feed de respostas públicas */}
      {publicAnswers && publicAnswers.length > 0 && (
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
                      {item.is_anonymous ? '👻' : '👤'}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">
                        {item.is_anonymous ? 'Usuário Anônimo' : item.sender_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {item.service_type === 'premium' ? '🎥 Vídeo' : '💬 Resposta Base'}
                      </p>
                    </div>
                  </div>
                  <span className="text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg text-xs">
                    R$ {Number(item.price_paid).toFixed(2).replace('.', ',')}
                  </span>
                </div>

                <p className="text-gray-300 text-lg font-medium mb-4 leading-relaxed">
                  &ldquo;{item.content}&rdquo;
                </p>

                <div className="bg-[#1a1a1a] shadow-inner rounded-2xl p-4 border border-white/5 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-instagram p-[1px]">
                      <img className="w-full h-full rounded-full object-cover" src={avatarUrl} alt="Creator" />
                    </div>
                    <span className="text-xs font-bold text-gray-400">{displayName} respondeu:</span>
                  </div>

                  {item.response_audio_url && (
                    <audio controls src={item.response_audio_url} className="w-full mt-1" />
                  )}

                  {item.response_text && !item.response_audio_url && (
                    <p className="text-gray-200 text-sm leading-relaxed">{item.response_text}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
