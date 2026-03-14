'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [emailStep, setEmailStep] = useState<'idle' | 'input' | 'sent'>('idle')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

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
    // Se sucesso: o browser é redirecionado para o Google — não precisa de setIsLoading(false)
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setIsLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setIsLoading(false)
    if (error) {
      setError('Erro ao enviar o link. Verifique o e-mail e tente novamente.')
    } else {
      setEmailStep('sent')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4 text-white relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#DD2A7B] opacity-10 blur-[120px] rounded-full pointer-events-none -mt-32 -mr-32"></div>
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-purple-600 opacity-10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#111] rounded-[32px] border border-white/10 p-8 shadow-2xl text-center relative z-10">
        <h1 className="text-3xl font-bold mb-2">Entrar na <span className="text-transparent bg-clip-text bg-gradient-instagram">VOXA</span></h1>
        <p className="text-gray-400 mb-8">Faça login para gerenciar suas perguntas e doações.</p>

        {emailStep === 'sent' ? (
          <div className="p-5 bg-green-500/10 border border-green-500/30 rounded-2xl text-left">
            <p className="text-green-400 font-semibold mb-1">Link enviado!</p>
            <p className="text-sm text-gray-400">
              Verifique sua caixa de entrada em <strong>{email}</strong> e clique no link para entrar.
            </p>
            <button
              onClick={() => { setEmailStep('idle'); setEmail('') }}
              className="mt-4 text-xs text-gray-500 underline"
            >
              Usar outro e-mail
            </button>
          </div>
        ) : emailStep === 'input' ? (
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[#1a1a1a] border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
            />
            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full bg-gradient-instagram rounded-xl py-3 px-4 text-white font-semibold disabled:opacity-50 transition-all"
            >
              {isLoading ? 'Enviando...' : 'Enviar link de acesso'}
            </button>
            <button
              type="button"
              onClick={() => setEmailStep('idle')}
              className="text-xs text-gray-500 underline"
            >
              Voltar
            </button>
          </form>
        ) : (
          <div className="space-y-4 flex flex-col">
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full relative flex items-center justify-center border border-white/20 bg-[#1a1a1a] rounded-xl py-3 px-4 text-white font-semibold hover:bg-white/5 hover:border-white/30 transition-all disabled:opacity-50"
            >
              <span className="absolute left-4 w-6 h-6 flex items-center justify-center text-xs bg-white text-black rounded-full font-bold">G</span>
              {isLoading ? 'Redirecionando...' : 'Continuar com Google'}
            </button>

            <button
              onClick={() => setEmailStep('input')}
              disabled={isLoading}
              className="w-full relative flex items-center justify-center border border-white/20 bg-[#1a1a1a] rounded-xl py-3 px-4 text-white font-semibold hover:bg-white/5 hover:border-white/30 transition-all disabled:opacity-50"
            >
              <span className="absolute left-4 w-6 h-6 flex items-center justify-center text-xs bg-white text-black rounded-full font-bold">@</span>
              Continuar com E-mail
            </button>
          </div>
        )}

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
            Acesso independente via Google ou E-mail. A VOXA não solicita sua senha nem possui vínculo direto com o Instagram. Seus dados de rede social permanecem totalmente isolados.
          </p>
          <div className="pt-3 border-t border-white/5 flex items-start gap-2 text-xs text-gray-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 mt-1 shrink-0"></span>
            Verificado e Criptografado - Seus ganhos e dados estão protegidos.
          </div>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Ao entrar, você concorda com nossos Termos de Serviço e Política de Privacidade.
        </p>
      </div>
    </div>
  )
}
