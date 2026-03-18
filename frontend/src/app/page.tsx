'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Search, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { computeMilestones, CreatorStats } from '@/lib/milestones'
import MilestoneBadgeRow from '@/components/milestones/MilestoneBadgeRow'

type Criador = {
  username: string
  bio: string | null
  avatar_url: string | null
  min_price: number
  creator_stats: CreatorStats[] | null
}

// ── Amostras de respostas ─────────────────────────────────────────────────────
const AMOSTRAS = [
  {
    criador: 'Ana Luiza',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=analuiza&backgroundColor=b6e3f4',
    pergunta: 'Qual o melhor horário para treinar?',
    preview: 'Depende do seu cronotipo — matutinos performam melhor de manhã, vespertinos à tarde. O mais importante é a consistência...',
    nicho: 'Fitness',
    cor: 'from-rose-500/20 to-orange-500/10',
  },
  {
    criador: 'Rafael Mendes',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rafaelmendes&backgroundColor=c0aede',
    pergunta: 'Onde investir com R$ 500/mês?',
    preview: 'Com esse aporte eu começaria pelo Tesouro Selic como reserva, depois migraria para fundos indexados...',
    nicho: 'Finanças',
    cor: 'from-violet-500/20 to-blue-500/10',
  },
  {
    criador: 'Marcelo Souza',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marcelosouza&backgroundColor=ffdfbf',
    pergunta: 'Como fazer massa de pizza crocante?',
    preview: 'O segredo está na temperatura do forno e na hidratação da massa. Pré-aqueça por pelo menos 45 minutos...',
    nicho: 'Gastronomia',
    cor: 'from-amber-500/20 to-yellow-500/10',
  },
]

export default function HomePage() {
  const [busca, setBusca] = useState('')
  const [criadores, setCriadores] = useState<Criador[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleBuscaSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const termo = busca.trim()
    if (!termo) return
    const username = termo.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (username) {
      window.location.href = `/perfil/${username}`
    }
  }

  // Fetch creators from Supabase (all active or filtered by search)
  const fetchCriadores = async (termo: string) => {
    const supabase = createClient()
    let query = supabase
      .from('profiles')
      .select('username, bio, avatar_url, min_price, creator_stats(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20)

    if (termo) {
      const t = `%${termo}%`
      query = query.or(`username.ilike.${t},bio.ilike.${t}`)
    }

    const { data } = await query
    setCriadores(data ?? [])
    setLoading(false)
  }

  // Auth check + initial load
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
    })
    fetchCriadores('')
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      fetchCriadores(busca.trim())
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [busca])

  return (
    <div className="min-h-screen bg-[#f9f8f7] text-[#111]">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-[#f9f8f7]/90 backdrop-blur-md border-b border-black/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737]">
            VOXA
          </span>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-[#DD2A7B] hover:text-[#c4245f] transition-colors"
            >
              Meu dashboard →
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-sm font-semibold text-gray-500 hover:text-[#111] transition-colors"
            >
              Entrar →
            </Link>
          )}
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-20 pb-14 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-white border border-black/8 px-4 py-1.5 rounded-full text-xs font-semibold text-gray-500 mb-8 shadow-sm">
          <Shield className="w-3.5 h-3.5 text-green-500" />
          Reembolso automático se não responder em 36h
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight text-[#111] mb-5">
          Sua dúvida respondida por
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] via-[#F77737] to-[#FCAF45]">
            quem você admira.
          </span>
        </h1>

        <p className="text-gray-500 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
          Respostas personalizadas em texto ou áudio.
          Receba em até 36h — ou seu dinheiro de volta.
        </p>

        {/* Barra de busca */}
        <form onSubmit={handleBuscaSubmit} className="relative max-w-lg mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Para quem você tem uma pergunta?"
            className="w-full bg-white border border-black/10 rounded-2xl py-4 pl-12 pr-32 text-[#111] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]/30 focus:border-[#DD2A7B]/40 transition-all text-sm shadow-sm"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-[#DD2A7B] to-[#F77737] text-white text-xs font-bold px-4 py-3 rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
          >
            Buscar
          </button>
        </form>
      </section>

      {/* ── GRID DE CRIADORES ── */}
      <section className="px-6 pb-20 pt-10 max-w-5xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-black/8 rounded-[24px] p-6 shadow-sm animate-pulse">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-full bg-gray-200" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-36" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-5">
                  <div className="h-6 bg-gray-100 rounded-full w-28" />
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-black/5">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : criadores.length === 0 ? (
          <div className="text-center py-20">
            {busca ? (
              <p className="text-gray-400 text-sm">Nenhum criador encontrado para &quot;{busca}&quot;.</p>
            ) : (
              <div>
                <p className="text-gray-400 text-sm mb-3">Nenhum criador disponível no momento.</p>
                <Link href="/sou-criador" className="text-sm font-semibold text-[#DD2A7B] hover:underline">
                  Seja o primeiro criador →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {criadores.map(c => (
              <Link
                key={c.username}
                href={`/perfil/${c.username}`}
                className="group bg-white border border-black/8 rounded-[24px] p-6 hover:border-black/15 hover:shadow-md transition-all hover:-translate-y-0.5 shadow-sm"
              >
                {/* Avatar */}
                <div className="flex items-center gap-4 mb-5">
                  <img
                    src={c.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.username}&backgroundColor=b6e3f4`}
                    alt={c.username}
                    loading="lazy"
                    className="w-14 h-14 rounded-full object-cover bg-gray-100 border border-black/5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#111] text-sm truncate">@{c.username}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{c.bio || 'Criador na VOXA'}</p>
                  </div>
                </div>

                {/* Milestones + Badge */}
                <div className="flex items-center gap-2 mb-5 flex-wrap">
                  <MilestoneBadgeRow
                    milestones={computeMilestones(c.creator_stats?.[0] ?? null)}
                    size="sm"
                    maxVisible={4}
                  />
                  <span className="inline-flex items-center gap-1 bg-gray-50 border border-black/8 px-2.5 py-1 rounded-full text-xs font-medium text-gray-600">
                    <Shield className="w-3 h-3" />
                    Garantia VOXA
                  </span>
                </div>

                {/* CTA */}
                <div className="flex items-center justify-between pt-4 border-t border-black/5">
                  <p className="text-sm font-black text-[#111]">
                    A partir de <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737]">R$ {c.min_price}</span>
                  </p>
                  <span className="text-xs font-semibold text-gray-400 group-hover:text-[#DD2A7B] group-hover:translate-x-0.5 transition-all">
                    Perguntar →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section className="bg-white border-t border-b border-black/5 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[#DD2A7B] mb-2">Amostras</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#111]">Veja como funciona</h2>
            <p className="text-gray-500 text-sm mt-2">Respostas reais de criadores da plataforma.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {AMOSTRAS.map((a, i) => (
              <div
                key={i}
                className="rounded-[20px] overflow-hidden border border-black/8 shadow-sm"
              >
                {/* Card vertical 9:16 */}
                <div className="relative w-full" style={{ paddingBottom: '177.77%' }}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${a.cor} bg-[#fafafa] flex flex-col items-center justify-center p-6 text-center`}>
                    <img
                      src={a.avatar}
                      alt={a.criador}
                      className="w-16 h-16 rounded-full mb-4 border-2 border-white shadow-sm"
                    />
                    <p className="text-xs font-bold text-[#111] mb-1">{a.criador}</p>
                    <span className="text-[10px] font-semibold text-gray-400 bg-white/80 px-2 py-0.5 rounded-full mb-4">#{a.nicho}</span>
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-black/8 w-full">
                      <p className="text-xs font-bold text-[#111] mb-2 leading-snug">
                        "{a.pergunta}"
                      </p>
                      <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-4">
                        {a.preview}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-green-500" />
                      <span className="text-[10px] text-gray-400 font-medium">Garantia VOXA</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className="px-6 py-14 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { icon: '⚡', ariaLabel: 'Rápido', titulo: 'Resposta garantida', desc: 'Em até 36h ou reembolso automático. Sem burocracia.' },
            { icon: '🔒', ariaLabel: 'Seguro', titulo: 'Pagamento seguro', desc: 'PIX com confirmação instantânea. Seu dinheiro protegido.' },
            { icon: '🎯', ariaLabel: 'Personalizado', titulo: 'Personalizado para você', desc: 'Não é conteúdo genérico. É uma resposta feita para sua pergunta.' },
          ].map((t, i) => (
            <div key={i} className="bg-white border border-black/8 rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3" role="img" aria-label={t.ariaLabel}>{t.icon}</div>
              <h3 className="font-bold text-[#111] text-sm mb-2">{t.titulo}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-black/5 px-6 py-8 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#DD2A7B] to-[#F77737]">VOXA</span>
            <a href="#" className="hover:text-gray-600 transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Privacidade</a>
          </div>
          <Link
            href="/sou-criador"
            className="text-xs text-gray-400 hover:text-[#DD2A7B] transition-colors font-medium flex items-center gap-1.5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#DD2A7B] animate-pulse inline-block" />
            Você é criador? Comece a receber hoje
          </Link>
        </div>
      </footer>
    </div>
  )
}
