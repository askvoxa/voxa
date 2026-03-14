'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [minPrice, setMinPrice] = useState(10)
  const [dailyLimit, setDailyLimit] = useState(10)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
      } else {
        setUserId(user.id)
      }
    })
  }, [router])

  // Checar disponibilidade do username com debounce
  useEffect(() => {
    if (username.length < 3) {
      setUsernameStatus('idle')
      return
    }
    const timeout = setTimeout(async () => {
      setUsernameStatus('checking')
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timeout)
  }, [username])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || usernameStatus !== 'available') return
    setIsLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      username: username.toLowerCase().trim(),
      bio: bio.trim() || null,
      min_price: minPrice,
      daily_limit: dailyLimit,
    })

    if (error) {
      setError('Erro ao criar perfil. Tente novamente.')
      setIsLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  const usernameHint = () => {
    if (username.length > 0 && username.length < 3) return { text: 'Mínimo 3 caracteres', color: 'text-gray-500' }
    if (usernameStatus === 'checking') return { text: 'Verificando...', color: 'text-gray-400' }
    if (usernameStatus === 'taken') return { text: 'Username já em uso', color: 'text-red-400' }
    if (usernameStatus === 'available') return { text: '✓ Disponível', color: 'text-green-400' }
    return null
  }

  const hint = usernameHint()

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#DD2A7B] opacity-10 blur-[120px] rounded-full pointer-events-none -mt-32 -mr-32"></div>
      <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] bg-purple-600 opacity-10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#111] rounded-[32px] border border-white/10 p-8 shadow-2xl relative z-10">
        <h1 className="text-2xl font-bold mb-1">Configure seu perfil</h1>
        <p className="text-gray-400 text-sm mb-8">
          Você vai compartilhar o link <span className="text-white font-medium">voxa.com/perfil/<span className="text-transparent bg-clip-text bg-gradient-instagram">{username || 'seuusername'}</span></span> com seus fãs.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Username <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder="ex: caio_muniz"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              required
              maxLength={30}
              className="w-full bg-[#1a1a1a] border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
            />
            {hint && <p className={`text-xs mt-1 ${hint.color}`}>{hint.text}</p>}
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Bio</label>
            <textarea
              placeholder="Descreva o que seus fãs podem te perguntar..."
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={200}
              rows={3}
              className="w-full bg-[#1a1a1a] border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-white/40 resize-none"
            />
          </div>

          {/* Preço mínimo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Preço mínimo por pergunta: <span className="text-white font-bold">R$ {minPrice}</span>
            </label>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={minPrice}
              onChange={e => setMinPrice(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>R$ 5</span>
              <span>R$ 100</span>
            </div>
          </div>

          {/* Limite diário */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Limite de perguntas por dia: <span className="text-white font-bold">{dailyLimit}</span>
            </label>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={dailyLimit}
              onChange={e => setDailyLimit(Number(e.target.value))}
              className="w-full accent-pink-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>1</span>
              <span>50</span>
            </div>
          </div>

          {/* Ganhos estimados */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
            <p className="text-xs text-gray-400 mb-1">Estimativa mensal com essa configuração:</p>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-instagram">
              R$ {(minPrice * dailyLimit * 30 * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">após 10% de taxa da plataforma</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || usernameStatus !== 'available'}
            className="w-full bg-gradient-instagram rounded-xl py-3 px-4 text-white font-bold disabled:opacity-40 transition-all"
          >
            {isLoading ? 'Criando perfil...' : 'Criar meu perfil'}
          </button>
        </form>
      </div>
    </div>
  )
}
