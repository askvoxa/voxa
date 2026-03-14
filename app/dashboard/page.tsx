'use client'

import { useState, useRef } from 'react'
import html2canvas from 'html2canvas'

export default function DashboardPage() {
  const [selectedStory, setSelectedStory] = useState<any>(null)
  const storyRef = useRef<HTMLDivElement>(null)

  const downloadStory = async () => {
    if (!storyRef.current) return;
    try {
      const canvas = await html2canvas(storyRef.current);
      const image = canvas.toDataURL("image/jpeg", 0.9);
      const link = document.createElement("a");
      link.href = image;
      link.download = `story-${selectedStory.id}.jpg`;
      link.click();
    } catch (err) {
      console.error("Erro ao gerar imagem", err);
      alert("Não foi possível gerar a imagem.");
    }
  }

  // Caio Muniz Demonstration Mocks
  const mockQuestions = [
    { id: 101, name: 'Fã 1', amount: 50, timeAgo: 'Há 2h', method: 'PIX', content: 'Caio, onde levar minha namorada para jantar no aniversário dela em Copacabana? Orçamento médio.', status: 'pending', type: 'premium', isShareable: true },
    { id: 102, name: 'Fã 2', amount: 10, timeAgo: 'Há 5h', method: 'Cartão', content: 'Melhor bar de drinks na Lapa para ir com amigos no sábado?', status: 'pending', type: 'base', isShareable: true },
    { id: 103, name: 'Fã 3', amount: 30, timeAgo: 'Há 14h', method: 'PIX', content: 'Dica de restaurante romântico e com vista na Zona Sul, por favor!', status: 'pending', type: 'base', isShareable: false },
  ]

  const sortedQuestions = mockQuestions

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="font-bold text-xl text-gradient-instagram">VOXA</h1>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-instagram p-[2px]">
              <div className="w-full h-full rounded-full bg-white border-2 border-white overflow-hidden">
                <img src={`https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=200&h=200`} alt="Avatar Caio Muniz" className="object-cover w-full h-full" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8 p-6 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F56040] rounded-3xl text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-20 -mt-20"></div>
          <h2 className="text-3xl font-bold mb-2 relative z-10">Olá, Caio Muniz! 👋</h2>
          <p className="text-lg opacity-90 relative z-10">Você tem 3 perguntas pendentes aguardando sua recomendação.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-1">Ganhos Hoje</p>
            <p className="text-3xl font-bold text-green-600">R$ 420,00</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-1">Total Respondido</p>
            <p className="text-3xl font-bold">12</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-500 font-medium mb-1">Tempo Médio de Resposta</p>
            <p className="text-3xl font-bold text-[#DD2A7B]">14h</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold mb-6">Perguntas Pendentes</h3>
          
          <div className="space-y-4">
            {sortedQuestions.map(q => {
              const highlightLevel = q.amount >= 50 ? 'high' : q.amount >= 30 ? 'medium' : 'low'
              
              return (
                <div 
                  key={q.id} 
                  className={`rounded-2xl p-4 md:p-6 transition-all border ${
                    highlightLevel === 'high' ? 'border-[#DD2A7B]/50 bg-pink-50/30 shadow-md transform hover:-translate-y-1' :
                    highlightLevel === 'medium' ? 'border-orange-200 bg-orange-50/30' :
                    'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-lg flex items-center gap-2">
                        {q.name} 
                        {q.timeAgo.includes('14h') && <span className="text-red-600 bg-red-100 px-2 py-0.5 rounded text-xs font-bold tracking-wide animate-pulse">URGENTE</span>}
                        {q.type === 'premium' && <span className="text-[#DD2A7B] bg-pink-100 px-2 py-0.5 rounded text-xs font-bold tracking-wide">PREMIUM</span>}
                        <span className="text-green-600 text-sm font-semibold ml-2">R$ {q.amount.toFixed(2).replace('.', ',')}</span>
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {q.timeAgo} • Doação via {q.method} • <span className="font-medium text-gray-700">{q.type === 'premium' ? '🎥 Vídeo (Premium)' : '💬 Resposta Base'}</span>
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-800 text-lg mb-6 leading-relaxed">
                    "{q.content}"
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    {q.type === 'base' ? (
                      <>
                        <button className="flex-1 font-bold py-3 px-4 rounded-xl transition-all shadow-sm flex justify-center items-center gap-2 bg-gradient-to-r from-purple-500 to-[#DD2A7B] text-white hover:shadow-lg hover:opacity-90 border-none">
                          🎙️ Responder por Áudio
                        </button>
                        <button className="flex-1 font-bold py-3 px-4 rounded-xl transition-all flex justify-center items-center gap-2 border-2 border-gray-200 text-gray-600 hover:bg-gray-50">
                          💬 Responder por Texto
                        </button>
                      </>
                    ) : (
                      <button className="flex-1 font-bold py-3 px-4 rounded-xl transition-all shadow-sm flex justify-center items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-lg hover:opacity-90 border-none">
                        🎥 Gravar Vídeo (15s - 60s)
                      </button>
                    )}
                  </div>

                  {q.isShareable && (
                    <div className="mt-4 pt-4 border-t border-gray-100/50 flex justify-end">
                      <button 
                        onClick={() => setSelectedStory(q)}
                        className="text-sm font-semibold text-gray-500 hover:text-[#DD2A7B] flex items-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        Preparar p/ Story
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Modal de Story */}
      {selectedStory && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-[400px] flex flex-col items-center">
             <div className="w-full flex justify-between items-center mb-4 px-2">
               <button onClick={() => setSelectedStory(null)} className="text-white hover:text-gray-300 font-bold text-sm bg-black/40 px-4 py-2 rounded-full">Cancelar</button>
               <button onClick={downloadStory} className="bg-white text-black font-bold text-sm px-4 py-2 rounded-full flex items-center gap-2 hover:bg-gray-100">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                 Salvar Imagem
               </button>
             </div>

             <div 
               ref={storyRef}
               className="w-[360px] h-[640px] bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F56040] rounded-[32px] p-8 flex flex-col justify-center relative overflow-hidden shadow-2xl"
             >
               <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-20 -mt-20"></div>
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400 opacity-20 rounded-full blur-3xl -ml-20 -mb-20"></div>

               <div className="bg-white rounded-3xl p-6 shadow-xl relative z-10 w-full">
                 <div className="flex items-center gap-3 mb-4">
                   <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                     👤
                   </div>
                   <div>
                     <p className="font-bold text-gray-900 text-sm">{selectedStory.name}</p>
                     <p className="text-xs text-gray-500">enviou uma pergunta</p>
                   </div>
                 </div>
                 <p className="text-gray-800 text-xl font-medium leading-relaxed mb-6">
                   "{selectedStory.content}"
                 </p>
                 <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4"></div>
                 <p className="text-center font-bold text-transparent bg-clip-text bg-gradient-instagram text-sm">
                   voxa.com/caio-muniz
                 </p>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
