'use client'

import { useState } from 'react'

export default function ReferralDashboardPage() {
  const [copied, setCopied] = useState(false)
  const username = "teste" // Será substituído futuramente pelo usuário logado
  const referralLink = `https://voxa.com/join?ref=${username}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 py-4 px-6 md:px-12 flex items-center shadow-sm">
        <h1 className="font-bold text-xl text-gradient-instagram">VOXA <span className="text-gray-400 font-normal">| Afiliados</span></h1>
      </header>
      
      <main className="flex-1 max-w-5xl mx-auto w-full p-6 py-10">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Programa de Afiliados</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Convide outros criadores de conteúdo para usar a VOXA e ganhe <strong className="text-black">20% de todas as nossas taxas de serviço</strong> geradas pelas perguntas deles, para sempre!
          </p>
        </div>

        {/* Quadro de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
            <div className="w-12 h-12 bg-orange-100 text-[#F58529] rounded-2xl flex items-center justify-center mb-4">
              <span className="font-bold text-xl">👥</span>
            </div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Total de Indicados</p>
            <p className="text-4xl font-extrabold text-gray-900">12</p>
          </div>
          
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
            <div className="w-12 h-12 bg-pink-100 text-[#DD2A7B] rounded-2xl flex items-center justify-center mb-4">
              <span className="font-bold text-xl">💸</span>
            </div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Comissões Acumuladas</p>
            <p className="text-4xl font-extrabold text-[#DD2A7B]">R$ 450,00</p>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
            <div className="w-12 h-12 bg-purple-100 text-[#8134AF] rounded-2xl flex items-center justify-center mb-4">
              <span className="font-bold text-xl">💰</span>
            </div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Disponível para Saque</p>
            <p className="text-4xl font-extrabold text-gray-900 mb-3">R$ 125,00</p>
            <button className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-4 rounded-xl transition-colors">
              Sacar via PIX
            </button>
          </div>
        </div>

        {/* Card do Link de Indicação */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm mb-10 text-center">
          <h3 className="text-xl font-bold mb-2">Seu Link de Indicação Ouro 🏆</h3>
          <p className="text-gray-500 text-sm mb-6">Compartilhe este link em suas redes ou com colegas criadores.</p>
          
          <div className="flex flex-col md:flex-row gap-3 max-w-3xl mx-auto">
            <input 
              type="text" 
              readOnly 
              value={referralLink}
              className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-gray-700 font-medium font-mono focus:outline-none focus:border-gray-300"
            />
            <button 
              onClick={copyToClipboard}
              className={`font-bold text-lg py-4 px-8 rounded-2xl shadow-sm transition-all ${
                copied 
                  ? 'bg-green-500 hover:bg-green-600 text-white' 
                  : 'bg-gradient-instagram text-white hover:opacity-90'
              }`}
            >
              {copied ? 'Copiado! ✓' : 'Copiar Link'}
            </button>
          </div>
        </div>

      </main>
    </div>
  )
}
