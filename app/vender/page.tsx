'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mic, Video, TrendingUp, HandCoins, Users, Settings, ArrowRight, ShieldCheck } from 'lucide-react'

export default function VenderPage() {
  const [price, setPrice] = useState(10)
  const [questionsPerDay, setQuestionsPerDay] = useState(5)

  const monthlyEarnings = price * questionsPerDay * 30

  // 10% fee
  const netEarnings = monthlyEarnings * 0.9

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#DD2A7B] selection:text-white pb-20">
      
      {/* Header Simples */}
      <header className="px-6 py-6 flex justify-between items-center max-w-6xl mx-auto border-b border-white/5">
        <h1 className="font-bold text-2xl text-transparent bg-clip-text bg-gradient-instagram">
          VOXA
        </h1>
        <div className="flex gap-4">
          <Link href="/login" className="text-gray-400 hover:text-white font-medium py-2 px-4 transition-colors">
            Entrar
          </Link>
          <Link href="/login" className="bg-white text-black font-bold py-2 px-6 rounded-full hover:scale-105 transition-transform">
            Cadastrar
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-20">
        
        {/* HERO SECTION */}
        <section className="text-center max-w-4xl mx-auto mb-32">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 text-sm text-gray-300">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Nova forma de monetizar sua audiência
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold mb-8 tracking-tight leading-tight">
            Monetize com sua influência. <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-instagram">Pare de abrir caixinhas gratuitas no Instagram.</span>
          </h1>
          <p className="text-xl text-gray-400 mb-6 max-w-2xl mx-auto leading-relaxed">
            Dicas rápidas a partir de R$ 10. Conteúdo exclusivo em vídeo por R$ 50. Transforme seu tempo ocioso em faturamento real.
          </p>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-w-xl mx-auto mb-12 flex items-center gap-4">
            <span className="text-3xl">☕</span>
            <p className="text-gray-300 text-sm text-left font-medium leading-relaxed">
              Monetize seu tempo ocioso: um áudio de 20 segundos vale <strong className="text-white">R$ 10</strong>.
              Dez áudios respondidos na fila do café = <strong className="text-green-400">R$ 100 direto na sua conta.</strong>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/login"
              className="w-full sm:w-auto bg-gradient-instagram text-white font-bold text-lg px-8 py-4 rounded-full hover:scale-105 transition-all shadow-[0_0_40px_-10px_#DD2A7B] flex items-center justify-center gap-2"
            >
              Criar meu Perfil VOXA agora <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="/perfil/exemplo"
              className="w-full sm:w-auto bg-white/5 text-white border border-white/10 font-bold text-lg px-8 py-4 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
            >
              Ver perfil de exemplo
            </Link>
          </div>
        </section>

        {/* BENEFÍCIOS (Bento Grid) */}
        <section className="mb-32">
          <h2 className="text-3xl font-bold mb-12 text-center">Tudo que você precisa para lucrar.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1 */}
            <div className="bg-[#111] border border-white/5 rounded-[32px] p-8 hover:border-white/10 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Users className="text-emerald-400 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Filtre sua audiência</h3>
              <p className="text-gray-400 leading-relaxed">
                Receba apenas perguntas de quem realmente valoriza seu tempo.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-[#111] border border-white/5 rounded-[32px] p-8 hover:border-white/10 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#DD2A7B]/20 to-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Mic className="text-[#DD2A7B] w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Respostas em Áudio</h3>
              <p className="text-gray-400 leading-relaxed">
                Responda rápido, de onde estiver, sem a pressão de gravar um vídeo perfeito.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-[#111] border border-white/5 rounded-[32px] p-8 hover:border-white/10 transition-colors group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Settings className="text-cyan-400 w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Privacidade</h3>
              <p className="text-gray-400 leading-relaxed">
                Acabe com a bagunça das DMs e mantenha o foco no que importa.
              </p>
            </div>

          </div>
        </section>

        {/* SEGURANÇA DE ELITE */}
        <section className="mb-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-3">
              <ShieldCheck className="w-8 h-8 text-green-400" /> Segurança de Elite
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Proteção dupla para você e sua conta. Monetize com tranquilidade absoluta.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#111] border border-white/5 rounded-[32px] p-8 hover:border-white/10 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center mb-6">
                <span className="text-2xl">🛡️</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Zero Acesso à Conta</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                A VOXA não solicita sua senha do Instagram nem se conecta diretamente à sua conta. Seus dados de rede social permanecem 100% privados e seguros.
              </p>
            </div>

            <div className="bg-[#111] border border-white/5 rounded-[32px] p-8 hover:border-white/10 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
                <span className="text-2xl">🔑</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Login Independente</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Acesse a plataforma via E-mail ou Google. Sem vínculos de API com o Instagram, o que blinda sua conta contra Shadowbans ou Hacks.
              </p>
            </div>

            <div className="bg-[#111] border border-white/5 rounded-[32px] p-8 hover:border-white/10 transition-colors">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-[#DD2A7B]/20 flex items-center justify-center mb-6">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="text-xl font-bold mb-3">Filtro Anti-Spam (IA)</h3>
              <p className="text-gray-400 leading-relaxed text-sm">
                Nossa Inteligência Artificial filtra 100% de conteúdos ofensivos, assédios ou links maliciosos antes mesmo de chegarem até você.
              </p>
            </div>
          </div>
        </section>

        {/* SIMULADOR DE GANHOS */}
        <section className="max-w-4xl mx-auto bg-[#111] border border-white/10 rounded-[40px] p-8 md:p-12 mb-32 relative overflow-hidden">
          {/* Glow effects */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#DD2A7B] opacity-10 blur-[120px] rounded-full pointer-events-none -mt-32 -mr-32"></div>
          <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-purple-600 opacity-10 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
            
            <div className="flex-1 w-full space-y-8">
              <div>
                <h2 className="text-3xl font-bold mb-2">Simule seus Ganhos</h2>
                <p className="text-gray-400">Descubra quanto você poderia estar ganhando todo mês respondendo algumas perguntas por dia.</p>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-300">Preço Médio por Pergunta</label>
                    <span className="font-mono text-[#DD2A7B] font-bold">R$ {price}</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="200" 
                    step="10"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#DD2A7B]"
                  />
                  <div className="flex justify-between mt-1 text-xs text-gray-600">
                    <span>R$ 10</span>
                    <span>R$ 200+</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-300">Perguntas Respondidas por Dia</label>
                    <span className="font-mono text-[#DD2A7B] font-bold">{questionsPerDay}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="50" 
                    step="1"
                    value={questionsPerDay}
                    onChange={(e) => setQuestionsPerDay(Number(e.target.value))}
                    className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#DD2A7B]"
                  />
                  <div className="flex justify-between mt-1 text-xs text-gray-600">
                    <span>1 p/ dia</span>
                    <span>50 p/ dia</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full md:w-80 bg-black/50 backdrop-blur-md rounded-[32px] p-8 border border-white/10 text-center shrink-0">
              <TrendingUp className="w-10 h-10 text-green-400 mx-auto mb-4" />
              <p className="text-gray-400 text-sm mb-2 font-medium">Ganho Estimado / Mês</p>
              <p className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-green-400 to-emerald-600 mb-2">
                R$ {monthlyEarnings.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-white/5">
                Já descontando nossa taxa justa de 10% (Você recebe R$ {netEarnings.toLocaleString('pt-BR')}).
              </p>
            </div>

          </div>
        </section>

      </main>
    </div>
  )
}
