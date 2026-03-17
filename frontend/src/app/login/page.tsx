'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Reseta isLoading se o usuário voltar à página (ex: back do Google OAuth)
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setIsLoading(false)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError('Erro ao conectar com Google. Tente novamente.')
      setIsLoading(false)
    }
    // Se sucesso: browser redireciona para o Google — não precisa de setIsLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4 text-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#DD2A7B] opacity-10 blur-[120px] rounded-full pointer-events-none -mt-32 -mr-32"></div>
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-purple-600 opacity-10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#111] rounded-[32px] border border-white/10 p-8 shadow-2xl text-center relative z-10">
        <h1 className="text-3xl font-bold mb-2">Entrar na <span className="text-transparent bg-clip-text bg-gradient-instagram">VOXA</span></h1>
        <p className="text-gray-400 mb-8">Faça login para gerenciar suas perguntas e respostas.</p>

        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full relative flex items-center justify-center border border-white/20 bg-[#1a1a1a] rounded-xl py-3 px-4 text-white font-semibold hover:bg-white/5 hover:border-white/30 transition-all disabled:opacity-50"
        >
          <span className="absolute left-4 w-6 h-6 flex items-center justify-center text-xs bg-white text-black rounded-full font-bold">G</span>
          {isLoading ? 'Redirecionando...' : 'Continuar com Google'}
        </button>

        {error && (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        )}

        {/* Security Badge */}
        <div className="mt-8 p-5 bg-white/5 border border-white/10 rounded-2xl text-left shadow-inner">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            <h3 className="font-bold text-sm text-white">Segurança Total</h3>
          </div>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            Acesso via Google. A VOXA não solicita sua senha nem possui vínculo direto com o Instagram. Seus dados de rede social permanecem totalmente isolados.
          </p>
          <div className="pt-3 border-t border-white/5 flex items-start gap-2 text-xs text-gray-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 mt-1 shrink-0"></span>
            Verificado e Criptografado — Seus ganhos e dados estão protegidos.
          </div>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Ao entrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
        </p>
      </div>
    </div>
  )
}
