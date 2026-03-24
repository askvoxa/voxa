'use client'

import { useState } from 'react'
import Link from 'next/link'

const NICHES = [
  'Fitness', 'Finanças', 'Tecnologia', 'Beleza', 'Música', 'Games',
  'Educação', 'Humor', 'Lifestyle', 'Saúde', 'Negócios', 'Culinária', 'Moda', 'Outros',
]

const FOLLOWERS = [
  { value: '1k-10k', label: '1K – 10K' },
  { value: '10k-50k', label: '10K – 50K' },
  { value: '50k-100k', label: '50K – 100K' },
  { value: '100k-500k', label: '100K – 500K' },
  { value: '500k+', label: '500K+' },
]

type FormState = 'idle' | 'loading' | 'success' | 'error'

export default function WaitlistPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    instagram: '',
    followers_range: '',
    niche: '',
    whatsapp: '',
  })
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [copied, setCopied] = useState(false)

  // Extrair referral_code da URL (se veio por indicação)
  const referralFromUrl = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('ref')
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          referral_code: referralFromUrl || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error || 'Erro ao cadastrar')
        setState('error')
        return
      }

      setReferralCode(data.referral_code)
      setState('success')
    } catch {
      setErrorMsg('Erro de conexão. Tente novamente.')
      setState('error')
    }
  }

  const copyReferral = () => {
    const link = `${window.location.origin}/waitlist?ref=${referralCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-md">
        <Link href="/" className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737]">
          VOXA
        </Link>
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
        <div className="absolute bottom-1/4 left-0 w-[200px] h-[200px] bg-[#833ab4] opacity-[0.05] blur-[80px] rounded-full pointer-events-none" />

        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-semibold text-gray-300 mb-8">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Programa Founders — vagas extremamente limitadas
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] max-w-4xl mb-6">
          Seja um{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]">
            Founder
          </span>
          <br />
          da VOXA.
        </h1>

        <p className="text-lg sm:text-xl text-gray-500 max-w-xl mb-10 leading-relaxed">
          Os primeiros criadores a entrar ganham{' '}
          <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] drop-shadow-[0_0_12px_rgba(221,42,123,0.5)]">
            benefícios exclusivos para sempre
          </span>
          . Badge especial, taxa reduzida e programa de indicação com bonificação real.
        </p>

        <a
          href="#waitlist-form"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[#DD2A7B] to-[#F77737] text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-[0_0_30px_rgba(221,42,123,0.35)] hover:opacity-90 hover:-translate-y-0.5 transition-all"
        >
          Garantir minha vaga
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </a>

        <p className="text-xs text-gray-600 mt-4">Sem compromisso. Cadastre-se e garanta prioridade.</p>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-600">
          <span className="text-xs">descubra os benefícios</span>
          <svg className="w-4 h-4 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── O QUE É A VOXA ── */}
      <section className="px-6 py-20 max-w-3xl mx-auto text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[#833ab4] opacity-[0.06] blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-widest text-[#DD2A7B] mb-3">A plataforma</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-6">
            Monetize sua audiência{' '}
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]">
              de forma simples.
            </span>
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed max-w-xl mx-auto mb-12">
            A VOXA é uma plataforma onde seus fãs pagam para te fazer perguntas — e você responde por texto, áudio ou vídeo quando quiser. Sem curso, sem ebook, sem complicação.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {[
              { icon: '💬', title: 'Fã pergunta', desc: 'Seu fã paga via PIX e envia a pergunta.' },
              { icon: '🎙️', title: 'Você responde', desc: 'Texto, áudio ou vídeo — no seu tempo.' },
              { icon: '💰', title: 'Você recebe', desc: '90% do valor direto na sua conta.' },
            ].map((item) => (
              <div key={item.title} className="bg-[#111] border border-white/5 rounded-2xl p-6">
                <span className="text-3xl mb-3 block">{item.icon}</span>
                <h3 className="font-bold text-white text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS FOUNDER ── */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-[#DD2A7B] mb-3">Exclusivo para Founders</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Benefícios que{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737]">
              nunca mais estarão disponíveis.
            </span>
          </h2>
          <p className="text-gray-500 mt-3 max-w-lg mx-auto">
            Quem entra agora garante vantagens permanentes. Depois do lançamento, esses benefícios são extintos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              icon: '🏅',
              title: 'Badge Founder Exclusiva',
              desc: 'Um selo permanente no seu perfil que mostra que você faz parte dos primeiros. Gera autoridade e diferenciação junto à sua audiência.',
              color: 'from-[#DD2A7B]/10 to-transparent',
              border: 'border-[#DD2A7B]/20',
            },
            {
              icon: '📉',
              title: 'Taxa Reduzida Permanente',
              desc: 'Founders pagam menos taxa da plataforma — para sempre. Enquanto outros pagam a taxa padrão, você mantém a vantagem de quem chegou primeiro.',
              color: 'from-[#F77737]/10 to-transparent',
              border: 'border-[#F77737]/20',
            },
            {
              icon: '🚀',
              title: 'Acesso Antecipado',
              desc: 'Seja o primeiro a testar novas funcionalidades antes de qualquer outro criador. Sua opinião molda o produto.',
              color: 'from-[#FCAF45]/10 to-transparent',
              border: 'border-[#FCAF45]/20',
            },
            {
              icon: '🎯',
              title: 'Suporte Prioritário',
              desc: 'Canal direto com o time VOXA. Sem fila, sem bot. Seus problemas e sugestões são resolvidos com prioridade máxima.',
              color: 'from-[#833ab4]/10 to-transparent',
              border: 'border-[#833ab4]/20',
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

      {/* ── PROGRAMA DE REFERRAL ── */}
      <section className="px-6 py-20 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-[#DD2A7B] mb-3">Indique e ganhe</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Programa de{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737]">
              Referral Bonificado
            </span>
          </h2>
          <p className="text-gray-500 mt-3 max-w-lg mx-auto">
            Ao se cadastrar na waitlist, você recebe um link exclusivo de indicação. Cada criador que entrar pelo seu link gera recompensas reais para você.
          </p>
        </div>

        <div className="bg-[#111] border border-white/5 rounded-[28px] p-8 sm:p-10 shadow-xl">
          <div className="space-y-6">
            {[
              {
                num: '01',
                title: 'Cadastre-se na waitlist',
                desc: 'Preencha o formulário abaixo e receba seu código único de referral.',
              },
              {
                num: '02',
                title: 'Compartilhe com outros criadores',
                desc: 'Envie seu link para influenciadores que você conhece. Quanto mais indicarem, melhor para todos.',
              },
              {
                num: '03',
                title: 'Ganhe bonificação por indicação',
                desc: 'Cada criador que entrar pelo seu link garante benefícios extras para você dentro da plataforma — bônus em taxa, destaque no perfil e mais.',
              },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-6">
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

          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="flex items-start gap-3 bg-gradient-to-r from-[#DD2A7B]/10 to-[#F77737]/10 border border-[#DD2A7B]/20 rounded-xl p-4">
              <span className="text-lg shrink-0">💡</span>
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="font-bold text-white">Dica:</span> criadores com mais indicações sobem na fila de prioridade e desbloqueiam recompensas maiores. Comece a compartilhar assim que receber seu link.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FORMULÁRIO WAITLIST ── */}
      <section id="waitlist-form" className="px-6 py-20 max-w-2xl mx-auto scroll-mt-24">
        <div className="text-center mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-[#DD2A7B] mb-3">Pré-cadastro</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Garanta sua vaga como{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737]">
              Founder.
            </span>
          </h2>
          <p className="text-gray-500 mt-3">
            Preencha seus dados e entre para a lista de espera exclusiva.
          </p>
        </div>

        {state === 'success' ? (
          <div className="bg-[#111] border border-green-500/20 rounded-[28px] p-8 sm:p-10 text-center shadow-xl">
            <div className="text-5xl mb-5">🎉</div>
            <h3 className="text-2xl font-black text-white mb-3">Você está na lista!</h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Entraremos em contato em breve. Enquanto isso, compartilhe seu link de indicação e suba na fila de prioridade.
            </p>

            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-5 mb-6">
              <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Seu link de indicação</p>
              <p className="text-sm text-white font-mono break-all mb-4">
                {typeof window !== 'undefined' ? `${window.location.origin}/waitlist?ref=${referralCode}` : ''}
              </p>
              <button
                onClick={copyReferral}
                className="w-full bg-gradient-to-r from-[#DD2A7B] to-[#F77737] text-white font-bold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
              >
                {copied ? 'Link copiado!' : 'Copiar link de indicação'}
              </button>
            </div>

            <div className="flex items-start gap-3 bg-white/5 rounded-xl p-4 border border-white/5 text-left">
              <span className="text-lg shrink-0">💡</span>
              <p className="text-xs text-gray-500 leading-relaxed">
                Cada criador que se cadastrar pelo seu link aumenta suas recompensas dentro da plataforma. Compartilhe no Instagram, WhatsApp e com outros criadores.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[#111] border border-white/5 rounded-[28px] p-8 sm:p-10 shadow-xl">
            <div className="space-y-5">

              {/* Nome */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Nome completo</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#DD2A7B]/50 focus:ring-1 focus:ring-[#DD2A7B]/30 transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#DD2A7B]/50 focus:ring-1 focus:ring-[#DD2A7B]/30 transition-colors"
                />
              </div>

              {/* Instagram */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">@ do Instagram</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-sm">@</span>
                  <input
                    type="text"
                    required
                    value={form.instagram}
                    onChange={e => updateField('instagram', e.target.value.replace(/^@/, ''))}
                    placeholder="seuuser"
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#DD2A7B]/50 focus:ring-1 focus:ring-[#DD2A7B]/30 transition-colors"
                  />
                </div>
              </div>

              {/* Seguidores */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Número de seguidores</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {FOLLOWERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => updateField('followers_range', f.value)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        form.followers_range === f.value
                          ? 'bg-gradient-to-r from-[#DD2A7B] to-[#F77737] border-transparent text-white'
                          : 'bg-[#1a1a1a] border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nicho */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Seu nicho principal</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {NICHES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updateField('niche', n)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        form.niche === n
                          ? 'bg-gradient-to-r from-[#DD2A7B] to-[#F77737] border-transparent text-white'
                          : 'bg-[#1a1a1a] border-white/10 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* WhatsApp */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  WhatsApp <span className="text-gray-600 font-normal">(opcional)</span>
                </label>
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={e => updateField('whatsapp', e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#DD2A7B]/50 focus:ring-1 focus:ring-[#DD2A7B]/30 transition-colors"
                />
              </div>

              {/* Referral indicator */}
              {referralFromUrl && (
                <div className="flex items-center gap-2 bg-[#DD2A7B]/10 border border-[#DD2A7B]/20 rounded-xl px-4 py-3">
                  <span className="text-sm">🔗</span>
                  <p className="text-xs text-gray-400">
                    Você foi indicado! Código: <span className="font-mono text-white">{referralFromUrl}</span>
                  </p>
                </div>
              )}

              {/* Error */}
              {state === 'error' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-red-400">{errorMsg}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={state === 'loading' || !form.name || !form.email || !form.instagram || !form.followers_range || !form.niche}
                className="w-full bg-gradient-to-r from-[#DD2A7B] to-[#F77737] text-white font-bold text-lg px-8 py-4 rounded-2xl shadow-[0_0_30px_rgba(221,42,123,0.35)] hover:opacity-90 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed"
              >
                {state === 'loading' ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Cadastrando...
                  </span>
                ) : (
                  'Garantir minha vaga de Founder'
                )}
              </button>

              <p className="text-xs text-gray-600 text-center">
                Ao se cadastrar você concorda em receber comunicações da VOXA sobre o lançamento.
              </p>
            </div>
          </form>
        )}
      </section>

      {/* ── URGÊNCIA ── */}
      <section className="px-6 py-16 max-w-3xl mx-auto">
        <div className="bg-[#111] border border-white/5 rounded-[28px] p-8 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[#DD2A7B]/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <div className="text-4xl mb-4">⏳</div>
            <h3 className="text-2xl font-black text-white mb-3">Vagas limitadas para Founders</h3>
            <p className="text-gray-500 max-w-md mx-auto text-sm leading-relaxed">
              O programa Founder é exclusivo para os primeiros criadores que entrarem na plataforma. Após o lançamento, os benefícios de Founder serão permanentemente encerrados. Não perca essa janela.
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-xs text-gray-600">
        <p>&copy; 2026 VOXA. Todos os direitos reservados.</p>
      </footer>
    </div>
  )
}
