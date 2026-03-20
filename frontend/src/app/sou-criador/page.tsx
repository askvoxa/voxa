'use client'

import { useState } from 'react'
import Link from 'next/link'

const PLATFORM_FEE = 0.10
const CREATOR_RATE = 1 - PLATFORM_FEE

export default function SouCriadorPage() {
  const [volume, setVolume] = useState(5)
  const [preco, setPreco] = useState(30)

  const liquidoDia = volume * preco * CREATOR_RATE
  const liquidoMes = liquidoDia * 30
  const liquidoAno = liquidoDia * 365

  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const tempoEstimado = volume <= 3 ? '10–15 min' : volume <= 7 ? '20–30 min' : volume <= 12 ? '30–45 min' : '~1h'

  const insightPreco = preco <= 30
    ? 'Ideal para audiências amplas e nichos de entretenimento'
    : preco <= 80
    ? 'Ótimo para fitness, culinária e lifestyle'
    : preco <= 200
    ? 'Perfeito para finanças, saúde e consultoria'
    : 'Premium — especialistas, médicos e advogados'

  const insightVolume = volume <= 3
    ? `Apenas ${volume} ${volume === 1 ? 'pergunta' : 'perguntas'} por dia — menos tempo que um café. Você provavelmente já responde isso de graça no Direct.`
    : volume <= 10
    ? `${volume} perguntas em menos de meia hora. Ideal para responder entre gravações ou no caminho de casa.`
    : `${volume} perguntas com áudio leva menos de 1h. E você já faz isso de graça todo dia no Instagram.`

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md">
        <span className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737]">
          VOXA
        </span>
        <Link
          href="/login"
          className="text-sm font-semibold text-gray-500 hover:text-white transition-colors"
        >
          Já tenho conta →
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] md:w-[600px] md:h-[600px] bg-[#DD2A7B] opacity-[0.07] blur-[70px] md:blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/4 right-0 w-[200px] h-[200px] md:w-[300px] md:h-[300px] bg-[#F77737] opacity-[0.05] blur-[60px] md:blur-[100px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-semibold text-gray-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Plataforma em beta — vagas limitadas para criadores
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] max-w-4xl mb-6">
          Transforme sua{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] via-[#F77737] to-[#FCAF45]">
            influência
          </span>
          {' '}em{' '}
          <br className="hidden sm:block" />
          faturamento real.
        </h1>

        <p className="text-lg sm:text-xl text-gray-500 max-w-xl mb-10 leading-relaxed">
          A plataforma mais simples para criadores monetizarem dúvidas e mensagens de fãs —
          com <span className="text-white font-semibold">90% de repasse</span> em cada transação.
        </p>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#DD2A7B] to-[#F77737] text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-[0_0_30px_rgba(221,42,123,0.35)] hover:opacity-90 hover:-translate-y-0.5 transition-all"
        >
          Criar meu perfil agora
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>

        <p className="text-xs text-gray-600 mt-4">Gratuito para começar. Sem mensalidade.</p>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600">
          <span className="text-xs">veja quanto você pode ganhar</span>
          <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── SIMULADOR ── */}
      <section className="px-6 py-20 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-[#DD2A7B] mb-3">Simulador</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Quanto você ganha com
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737]">
              pouquíssimo tempo?
            </span>
          </h2>
          <p className="text-gray-500 mt-3 max-w-md mx-auto">
            Ajuste os sliders e veja quanto você pode faturar respondendo apenas alguns minutos por dia.
          </p>
        </div>

        <div className="bg-[#111] border border-white/5 rounded-[28px] p-8 sm:p-10 shadow-xl">

          {/* Slider Volume diário */}
          <div className="mb-8">
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-sm font-semibold text-gray-300">Perguntas por dia</label>
              <span className="text-2xl font-black text-white">{volume}</span>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-[#DD2A7B] font-semibold bg-[#DD2A7B]/10 px-2 py-0.5 rounded-full">
                ⏱ {tempoEstimado} do seu dia
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="w-full accent-[#DD2A7B] h-2 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>1 pergunta</span>
              <span>20 perguntas</span>
            </div>
          </div>

          {/* Slider Preço */}
          <div className="mb-10">
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-sm font-semibold text-gray-300">Valor por pergunta</label>
              <span className="text-2xl font-black text-white">R$ {preco}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{insightPreco}</p>
            <input
              type="range"
              min={10}
              max={1000}
              step={10}
              value={preco}
              onChange={e => setPreco(Number(e.target.value))}
              className="w-full accent-[#DD2A7B] h-2 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>R$ 10</span>
              <span>R$ 1.000</span>
            </div>
          </div>

          {/* Resultado */}
          <div className="border-t border-white/5 pt-8">

            {/* Grid diário / mensal */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-white/5 text-center">
                <p className="text-xs text-gray-500 mb-1">Por dia</p>
                <p className="text-xl font-black text-white">R$ {fmt(liquidoDia)}</p>
              </div>
              <div className="bg-[#1a1a1a] rounded-2xl p-4 border border-white/5 text-center">
                <p className="text-xs text-gray-500 mb-1">Por mês</p>
                <p className="text-xl font-black text-white">R$ {fmt(liquidoMes)}</p>
              </div>
            </div>

            {/* Destaque anual */}
            <div className="bg-gradient-to-r from-[#DD2A7B]/10 to-[#F77737]/10 border border-[#DD2A7B]/20 rounded-2xl p-6 text-center mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Renda extra por ano</p>
              <p className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737]">
                R$ {fmt(liquidoAno)}
              </p>
              <p className="text-xs text-gray-600 mt-2">
                {volume} {volume === 1 ? 'pergunta' : 'perguntas'}/dia × R$ {preco} × 90% × 365 dias
              </p>
            </div>

            {/* Insight de vendas */}
            <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4 border border-white/5">
              <span className="text-lg shrink-0">💡</span>
              <p className="text-xs text-gray-500 leading-relaxed">{insightVolume}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS ── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-[#DD2A7B] mb-3">Por que a VOXA</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Feito para criadores de verdade.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: '⏱️',
              title: 'Liberdade Total',
              desc: 'Responda quando quiser. Defina seu limite diário, seu preço mínimo e seu prazo. A VOXA se adapta à sua rotina — não o contrário.',
              color: 'from-[#DD2A7B]/10 to-transparent',
              border: 'border-[#DD2A7B]/20',
            },
            {
              icon: '⚡',
              title: 'Segurança no Recebimento',
              desc: 'Pagamentos via PIX confirmados antes da sua resposta. Sem calotes, sem cobranças manuais. O dinheiro chega antes de você digitar uma palavra.',
              color: 'from-[#F77737]/10 to-transparent',
              border: 'border-[#F77737]/20',
            },
            {
              icon: '📥',
              title: 'Fim do Direct Caótico',
              desc: 'Chega de perguntas perdidas no Instagram. Organize tudo em um dashboard limpo, com prioridade para quem mais pagou.',
              color: 'from-[#FCAF45]/10 to-transparent',
              border: 'border-[#FCAF45]/20',
            },
          ].map((b) => (
            <div
              key={b.title}
              className={`bg-gradient-to-b ${b.color} bg-[#111] border ${b.border} rounded-[24px] p-8 hover:scale-[1.02] transition-transform`}
            >
              <div className="text-4xl mb-5">{b.icon}</div>
              <h3 className="text-lg font-black text-white mb-3">{b.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="px-6 py-20 max-w-3xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-[#DD2A7B] mb-3">Processo</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Simples do começo ao fim.
          </h2>
        </div>

        <div className="space-y-4">
          {[
            { num: '01', title: 'Crie seu perfil', desc: 'Defina seu preço mínimo, limite diário e bio. Leva menos de 2 minutos.' },
            { num: '02', title: 'Compartilhe seu link', desc: 'Coloque no bio do Instagram, TikTok ou Linktree. Seus fãs chegam até você.' },
            { num: '03', title: 'Fãs pagam e perguntam', desc: 'Pagamento via PIX confirmado antes de você ver a pergunta. Sem risco.' },
            { num: '04', title: 'Você responde e recebe', desc: 'Responda por texto ou áudio em até 36h. O dinheiro cai na sua conta.' },
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-6 bg-[#111] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors">
              <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737] shrink-0 w-10">
                {step.num}
              </span>
              <div>
                <h3 className="font-black text-white mb-1">{step.title}</h3>
                <p className="text-sm text-gray-500">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── GARANTIA ── */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <div className="bg-[#111] border border-white/5 rounded-[28px] p-8 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#DD2A7B]/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="text-4xl mb-4">🛡️</div>
            <h3 className="text-2xl font-black text-white mb-3">Garantia de reembolso automático</h3>
            <p className="text-gray-500 max-w-md mx-auto text-sm leading-relaxed">
              Se você não responder em 36h, o fã é reembolsado 100% automaticamente. Isso cria confiança — e confiança gera mais perguntas.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="px-6 py-24 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#DD2A7B]/5 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-6">
            Pronto para monetizar
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737]">
              sua audiência?
            </span>
          </h2>
          <p className="text-gray-500 mb-10 text-lg">
            Junte-se aos criadores que já transformam influência em renda.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-[#DD2A7B] to-[#F77737] text-white font-bold text-xl px-10 py-5 rounded-2xl shadow-[0_0_40px_rgba(221,42,123,0.4)] hover:opacity-90 hover:-translate-y-1 transition-all"
          >
            Criar meu perfil agora
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <p className="text-xs text-gray-600 mt-4">Gratuito para começar. Sem mensalidade. Cancele quando quiser.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-gray-600">
        <p>© 2026 VOXA. Todos os direitos reservados.</p>
      </footer>
    </div>
  )
}
