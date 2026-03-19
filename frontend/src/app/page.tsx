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
    <div className="min-h-screen bg-[#F9FAFB] text-[#111]">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-[#F9FAFB]/90 backdrop-blur-md border-b border-black/5">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-story">
            VOXA
          </span>
          <Link href="/login" className="text-sm font-semibold text-gray-500 hover:text-[#111] transition-colors">
            Entrar →
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-20 pb-14 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-white border border-black/8 px-4 py-1.5 rounded-full text-xs font-semibold text-gray-500 mb-8 shadow-sm">
          <Shield className="w-3.5 h-3.5 text-green-500" />
          Reembolso automático se não responder em 36h
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight text-[#111] mb-5">
          Sua dúvida respondida por
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-story">
            quem você admira.
          </span>
        </h1>

        <p className="text-gray-500 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
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
              className="group bg-white border border-black/8 rounded-[14px] p-6 hover:border-black/15 hover:shadow-md transition-all hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4 mb-5">
                <div className="story-ring shrink-0">
                  <img
                    src={c.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.username}`}
                    alt={c.username}
                    className="w-14 h-14 rounded-full object-cover border-2 border-white bg-gray-100"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#111] text-sm truncate">@{c.username}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{c.bio}</p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1 bg-gray-50 border border-black/8 px-2.5 py-1 rounded-full text-xs font-medium text-gray-600 mb-5">
                <Shield className="w-3 h-3" />
                Garantia VOXA
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-black/5">
                <p className="text-sm font-black text-[#111]">
                  A partir de <span className="text-transparent bg-clip-text bg-gradient-story">R$ {c.min_price}</span>
                </p>
                <span className="text-xs font-semibold text-gray-400 group-hover:text-[#fd1d1d] group-hover:translate-x-0.5 transition-all">
                  Perguntar →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="bg-white border-t border-b border-black/5 px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-transparent bg-clip-text bg-gradient-story mb-2">Amostras</p>
            <h2 className="text-2xl sm:text-3xl font-black text-[#111]">Veja como funciona</h2>
            <p className="text-gray-500 text-sm mt-2">Respostas reais de criadores da plataforma.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {AMOSTRAS.map((a) => (
              <div key={a.criador} className="rounded-[14px] overflow-hidden border border-black/8">
                <div className="relative w-full" style={{ paddingBottom: '177.77%' }}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${a.cor} bg-white flex flex-col items-center justify-center p-6 text-center`}>
                    <img src={a.avatar} alt={a.criador} className="w-16 h-16 rounded-full mb-4 border-2 border-white shadow-sm" />
                    <p className="text-xs font-bold text-[#111] mb-1">{a.criador}</p>
                    <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full mb-4">#{a.nicho}</span>
                    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-black/8 w-full">
                      <p className="text-xs font-bold text-[#111] mb-2 leading-snug">"{a.pergunta}"</p>
                      <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{a.preview}</p>
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

      {/* TRUST BAR */}
      <section className="px-6 py-14 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { icon: '⚡', titulo: 'Resposta garantida', desc: 'Em até 36h ou reembolso automático.' },
            { icon: '🔒', titulo: 'Pagamento seguro', desc: 'PIX com confirmação instantânea.' },
            { icon: '🎯', titulo: 'Personalizado', desc: 'Resposta feita para sua pergunta.' },
          ].map((t) => (
            <div key={t.titulo} className="bg-white border border-black/8 rounded-[14px] p-6 shadow-sm">
              <div className="text-3xl mb-3">{t.icon}</div>
              <h3 className="font-bold text-[#111] text-sm mb-2">{t.titulo}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/5 px-6 py-8 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <span className="font-bold text-transparent bg-clip-text bg-gradient-story">VOXA</span>
          </div>
          <Link href="/sou-criador" className="text-xs text-gray-400 hover:text-[#fd1d1d] transition-colors font-medium">
            Você é criador? Comece hoje →
          </Link>
        </div>
      </footer>
    </div>
  )
}
