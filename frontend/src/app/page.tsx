import Link from 'next/link'
import { Shield, Play, Mic2, Video } from 'lucide-react'
import SearchBar from '@/components/SearchBar'
import { createClient } from '@/lib/supabase/server'

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
          <Link href="/login" className="text-sm font-semibold text-gray-500 hover:text-[#111] transition-colors px-4 py-2 rounded-full border border-black/5 hover:border-black/15 bg-white/50 hover:bg-white">
            Entrar →
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-20 pb-14 px-6 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-gray-50/80 border border-black/5 px-4 py-1.5 rounded-full text-xs font-semibold text-gray-400 mb-8">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
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
          Respostas personalizadas e sob sua demanda em texto, áudio ou vídeo. Receba em até 36h — ou seu dinheiro de volta.
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
            {/* Card 1 — TEXTO */}
            <div className="rounded-[14px] overflow-hidden border border-black/8">
              <div className="relative w-full" style={{ paddingBottom: '177.77%' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-blue-500/10 bg-white flex flex-col items-center justify-center p-5 text-center">
                  <div className="story-ring mb-3">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=rafaelmendes&backgroundColor=c0aede" alt="Rafael Mendes" className="w-14 h-14 rounded-full border-2 border-white object-cover" />
                  </div>
                  <p className="text-xs font-bold text-[#111] mb-0.5">Rafael Mendes</p>
                  <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full mb-3">#Finanças</span>
                  <p className="text-[10px] font-semibold text-gray-600 mb-3 leading-snug">
                    "Onde investir com R$ 500/mês?"
                  </p>
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl rounded-bl-sm p-3 border border-black/8 w-full text-left">
                    <div className="flex items-start gap-2">
                      <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=rafaelmendes&backgroundColor=c0aede" alt="Rafael" className="w-6 h-6 rounded-full shrink-0 mt-0.5 object-cover border border-black/5" />
                      <p className="text-[10px] text-gray-700 leading-relaxed">
                        Com esse aporte eu começaria pelo Tesouro Selic como reserva, depois migraria para ETFs...
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto pt-3 flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] text-gray-400 font-medium">Garantia VOXA</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2 — ÁUDIO */}
            <div className="rounded-[14px] overflow-hidden border border-black/8">
              <div className="relative w-full" style={{ paddingBottom: '177.77%' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/20 to-orange-500/10 bg-white flex flex-col items-center justify-center p-5 text-center">
                  <div className="story-ring mb-2">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=analuiza&backgroundColor=b6e3f4" alt="Ana Luiza" className="w-14 h-14 rounded-full border-2 border-white object-cover" />
                  </div>
                  <p className="text-xs font-bold text-[#111] mb-1">Ana Luiza</p>
                  <div className="inline-flex items-center gap-1 mb-1">
                    <Mic2 className="w-3 h-3" style={{color: '#833ab4'}} />
                    <span className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-story">Resposta em Áudio</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full mb-3">#Fitness</span>
                  <p className="text-[10px] font-semibold text-gray-600 mb-3 leading-snug line-clamp-2">
                    "Qual o melhor carboidrato para consumir com alto volume?"
                  </p>
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-3 border border-black/8 w-full">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-story flex items-center justify-center shrink-0 shadow-sm">
                        <Play className="w-3 h-3 text-white fill-white ml-0.5" />
                      </div>
                      <span className="text-[10px] font-mono text-gray-500">00:41 / 02:34</span>
                    </div>
                    <div className="flex items-end gap-px h-6 w-full">
                      {[3,5,8,4,7,9,3,6,8,4,5,7,3,4,6,8,5,3,7,9,4,6,3,5,8,4,7,3].map((h, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full ${i < 11 ? 'bg-[#833ab4]' : 'bg-gray-200'}`}
                          style={{ height: `${h * 2.5}px` }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mt-auto pt-3 flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] text-gray-400 font-medium">Garantia VOXA</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3 — VÍDEO */}
            <div className="rounded-[14px] overflow-hidden border border-black/8">
              <div className="relative w-full" style={{ paddingBottom: '177.77%' }}>
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-yellow-500/10 bg-white flex flex-col items-center justify-center p-5 text-center">
                  <div className="story-ring mb-2">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=marcelosouza&backgroundColor=ffdfbf" alt="Marcelo Souza" className="w-14 h-14 rounded-full border-2 border-white object-cover" />
                  </div>
                  <p className="text-xs font-bold text-[#111] mb-1">Marcelo Souza</p>
                  <div className="inline-flex items-center gap-1 mb-1">
                    <Video className="w-3 h-3" style={{color: '#fd1d1d'}} />
                    <span className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-story">Resposta em Vídeo</span>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full mb-3">#Lifestyle</span>
                  <p className="text-[10px] font-semibold text-gray-600 mb-3 leading-snug line-clamp-2">
                    "Minha namorada é uma grande fã sua, pode gravar um vídeo de parabéns?"
                  </p>
                  <div className="relative w-full rounded-xl overflow-hidden aspect-video shadow-sm">
                    <img
                      src="https://api.dicebear.com/7.x/avataaars/svg?seed=marcelosouza&backgroundColor=ffdfbf"
                      className="w-full h-full object-cover"
                      alt="Thumbnail"
                    />
                    <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-md">
                        <Play className="w-4 h-4 text-[#111] fill-[#111] ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute bottom-1.5 right-2">
                      <span className="text-white text-[10px] font-mono font-bold drop-shadow">0:45</span>
                    </div>
                  </div>
                  <div className="mt-auto pt-3 flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] text-gray-400 font-medium">Garantia VOXA</span>
                  </div>
                </div>
              </div>
            </div>
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
          <Link href="/vender" className="text-xs text-gray-400 hover:text-[#fd1d1d] transition-colors font-medium">
            Você é criador? Comece hoje →
          </Link>
        </div>
      </footer>
    </div>
  )
}
