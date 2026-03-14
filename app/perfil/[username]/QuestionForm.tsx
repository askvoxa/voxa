'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

type Props = {
  username: string
  minPrice: number
  avatarUrl: string
  displayName: string
  disabled: boolean
}

export default function QuestionForm({ username, minPrice, displayName, disabled }: Props) {
  const router = useRouter()
  const premiumMin = Math.max(50, minPrice)
  const baseMin = minPrice

  const [question, setQuestion] = useState('')
  const [serviceType, setServiceType] = useState<'base' | 'premium'>('base')
  const [amount, setAmount] = useState(baseMin)
  const [name, setName] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isShareable, setIsShareable] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const getPriceColorClass = (val: number) =>
    amount === val
      ? 'bg-gradient-instagram text-white border-transparent'
      : 'bg-[#1a1a1a] text-gray-300 border-white/10 hover:border-white/20'

  const basePresets = Array.from(new Set([baseMin, baseMin * 2, 50, 100])).slice(0, 4)
  const premiumPresets = Array.from(new Set([premiumMin, premiumMin * 2, 200, 500])).slice(0, 4)

  const handleSubmit = async () => {
    const currentMin = serviceType === 'premium' ? premiumMin : baseMin
    if (!question.trim()) {
      setError('Escreva sua pergunta antes de continuar.')
      return
    }
    if (amount < currentMin) {
      setError(`Valor mínimo para ${serviceType === 'premium' ? 'Vídeo' : 'Base'} é R$ ${currentMin}.`)
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
          question: question.trim(),
          name: isAnonymous ? 'Anônimo' : name.trim() || 'Anônimo',
          amount,
          serviceType,
          isAnonymous,
          isShareable,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro ao iniciar pagamento. Tente novamente.')
        setIsSubmitting(false)
        return
      }

      // Redirecionar para o checkout do Mercado Pago
      router.push(data.init_point)
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

  return (
    <div className="p-8 relative z-10">
      <h2 className="font-bold text-lg mb-4 text-center text-white">Faça uma pergunta com prioridade</h2>

      <div className="space-y-6">
        {/* Pergunta */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Sua Pergunta</label>
          <textarea
            id="questionInput"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-[#DD2A7B] focus:border-transparent outline-none transition-all resize-none h-32 placeholder-gray-500"
            placeholder="O que você quer saber? Sua pergunta será destacada na tela do criador."
          />
          <p className="text-xs text-gray-500 mt-2">
            <span className="text-red-400/80 font-semibold">Nota:</span> Mensagens ofensivas causarão banimento e cancelamento sem estorno.
          </p>
        </div>

        {/* Nome */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Seu Nome (opcional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isAnonymous}
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-3 text-white focus:ring-2 focus:ring-[#DD2A7B] outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder-gray-500"
            placeholder="Joãozinho"
          />
        </div>

        {/* Opções */}
        <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-5 h-5 rounded border-gray-600 bg-[#222] text-[#DD2A7B] focus:ring-[#DD2A7B]"
            />
            <span className="text-sm text-gray-300 font-medium">Manter meu nome anônimo</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isShareable}
              onChange={(e) => setIsShareable(e.target.checked)}
              className="w-5 h-5 rounded border-gray-600 bg-[#222] text-[#DD2A7B] focus:ring-[#DD2A7B]"
            />
            <span className="text-sm text-gray-300 font-medium flex-1">Permitir que o criador compartilhe essa pergunta nos Stories</span>
          </label>
        </div>

        {/* Formato */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Formato da Resposta</label>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => { setServiceType('base'); if (amount < baseMin) setAmount(baseMin) }}
              className={`relative p-4 rounded-xl border text-left transition-all overflow-hidden ${serviceType === 'base' ? 'border-[#DD2A7B] bg-gradient-to-b from-[#DD2A7B]/10 to-transparent shadow-[0_0_15px_rgba(221,42,123,0.15)]' : 'border-white/10 bg-[#1a1a1a] hover:border-white/20'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💬</span>
                  <span className={`font-semibold ${serviceType === 'base' ? 'text-white' : 'text-gray-300'}`}>Opção Base</span>
                </div>
                <span className="text-sm font-bold text-gray-400">R$ {baseMin}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Pergunta Direta — resposta em texto ou áudio</p>
            </button>

            <button
              onClick={() => { setServiceType('premium'); if (amount < premiumMin) setAmount(premiumMin) }}
              className={`relative p-4 rounded-xl border text-left transition-all overflow-hidden ${serviceType === 'premium' ? 'border-[#DD2A7B] bg-gradient-to-b from-[#DD2A7B]/10 to-transparent shadow-[0_0_15px_rgba(221,42,123,0.15)]' : 'border-white/10 bg-[#1a1a1a] hover:border-white/20'}`}
            >
              <div className="absolute top-0 right-0 bg-gradient-instagram text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">Premium</div>
              <div className="flex items-center justify-between mb-1 mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎥</span>
                  <span className={`font-semibold ${serviceType === 'premium' ? 'text-white' : 'text-gray-300'}`}>Vídeo Exclusivo</span>
                </div>
                <span className="text-sm font-bold text-gray-400">R$ {premiumMin}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Mínimo 15s / Máximo 1min de vídeo exclusivo.</p>
            </button>
          </div>
        </div>

        {/* Valor */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Valor do Apoio (Mínimo: R$ {serviceType === 'premium' ? premiumMin : baseMin})
          </label>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {(serviceType === 'premium' ? premiumPresets : basePresets).map(val => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className={`border rounded-xl py-2 px-1 font-bold text-sm transition-all ${getPriceColorClass(val)}`}
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
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-3 pl-12 font-bold text-white focus:ring-2 focus:ring-[#DD2A7B] outline-none transition-all"
            />
          </div>

          <div className="bg-[#1a1a1a] rounded-xl p-4 mb-6 border border-white/5">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Valor da Pergunta</span>
              <span className="font-semibold text-white">R$ {amount.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500 mb-3">
              <span>Taxa de Serviço (10%)</span>
              <span>R$ {(amount * 0.1).toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="border-t border-white/10 pt-3 flex justify-between items-center">
              <span className="font-bold text-gray-300">Total a Pagar</span>
              <span className="font-bold text-lg text-transparent bg-clip-text bg-gradient-instagram">
                R$ {(amount * 1.1).toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 -mt-2">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full bg-gradient-instagram text-white font-bold text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(221,42,123,0.3)] hover:opacity-90 transform hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center min-h-[60px]"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-3">
              <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Preparando pagamento...
            </span>
          ) : (
            `Pagar R$ ${(amount * 1.1).toFixed(2).replace('.', ',')} via Mercado Pago`
          )}
        </button>

        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 bg-white/5 p-3 rounded-lg border border-white/5">
          <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
          <p className="leading-snug">
            <strong className="text-gray-300">Garantia VOXA:</strong> Se o criador não responder em 36h, seu dinheiro é estornado 100% automaticamente.
          </p>
        </div>

        <p className="text-xs text-center text-gray-500">
          Você será redirecionado para o Mercado Pago para completar o pagamento com segurança.
        </p>
      </div>
    </div>
  )
}
