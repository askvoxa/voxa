'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ReferralDashboardPage() {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [username, setUsername] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      if (profile) setUsername(profile.username)
    }
    load()
  }, [router])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== 'undefined' ? window.location.origin : '')
  const referralLink = username ? `${appUrl}/join?ref=${username}` : ''

  const copyToClipboard = () => {
    if (!referralLink) return
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 py-4 px-6 md:px-12 flex items-center gap-3 shadow-sm">
        <a href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="font-bold text-xl text-gradient-instagram">VOXA <span className="text-gray-400 font-normal">| Afiliados</span></h1>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 py-10">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Programa de Afiliados</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">
            Convide outros criadores de conteúdo para usar a VOXA e ganhe <strong className="text-black">20% de todas as nossas taxas de serviço</strong> geradas pelas perguntas deles, para sempre!
          </p>
        </div>

        {/* Métricas — Em breve */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {[
            { icon: '👥', label: 'Total de Indicados', color: 'bg-orange-100 text-[#F58529]' },
            { icon: '💸', label: 'Comissões Acumuladas', color: 'bg-pink-100 text-[#DD2A7B]' },
            { icon: '💰', label: 'Disponível para Saque', color: 'bg-purple-100 text-[#8134AF]' },
          ].map(({ icon, label, color }) => (
            <div key={label} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
              <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center mb-4`}>
                <span className="font-bold text-xl">{icon}</span>
              </div>
              <p className="text-sm font-semibold text-gray-500 mb-2">{label}</p>
              <span className="text-xs font-semibold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">Em breve</span>
            </div>
          ))}
        </div>

        {/* Card do Link de Indicação */}
        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm mb-10 text-center">
          <h3 className="text-xl font-bold mb-2">Seu Link de Indicação 🏆</h3>
          <p className="text-gray-500 text-sm mb-6">Compartilhe este link em suas redes ou com colegas criadores.</p>

          <div className="flex flex-col md:flex-row gap-3 max-w-3xl mx-auto">
            <input
              type="text"
              readOnly
              value={referralLink || 'Carregando...'}
              className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 text-gray-700 font-medium font-mono focus:outline-none focus:border-gray-300"
            />
            <button
              onClick={copyToClipboard}
              disabled={!referralLink}
              className={`font-bold text-lg py-4 px-8 rounded-2xl shadow-sm transition-all disabled:opacity-50 cursor-pointer ${
                copied
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-gradient-instagram text-white hover:opacity-90'
              }`}
            >
              <span aria-live="polite">{copied ? 'Copiado! ✓' : 'Copiar Link'}</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
