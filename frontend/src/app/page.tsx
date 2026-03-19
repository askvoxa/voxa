import Link from 'next/link'
import { Shield } from 'lucide-react'
import SearchBar from '@/components/SearchBar'
import { createClient } from '@/lib/supabase/server'

const AMOSTRAS = [
  {
    criador: 'Ana Luiza',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=analuiza&backgroundColor=b6e3f4',
    pergunta: 'Qual o melhor horário para treinar?',
    preview: 'Depende do seu cronotipo — matutinos performam melhor de manhã, vespertinos à tarde...',
    nicho: 'Fitness',
    cor: 'from-rose-500/20 to-orange-500/10',
  },
  {
    criador: 'Rafael Mendes',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rafaelmendes&backgroundColor=c0aede',
    pergunta: 'Onde investir com R$ 500/mês?',
    preview: 'Com esse aporte eu começaria pelo Tesouro Selic como reserva, depois migraria...',
    nicho: 'Finanças',
    cor: 'from-violet-500/20 to-blue-500/10',
  },
  {
    criador: 'Marcelo Souza',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marcelosouza&backgroundColor=ffdfbf',
    pergunta: 'Como fazer massa de pizza crocante?',
    preview: 'O segredo está na temperatura do forno e na hidratação da massa...',
    nicho: 'Gastronomia',
    cor: 'from-amber-500/20 to-yellow-500/10',
  },
]

export default async function HomePage() {
  const supabase = createClient()
  const { data: creators } = await supabase
    .from('profiles')
    .select('username, bio, avatar_url, min_price')
    .in('username', ['luciane', 'henrique', 'jefersonkollenz'])

  const creatorMap = new Map(creators?.map(c => [c.username, c]) ?? [])
  const creatorsList = [
    creatorMap.get('luciane') || { username: 'luciane', bio: 'Criador na VOXA', min_price: 15, avatar_url: null },
    creatorMap.get('henrique') || { username: 'henrique', bio: 'CEO & Founder of VOXA', min_price: 10, avatar_url: null },
    creatorMap.get('jefersonkollenz') || { username: 'jefersonkollenz', bio: 'Pra quem tem pensamento forte...', min_price: 10, avatar_url: null },
  ]

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F9FAFB]">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-black tracking-tight text-[#A78BFA]">
            VOXA
          </span>
          <Link href="/login" className="text-sm font-semibold text-[#6B7280] hover:text-[#F9FAFB] transition-colors">
            Entrar →
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-20 pb-14 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-[#12121A] border border-white/8 px-4 py-1.5 rounded-full text-xs font-semibold text-[#9CA3AF] mb-8">
          <Shield className="w-3.5 h-3.5 text-green-400" />
          Reembolso automático se não responder em 36h
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight text-[#F9FAFB] mb-5">
          Sua dúvida respondida por
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A78BFA] to-[#7C3AED]">
            quem você admira.
          </span>
        </h1>

        <p className="text-[#9CA3AF] text-lg mb-10 max-w-xl mx-auto leading-relaxed">
          Respostas personalizadas em texto ou áudio. Receba em até 36h — ou seu dinheiro de volta.
        </p>

        <SearchBar />
      </section>

      {/* GRID DE CRIADORES */}
      <section className="px-6 pb-20 pt-10 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {creatorsList.map((c) => (
            <Link
              key={c.username}
              href={`/perfil/${c.username}`}
              className="group bg-[#12121A] border border-white/7 rounded-[14px] p-6 hover:bg-[#16161F] hover:border-white/12 hover:translate-y-[-2px] hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-200"
            >
              <div className="flex items-center gap-4 mb-5">
                <img
                  src={c.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.username}`}
                  alt={c.username}
                  className="w-14 h-14 rounded-full object-cover bg-[#1a1a1a] border border-white/10"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#F9FAFB] text-sm truncate">@{c.username}</p>
                  <p className="text-xs text-[#9CA3AF] truncate mt-0.5">{c.bio}</p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1 bg-[#7C3AED]/10 border border-[#7C3AED]/20 px-2.5 py-1 rounded-full text-xs font-medium text-[#A78BFA] mb-5">
                <Shield className="w-3 h-3 text-[#7C3AED]" />
                Garantia VOXA
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <p className="text-sm font-black text-[#F9FAFB]">
                  A partir de <span className="text-[#A78BFA]">R$ {c.min_price}</span>
                </p>
                <span className="text-xs font-semibold text-[#6B7280] group-hover:text-[#7C3AED] group-hover:translate-x-0.5 transition-all">
                  Perguntar →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="bg-[#0D0D14] border-t border-b border-white/5 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[#7C3AED] mb-2">Amostras</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#F9FAFB]">Veja como funciona</h2>
            <p className="text-[#9CA3AF] text-sm mt-2">Respostas reais de criadores da plataforma.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {AMOSTRAS.map((a) => (
              <div key={a.criador} className="rounded-[14px] overflow-hidden border border-white/8">
                <div className="relative w-full" style={{ paddingBottom: '177.77%' }}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${a.cor} bg-[#0D0D14] flex flex-col items-center justify-center p-6 text-center`}>
                    <img src={a.avatar} alt={a.criador} className="w-16 h-16 rounded-full mb-4 border-2 border-white shadow-sm" />
                    <p className="text-xs font-bold text-[#F9FAFB] mb-1">{a.criador}</p>
                    <span className="text-[10px] font-semibold text-[#9CA3AF] bg-[#1a1a1a] px-2 py-0.5 rounded-full mb-4">#{a.nicho}</span>
                    <div className="bg-[#12121A]/80 backdrop-blur-sm rounded-2xl p-4 border border-white/8 w-full">
                      <p className="text-xs font-bold text-[#F9FAFB] mb-2 leading-snug">"{a.pergunta}"</p>
                      <p className="text-[11px] text-[#9CA3AF] leading-relaxed line-clamp-2">{a.preview}</p>
                    </div>
                    <div className="mt-4 flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-green-400" />
                      <span className="text-[10px] text-[#6B7280] font-medium">Garantia VOXA</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="px-6 py-14 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { icon: '⚡', titulo: 'Resposta garantida', desc: 'Em até 36h ou reembolso automático.' },
            { icon: '🔒', titulo: 'Pagamento seguro', desc: 'PIX com confirmação instantânea.' },
            { icon: '🎯', titulo: 'Personalizado', desc: 'Resposta feita para sua pergunta.' },
          ].map((t) => (
            <div key={t.titulo} className="bg-[#12121A] border border-white/7 rounded-[14px] p-6">
              <div className="text-3xl mb-3">{t.icon}</div>
              <h3 className="font-bold text-[#F9FAFB] text-sm mb-2">{t.titulo}</h3>
              <p className="text-sm text-[#9CA3AF] leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 px-6 py-8 bg-[#0A0A0F]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-xs text-[#6B7280]">
            <span className="font-bold text-[#A78BFA]">VOXA</span>
          </div>
          <Link href="/sou-criador" className="text-xs text-[#6B7280] hover:text-[#7C3AED] transition-colors font-medium">
            Você é criador? Comece hoje →
          </Link>
        </div>
      </footer>
    </div>
  )
}
