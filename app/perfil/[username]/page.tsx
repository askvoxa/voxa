'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'

export default function PerfilPage({ params }: { params: { username: string } }) {
  const { username } = params
  const [question, setQuestion] = useState('')
  const [serviceType, setServiceType] = useState<'base' | 'premium'>('base') // Default to 'base'
  const [amount, setAmount] = useState<number>(10)
  const [name, setName] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isShareable, setIsShareable] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [paidAmount, setPaidAmount] = useState(0)

  // Mock Data: Feed de Respostas Públicas
  const publicAnswers = [
    { id: 102, name: 'Anônimo', type: 'premium', isAnonymous: true, question: 'Caio, onde levar minha namorada para jantar no aniversário dela em Copacabana? Orçamento médio.', answerPreview: 'video_player', date: 'Há 3 dias', amount: 80 },
    { id: 103, name: 'Fernanda Lima', type: 'base', isAnonymous: false, question: 'Melhor bar de drinks na Lapa para ir com amigos no sábado?', answerPreview: 'Com certeza o Explorer Bar! Fica na beira de Santa Teresa e tem um Moscow Mule perfeito.', date: 'Há 5 dias', amount: 20 },
  ]

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => document.getElementById('questionInput')?.focus(), 500)
  }

  const handlePayment = async () => {
    if (!question.trim()) {
      alert("A pergunta não pode estar vazia!")
      return
    }

    setIsSubmitting(true)
    
    try {
      await new Promise(res => setTimeout(res, 1500))

      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, question, name: isAnonymous ? 'Anônimo' : name, amount, serviceType, isShareable, isAnonymous })
      })

      if (!res.ok) throw new Error('Falha no pagamento')

      setPaidAmount(amount * 1.1)
      setIsSuccess(true)
      setQuestion('')
      setName('')
      setAmount(serviceType === 'premium' ? 50 : 10)
      
    } catch (error) {
      alert("Erro ao processar pagamento. Tente novamente.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPriceColorClass = (val: number) => {
    return amount === val 
      ? 'bg-gradient-instagram text-white border-transparent' 
      : 'bg-[#1a1a1a] text-gray-300 border-white/10 hover:border-white/20'
  }

  // Demonstration Hardcoded Variables based on username "caio-muniz"
  const isCaio = username === 'caio-muniz'
  const displayUsername = isCaio ? 'Caio Muniz' : `@${username}`
  const displayBio = isCaio 
    ? 'Guia de Experiências Gastronômicas no RJ. Peça sua dica exclusiva de date ou comemoração aqui!' 
    : 'Engenheiro de Software & Criador de Conteúdo'
  const displayAvatar = isCaio
    ? 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=200&h=200'
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-lg bg-[#111] rounded-[32px] shadow-2xl border border-white/10 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#DD2A7B] opacity-5 blur-[100px] rounded-full pointer-events-none -mt-32 -mr-32"></div>

        <div className="h-32 bg-gradient-instagram relative">
          <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 rounded-full p-1 bg-[#111]">
            <img 
              className="w-24 h-24 rounded-full border-4 border-[#111] object-cover"
              src={displayAvatar} 
              alt={displayUsername} 
            />
          </div>
        </div>

        <div className="pt-16 pb-8 px-8 text-center border-b border-white/5 relative z-10">
          <h1 className="text-2xl font-bold text-white mb-1">{displayUsername}</h1>
          <p className="text-gray-400 text-sm mb-4 leading-relaxed">{displayBio}</p>
          <div className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs font-semibold text-gray-300">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Aceitando perguntas hoje (5/10)
          </div>
        </div>

        <div className="p-8 relative z-10">
          {isSuccess ? (
            <div className="text-center py-6 animate-fade-in">
               <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                 <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                 </svg>
               </div>
               <h2 className="text-2xl font-bold text-white mb-2">Pagamento aprovado!</h2>
               <p className="text-gray-400 mb-8">Sua pergunta foi enviada com sucesso para {displayUsername}.</p>
               
               <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-8 text-left shadow-sm">
                 <p className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wider text-center">Comprovante</p>
                 <div className="flex justify-between text-sm font-bold text-gray-200 border-b border-white/5 pb-3 mb-3">
                   <span>Valor pago</span>
                   <span className="text-green-400">R$ {paidAmount.toFixed(2).replace('.', ',')}</span>
                 </div>
                 <div className="flex justify-between text-sm text-gray-400 font-medium">
                   <span>Status</span>
                   <span className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md">Concluído</span>
                 </div>
               </div>

               <button 
                 onClick={() => setIsSuccess(false)}
                 className="w-full border border-white/20 text-white font-bold py-3.5 rounded-xl hover:bg-white/5 transition-colors"
               >
                 Fazer outra pergunta
               </button>
            </div>
          ) : (
            <>
              <h2 className="font-bold text-lg mb-4 text-center text-white">Faça uma pergunta com prioridade</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Sua Pergunta</label>
                  <textarea
                    id="questionInput"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 text-white focus:ring-2 focus:ring-[#DD2A7B] focus:border-transparent focus:shadow-[0_0_15px_rgba(221,42,123,0.3)] outline-none transition-all resize-none h-32 placeholder-gray-500"
                    placeholder="O que você quer saber? Sua pergunta será destacada na tela do criador."
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    <span className="text-red-400/80 font-semibold">Nota:</span> Mensagens ofensivas, assédio ou conteúdo explícito causarão o banimento da conta e o cancelamento do pedido sem estorno.
                  </p>
                </div>
                
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

                <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isAnonymous} 
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-600 bg-[#222] text-[#DD2A7B] focus:ring-[#DD2A7B] focus:ring-offset-[#111]"
                    />
                    <span className="text-sm text-gray-300 font-medium">Manter meu nome anônimo</span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isShareable} 
                      onChange={(e) => setIsShareable(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-600 bg-[#222] text-[#DD2A7B] focus:ring-[#DD2A7B] focus:ring-offset-[#111]"
                    />
                    <span className="text-sm text-gray-300 font-medium flex-1">Permitir que o criador compartilhe essa pergunta em seus Stories</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Formato da Resposta</label>
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => {
                        setServiceType('base')
                        if (amount < 10) setAmount(10)
                      }}
                      className={`relative p-4 rounded-xl border text-left transition-all overflow-hidden ${
                        serviceType === 'base' 
                          ? 'border-[#DD2A7B] bg-gradient-to-b from-[#DD2A7B]/10 to-transparent shadow-[0_0_15px_rgba(221,42,123,0.15)]' 
                          : 'border-white/10 bg-[#1a1a1a] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">💬</span>
                          <span className={`font-semibold ${serviceType === 'base' ? 'text-white' : 'text-gray-300'}`}>Opção Base</span>
                        </div>
                        <span className="text-sm font-bold text-gray-400">R$ 10</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 mb-1">
                        Pergunta Direta (Resposta em Texto ou Áudio)
                      </p>
                      <p className="text-[10px] text-gray-500 italic">
                        Nota: O criador pode optar por responder em áudio para uma experiência mais pessoal.
                      </p>
                    </button>

                    <button
                      onClick={() => {
                        setServiceType('premium')
                        if (amount < 50) setAmount(50)
                      }}
                      className={`relative p-4 rounded-xl border text-left transition-all overflow-hidden ${
                        serviceType === 'premium' 
                          ? 'border-[#DD2A7B] bg-gradient-to-b from-[#DD2A7B]/10 to-transparent shadow-[0_0_15px_rgba(221,42,123,0.15)]' 
                          : 'border-white/10 bg-[#1a1a1a] hover:border-white/20'
                      }`}
                    >
                      <div className="absolute top-0 right-0 bg-gradient-instagram text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                        Premium
                      </div>
                      <div className="flex items-center justify-between mb-1 mt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🎥</span>
                          <span className={`font-semibold ${serviceType === 'premium' ? 'text-white' : 'text-gray-300'}`}>Vídeo Exclusivo</span>
                        </div>
                        <span className="text-sm font-bold text-gray-400">R$ 50</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 mb-1">
                        Mínimo 15s / Máximo 1min de vídeo exclusivo.
                      </p>
                      <p className="text-[10px] text-gray-500 italic">
                        Receba uma saudação personalizada em vídeo direto no seu WhatsApp/E-mail.
                      </p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Valor do Apoio (Mínimo: R$ {serviceType === 'premium' ? '50' : '10'})</label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {(serviceType === 'premium' ? [50, 100, 200, 500] : [10, 20, 50, 100]).map(val => (
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
                      min={serviceType === 'premium' ? 50 : 10}
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

                <button 
                  onClick={handlePayment}
                  disabled={isSubmitting}
                  className="w-full bg-gradient-instagram text-white font-bold text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(221,42,123,0.3)] hover:shadow-[0_0_30px_rgba(221,42,123,0.5)] hover:opacity-90 transform hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center min-h-[60px]"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-3">
                      <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Enviando sua pergunta para {isCaio ? 'Caio' : username}...
                    </span>
                  ) : (
                    `Pagar R$ ${(amount * 1.1).toFixed(2).replace('.', ',')}`
                  )}
                </button>

                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400 bg-white/5 p-3 rounded-lg border border-white/5">
                  <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
                  <p className="leading-snug">
                    <strong className="text-gray-300">Garantia VOXA:</strong> Se o criador não responder em até 36 horas, seu dinheiro é estornado 100% automaticamente.
                  </p>
                </div>

                <p className="text-xs text-center text-gray-500 mt-4">
                  Pagamento 100% seguro via PIX/Cartão.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
      
      <div className="w-full max-w-2xl mt-16 px-2">
        <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
          <svg className="w-6 h-6 text-[#DD2A7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
          Respostas Recentes
        </h3>

        <div className="space-y-6">
          {publicAnswers.map((item) => (
            <div key={item.id} className="bg-[#111] rounded-[24px] p-6 border border-white/5 shadow-sm hover:border-white/10 transition-colors">
               <div className="flex items-start justify-between mb-4">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-[#1a1a1a] rounded-full flex items-center justify-center text-lg shadow-inner">
                     {item.isAnonymous ? '👻' : '👤'}
                   </div>
                   <div>
                     <p className="font-bold text-white text-sm">
                       {item.isAnonymous ? 'Usuário Anônimo' : item.name}
                     </p>
                     <p className="text-xs text-gray-500">{item.date} • {item.type === 'premium' ? '🎥 Vídeo' : '💬 Resposta Base'}</p>
                   </div>
                 </div>
                 <span className="text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg text-xs">R$ {item.amount.toFixed(2).replace('.', ',')}</span>
               </div>

               <p className="text-gray-300 text-lg font-medium mb-4 leading-relaxed">
                 "{item.question}"
               </p>

               <div className="bg-[#1a1a1a] shadow-inner rounded-2xl p-4 border border-white/5 mb-4">
                 <div className="flex items-center gap-2 mb-2">
                   <div className="w-6 h-6 rounded-full bg-gradient-instagram p-[1px]">
                     <img className="w-full h-full rounded-full object-cover" src={displayAvatar} alt="Creator" />
                   </div>
                   <span className="text-xs font-bold text-gray-400">{displayUsername} respondeu:</span>
                 </div>
                 
                 {item.type === 'base' && (
                   <div className="flex items-center gap-3 mt-2">
                     <button className="w-10 h-10 rounded-full bg-gradient-instagram text-white flex items-center justify-center shadow-md hover:scale-105 transition-transform">
                       <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                     </button>
                     <div className="flex-1 flex gap-1 items-center opacity-80">
                       {[...Array(20)].map((_, i) => (
                         <div key={i} className="w-1 bg-[#DD2A7B] rounded-full" style={{ height: `${Math.random() * 16 + 4}px` }}></div>
                       ))}
                     </div>
                     <span className="text-xs text-gray-500 font-mono">0:25</span>
                   </div>
                 )}

                 {item.type === 'premium' && (
                   <div className="relative w-full h-48 bg-gray-900 rounded-xl mt-2 overflow-hidden group cursor-pointer flex items-center justify-center border border-white/5">
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                     <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                       <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                     </div>
                   </div>
                 )}
               </div>

               <button 
                 onClick={scrollToTop}
                 className="w-full py-3 rounded-xl border border-white/10 text-sm font-bold text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
               >
                 Gostou? Faça sua pergunta também
               </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
