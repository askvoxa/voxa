'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Heart } from 'lucide-react'
import { RESPONSE_DEADLINE_HOURS } from '@/lib/constants'

type FastAskSuggestion = {
  label: string
  question: string
  amount: number
}

type Props = {
  username: string
  minPrice: number
  avatarUrl: string
  displayName: string
  disabled: boolean
  fastAskSuggestions?: FastAskSuggestion[]
}

type Mode = 'question' | 'support'

const SUPPORT_PRESETS = [10, 25, 50, 100]

const DEFAULT_FAST_ASK: FastAskSuggestion[] = [
  { label: '⚡ Dica rápida', question: 'Qual é a sua dica mais valiosa que você daria para alguém começando agora?', amount: 20 },
  { label: '🎨 Análise de perfil', question: 'Você pode analisar meu perfil e me dar um feedback honesto sobre o meu estilo?', amount: 35 },
  { label: '🌟 Recomendação', question: 'Qual é a sua recomendação exclusiva para quem quer se destacar nessa área?', amount: 15 },
]

export default function QuestionForm({ username, minPrice, displayName, disabled, fastAskSuggestions }: Props) {
  const router = useRouter()

  // BUG FIX: garante que minPrice é sempre um número positivo válido
  const baseMin = Math.max(1, Number(minPrice) || 1)
  const premiumMin = Math.max(50, baseMin)

  const [mode, setMode] = useState<Mode>('question')
  const [question, setQuestion] = useState('')
  const [supportMessage, setSupportMessage] = useState('')
  const [serviceType, setServiceType] = useState<'base' | 'premium'>('base')
  const [amount, setAmount] = useState(baseMin)
  const [supportAmount, setSupportAmount] = useState(SUPPORT_PRESETS[0])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isShareable, setIsShareable] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [activeSuggestion, setActiveSuggestion] = useState<number | null>(null)

  // Avisa o usuário ao sair da página com dados preenchidos
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (question.trim() || supportMessage.trim()) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [question, supportMessage])

  // Filtra sugestões inválidas e remove as que teriam o valor forçado acima do dobro do original
  // (evita UX confusa como "Dica rápida · R$ 50" quando o original era R$ 15)
  const rawSuggestions: FastAskSuggestion[] =
    Array.isArray(fastAskSuggestions) && fastAskSuggestions.length > 0
      ? fastAskSuggestions.filter(s => s?.label && s?.question && Number(s?.amount) > 0)
      : DEFAULT_FAST_ASK

  const suggestions = rawSuggestions.filter(s => {
    const original = Number(s.amount) || 0
    // Se o minPrice forçaria o valor a mais que 2x o original, a sugestão perde o sentido
    return original >= baseMin || baseMin <= original * 2
  })

  const getPriceColorClass = (val: number, current: number) =>
    current === val
      ? 'bg-[#7C3AED] text-white border-transparent shadow-[0_0_12px_rgba(124,58,237,0.3)]'
      : 'bg-[#1a1a1a] text-gray-300 border-white/10 hover:border-white/20'

  const basePresets = Array.from(new Set([baseMin, baseMin * 2, 50, 100])).filter(v => v > 0).slice(0, 4)
  const premiumPresets = Array.from(new Set([premiumMin, premiumMin * 2, 200, 500])).filter(v => v > 0).slice(0, 4)

  const handleFastAsk = (suggestion: FastAskSuggestion, index: number) => {
    setQuestion(suggestion.question)
    // BUG FIX: sempre respeita o mínimo do criador
    const safeAmount = Math.max(Number(suggestion.amount) || baseMin, baseMin)
    setAmount(safeAmount)
    setServiceType('base')
    setActiveSuggestion(index)
  }

  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode)
    setError('')
  }

  // BUG FIX: handler seguro para input numérico que evita NaN e valores fora do range
  const handleAmountChange = (val: string, setter: (n: number) => void, min: number) => {
    const parsed = parseFloat(val)
    if (!isNaN(parsed)) {
      setter(Math.max(min, Math.min(10000, parsed)))
    }
  }

  const handleSubmit = async () => {
    const isSupport = mode === 'support'
    const currentMin = serviceType === 'premium' ? premiumMin : baseMin
    const finalAmount = isSupport ? supportAmount : amount
    const finalQuestion = isSupport
      ? (supportMessage.trim() || '❤️ Apoio do fã')
      : question.trim()

    if (!isSupport && !question.trim()) {
      setError('Escreva sua pergunta antes de continuar.')
      return
    }
    if (!isSupport && amount < currentMin) {
      setError(`Valor mínimo para ${serviceType === 'premium' ? 'Vídeo' : 'Base'} é R$ ${currentMin}.`)
      return
    }
    if (isSupport && supportAmount < 5) {
      setError('Valor mínimo de apoio é R$ 5.')
      return
    }
    if (finalAmount > 10000) {
      setError('Valor máximo é R$ 10.000.')
      return
    }
    if (!email.trim() || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(email.trim())) {
      setError('Informe um e-mail válido para continuar.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/payment/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          question: finalQuestion,
          name: isAnonymous ? 'Anônimo' : name.trim() || 'Anônimo',
          email: email.trim(),
          amount: finalAmount,
          serviceType: isSupport ? 'support' : serviceType,
          isAnonymous,
          isShareable,
          is_support_only: isSupport,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao iniciar pagamento. Tente novamente.')
        setIsSubmitting(false)
        return
      }

      // BUG FIX: router.push pode falhar — garante reset do estado
      if (!data.init_point) {
        setError('Resposta inválida do servidor. Tente novamente.')
        setIsSubmitting(false)
        return
      }

      router.push(data.init_point)
      // Não reseta isSubmitting aqui intencionalmente — o redirect vai desmontar o componente
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
      setIsSubmitting(false)
    }
  }

  if (disabled) {
    return (
      <div className="p-8 text-center relative z-10">
        <p className="text-gray-400">Este criador atingiu o limite de perguntas de hoje.</p>
        <p className="text-gray-500 text-sm mt-1">Volte amanhã para enviar sua pergunta.</p>
      </div>
    )
  }

  const isSupport = mode === 'support'
  const finalAmount = isSupport ? supportAmount : amount
  const submitLabel = isSupport
    ? `Enviar Apoio · R$ ${finalAmount.toFixed(2).replace('.', ',')}`
    : `Pagar R$ ${finalAmount.toFixed(2).replace('.', ',')} via Mercado Pago`

  return (
    <div className="p-8 relative z-10">

      {/* Toggle Pergunta / Apoiar */}
      <div className="flex bg-[#1a1a1a] rounded-2xl p-1 mb-6 border border-white/5">
        <button
          type="button"
          onClick={() => handleModeSwitch('question')}
          className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            !isSupport
              ? 'bg-[#111] text-white shadow-sm border border-white/10'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span role="img" aria-label="Mensagem">💬</span>
          <span>Fazer Pergunta</span>
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('support')}
          className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            isSupport
              ? 'bg-[#0A0A0F] text-white shadow-sm border border-white/10'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Heart className={`w-4 h-4 ${isSupport ? 'text-[#7C3AED]' : ''}`} />
          <span>Apenas Apoiar</span>
        </button>
      </div>

      <div className="space-y-6">

        {/* ── MODO APOIO ── */}
        {isSupport ? (
          <>
            <div className="bg-[#7C3AED]/5 border border-[#7C3AED]/15 rounded-2xl p-4 text-center">
              <p className="text-sm text-gray-300 leading-relaxed">
                Seu apoio vai direto para <span className="text-white font-semibold">{displayName}</span>.<br />
                <span className="text-gray-500 text-xs">Sem obrigação de resposta — é só gratidão. ☕</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Deixe uma mensagem de apoio{' '}
                <span className="text-gray-600 font-normal">(opcional)</span>
              </label>
              <textarea
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value.slice(0, 140))}
                maxLength={140}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-[#7C3AED]/40 focus:border-[#7C3AED]/60 focus:border-transparent outline-none transition-all resize-none h-24 placeholder-gray-500"
                placeholder="Escreva algo legal para o criador... ✨"
              />
              <p className="text-xs text-gray-600 text-right mt-1">{supportMessage.length}/140</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Valor do Apoio</label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {SUPPORT_PRESETS.map(val => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setSupportAmount(val)}
                    className={`border rounded-xl min-h-[44px] py-2 px-1 font-bold text-sm transition-all cursor-pointer flex items-center justify-center ${getPriceColorClass(val, supportAmount)}`}
                  >
                    R$ {val}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold">R$</span>
                <input
                  type="number"
                  min={5}
                  max={10000}
                  value={supportAmount}
                  onChange={(e) => handleAmountChange(e.target.value, setSupportAmount, 5)}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-3 pl-12 font-bold text-white focus:ring-2 focus:ring-[#7C3AED]/40 focus:border-[#7C3AED]/60 outline-none transition-all"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* ── MODO PERGUNTA ── */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Sua Pergunta</label>
              <textarea
                id="questionInput"
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value)
                  setActiveSuggestion(null)
                }}
                maxLength={500}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-[#7C3AED]/40 focus:border-[#7C3AED]/60 focus:border-transparent outline-none transition-all resize-none h-32 placeholder-gray-500"
                placeholder="O que você quer saber? Sua pergunta será destacada na tela do criador."
              />
              <p className="text-xs text-gray-600 text-right mt-1">{question.length}/500</p>

              {/* Fast Ask — sugestões dinâmicas */}
              {suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2 font-medium">⚡ Perguntas rápidas</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {suggestions.map((suggestion, index) => {
                      const isActive = activeSuggestion === index
                      const displayAmount = Math.max(Number(suggestion.amount) || baseMin, baseMin)
                      return (
                        <button
                          type="button"
                          key={index}
                          onClick={() => handleFastAsk(suggestion, index)}
                          className={`flex-shrink-0 flex items-center justify-center gap-1.5 px-4 min-h-[44px] rounded-full border text-xs font-medium transition-all whitespace-nowrap ${
                            isActive
                              ? 'bg-[#7C3AED]/15 border-[#7C3AED]/50 text-[#7C3AED]'
                              : 'bg-[#1a1a1a] border-white/10 text-gray-400 hover:border-white/25 hover:text-gray-200 hover:bg-[#222]'
                          }`}
                        >
                          <span>{suggestion.label}</span>
                          <span className={isActive ? 'text-[#7C3AED]/70' : 'text-gray-600'}>
                            · R$ {displayAmount}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-3">
                <span className="text-red-400/80 font-semibold">Nota:</span> Mensagens ofensivas causarão banimento e cancelamento sem estorno.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Formato da Resposta</label>
              <div className="grid grid-cols-1 gap-4">
                <button
                  type="button"
                  onClick={() => { setServiceType('base'); if (amount < baseMin) setAmount(baseMin) }}
                  className={`relative p-4 rounded-xl border text-left transition-all overflow-hidden cursor-pointer ${serviceType === 'base' ? 'border-[#7C3AED] bg-gradient-to-b from-[#DD2A7B]/10 to-transparent shadow-[0_0_15px_rgba(124,58,237,0.2)]' : 'border-white/10 bg-[#1a1a1a] hover:border-white/20'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl" role="img" aria-label="Mensagem">💬</span>
                      <span className={`font-semibold ${serviceType === 'base' ? 'text-white' : 'text-gray-300'}`}>Opção Base</span>
                    </div>
                    <span className="text-sm font-bold text-gray-400">R$ {baseMin}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Pergunta Direta — resposta em texto ou áudio</p>
                </button>

                <button
                  type="button"
                  onClick={() => { setServiceType('premium'); if (amount < premiumMin) setAmount(premiumMin) }}
                  className={`relative p-4 rounded-xl border text-left transition-all overflow-hidden cursor-pointer ${serviceType === 'premium' ? 'border-[#7C3AED] bg-gradient-to-b from-[#DD2A7B]/10 to-transparent shadow-[0_0_15px_rgba(124,58,237,0.2)]' : 'border-white/10 bg-[#1a1a1a] hover:border-white/20'}`}
                >
                  <div className="absolute top-0 right-0 bg-gradient-instagram text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">Premium</div>
                  <div className="flex items-center justify-between mb-1 mt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl" role="img" aria-label="Vídeo">🎥</span>
                      <span className={`font-semibold ${serviceType === 'premium' ? 'text-white' : 'text-gray-300'}`}>Vídeo Exclusivo</span>
                    </div>
                    <span className="text-sm font-bold text-gray-400">R$ {premiumMin}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Mínimo 15s / Máximo 1min de vídeo exclusivo.</p>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Valor do Apoio (Mínimo: R$ {serviceType === 'premium' ? premiumMin : baseMin})
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {(serviceType === 'premium' ? premiumPresets : basePresets).map(val => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setAmount(val)}
                    className={`border rounded-xl min-h-[44px] py-2 px-1 font-bold text-sm transition-all cursor-pointer flex items-center justify-center ${getPriceColorClass(val, amount)}`}
                  >
                    R$ {val}
                  </button>
                ))}
              </div>
              <div className="relative mb-6">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold">R$</span>
                <input
                  type="number"
                  min={serviceType === 'premium' ? premiumMin : baseMin}
                  max={10000}
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value, setAmount, serviceType === 'premium' ? premiumMin : baseMin)}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-3 pl-12 font-bold text-white focus:ring-2 focus:ring-[#7C3AED]/40 focus:border-[#7C3AED]/60 outline-none transition-all"
                />
              </div>
            </div>
          </>
        )}

        {/* Resumo de valor */}
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-white/5">
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-300">{isSupport ? 'Valor do Apoio' : 'Total a Pagar'}</span>
            <span className="font-bold text-lg text-[#A78BFA]">
              R$ {finalAmount.toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>

        {/* Toggle de anonimato */}
        <div
          onClick={() => setIsAnonymous(!isAnonymous)}
          className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-[#1a1a1a] cursor-pointer min-h-[56px]"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{isAnonymous ? '👻' : '👤'}</span>
            <div>
              <p className="text-sm font-medium text-gray-200">
                {isAnonymous ? 'Enviando como anônimo' : 'Enviar com meu nome'}
              </p>
              <p className="text-xs text-gray-500">
                {isAnonymous
                  ? 'Sua identidade não será revelada ao criador'
                  : 'O criador saberá quem perguntou'}
              </p>
            </div>
          </div>
          <div
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 pointer-events-none ${
              isAnonymous ? 'bg-purple-600' : 'bg-gray-600'
            }`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              isAnonymous ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </div>
        </div>

        {/* Nome: ocultar quando anônimo */}
        {!isAnonymous && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Seu Nome (opcional)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-3 text-white focus:ring-2 focus:ring-[#7C3AED]/40 focus:border-[#7C3AED]/60 outline-none transition-all placeholder-gray-500"
              placeholder="Joãozinho"
            />
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Seu E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-3 text-white focus:ring-2 focus:ring-[#7C3AED]/40 focus:border-[#7C3AED]/60 outline-none transition-all placeholder-gray-500"
            placeholder="para@exemplo.com"
          />
          <p className="text-xs text-gray-600 mt-1">Você receberá a resposta neste email.</p>
        </div>

        {/* Opções */}
        <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5">
          <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={isShareable}
              onChange={(e) => setIsShareable(e.target.checked)}
              className="w-5 h-5 rounded border-gray-600 bg-[#222] text-[#7C3AED] focus:ring-[#7C3AED]/40 focus:border-[#7C3AED]/60"
            />
            <span className="text-sm text-gray-300 font-medium flex-1">
              {isSupport
                ? 'Permitir que o criador compartilhe esse apoio nos Stories'
                : 'Permitir que o criador compartilhe essa pergunta nos Stories'}
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-red-400 -mt-2" role="alert">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-lg py-4 rounded-xl shadow-[0_0_24px_rgba(124,58,237,0.3)] hover:shadow-[0_0_32px_rgba(124,58,237,0.5)] transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none flex items-center justify-center min-h-[60px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-3">
              <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Preparando pagamento...
            </span>
          ) : submitLabel}
        </button>

        {!isSupport && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 bg-white/5 p-3 rounded-lg border border-white/5">
            <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
            <p className="leading-snug">
              <strong className="text-gray-300">Garantia VOXA:</strong> Se o criador não responder em {RESPONSE_DEADLINE_HOURS}h, seu dinheiro é estornado 100% automaticamente.
            </p>
          </div>
        )}

        {isSupport && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 bg-white/5 p-3 rounded-lg border border-white/5">
            <Heart className="w-4 h-4 text-[#7C3AED] shrink-0" />
            <p className="leading-snug">
              Apoios não exigem resposta do criador. Seu gesto vai diretamente para ele. 💙
            </p>
          </div>
        )}

        <p className="text-xs text-center text-gray-500">
          Você será redirecionado para o Mercado Pago para completar o pagamento com segurança.
        </p>
      </div>
    </div>
  )
}
