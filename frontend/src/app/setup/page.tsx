'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Camera } from 'lucide-react'
import { trackFanSignUp } from '@/lib/analytics'

const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'dashboard', 'login', 'setup', 'perfil', 'vender',
  'auth', 'webhook', 'suporte', 'support', 'help', 'voxa', 'exemplo',
  'refund', 'refunds', 'join', 'history', 'settings', 'referral',
  'payment', 'callback', 'status', 'health', 'terms', 'privacy',
  'invite', 'invites', 'users', 'questions', 'spending', 'profile',
])

function SetupContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
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
        // Usar foto do Google como fallback
        setUserPhotoUrl(user.user_metadata?.avatar_url || null)
      }
    })
  }, [router])

  // Checar disponibilidade do username com debounce
  useEffect(() => {
    if (username.length < 3) {
      setUsernameStatus('idle')
      return
    }
    if (RESERVED_USERNAMES.has(username)) {
      setUsernameStatus('taken')
      return
    }
    const timeout = setTimeout(async () => {
      setUsernameStatus('checking')
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timeout)
  }, [username])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      setError('Formato inválido. Use JPG, PNG, WebP ou GIF.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo 5 MB.')
      return
    }

    setAvatarFile(file)
    // Revogar URL anterior para evitar memory leak
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(URL.createObjectURL(file))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || usernameStatus !== 'available') return
    setIsLoading(true)
    setError('')

    const supabase = createClient()

    // Upload avatar se selecionado
    let avatarUrl: string | null = userPhotoUrl || null
    if (avatarFile) {
      const path = `${userId}/${Date.now()}.jpg`
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type })

      if (uploadError || !data) {
        setError('Erro ao fazer upload do avatar. Tente novamente.')
        setIsLoading(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path)
      avatarUrl = publicUrl
    }

    // Ler referral do localStorage (válido por 7 dias)
    let referredById: string | null = null
    const ref = localStorage.getItem('voxa_ref')
    const refAt = localStorage.getItem('voxa_ref_at')
    if (ref && refAt && Date.now() - parseInt(refAt) < 7 * 24 * 60 * 60 * 1000) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', ref)
        .single()
      referredById = referrer?.id ?? null
    }

    const { error: insertError } = await supabase.from('profiles').insert({
      id: userId,
      username: username.toLowerCase().trim(),
      avatar_url: avatarUrl,
      account_type: 'fan',
      referred_by_id: referredById,
    })

    if (insertError) {
      setError('Erro ao criar perfil. Tente novamente.')
      setIsLoading(false)
      return
    }

    trackFanSignUp()

    // Checar invite code dos query params (passado pelo auth callback) ou localStorage (via /invite/[code])
    const inviteCode = searchParams.get('inviteCode') || localStorage.getItem('voxa_invite_code')
    if (inviteCode) {
      localStorage.removeItem('voxa_invite_code')
      try {
        const res = await fetch('/api/invite/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: inviteCode }),
        })
        if (res.ok) {
          router.push('/setup/creator')
          return
        }
      } catch {
        // Convite inválido/expirado — continuar normalmente
      }
    }

    // Checar returnUrl dos query params (passado pelo auth callback), sessionStorage (QuestionForm) ou localStorage (fallback)
    const returnUrl = searchParams.get('returnUrl') || sessionStorage.getItem('voxa_return_url') || localStorage.getItem('voxa_return_url')
    if (returnUrl) {
      sessionStorage.removeItem('voxa_return_url')
      localStorage.removeItem('voxa_return_url')
      // Validar que returnUrl é um path relativo seguro
      if (returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
        router.push(returnUrl)
      } else {
        router.push('/dashboard')
      }
      return
    }

    router.push('/dashboard')
  }

  const usernameHint = () => {
    if (username.length > 0 && username.length < 3) return { text: 'Mínimo 3 caracteres', color: 'text-gray-500' }
    if (usernameStatus === 'checking') return { text: 'Verificando...', color: 'text-gray-500' }
    if (usernameStatus === 'taken') return { text: 'Username já em uso', color: 'text-red-400' }
    if (usernameStatus === 'available') return { text: '✓ Disponível', color: 'text-green-400' }
    return null
  }

  const hint = usernameHint()
  const displayAvatar = avatarPreview || userPhotoUrl

  return (
    <div className="w-full max-w-md bg-[#111] rounded-[32px] border border-white/10 p-8 shadow-2xl relative z-10">
        <h1 className="text-2xl font-bold mb-1">Crie sua conta</h1>
        <p className="text-gray-500 text-sm mb-8">
          Escolha seu username para começar a usar a <span className="text-transparent bg-clip-text bg-gradient-instagram">VOXA</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Avatar */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
              <div className="w-20 h-20 rounded-full bg-[#1a1a1a] border-2 border-white/20 flex items-center justify-center overflow-hidden group-hover:border-white/40 transition-colors">
                {displayAvatar ? (
                  <img src={displayAvatar} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-gray-500" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-instagram rounded-full flex items-center justify-center">
                <Camera className="w-3.5 h-3.5 text-white" />
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-center text-xs text-gray-500 -mt-2">Foto opcional</p>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Username <span className="text-red-400">*</span></label>
            <input
              type="text"
              placeholder="ex: seu_nome"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              required
              maxLength={30}
              className="w-full bg-[#1a1a1a] border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
            />
            {hint && <p className={`text-xs mt-1 ${hint.color}`} aria-live="polite">{hint.text}</p>}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || usernameStatus !== 'available'}
            className="w-full bg-gradient-instagram rounded-xl py-3 px-4 text-white font-bold disabled:opacity-40 transition-all"
          >
            {isLoading ? 'Criando conta...' : 'Criar minha conta'}
          </button>
        </form>
      </div>
  )
}

export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-[#DD2A7B] opacity-10 blur-[70px] md:blur-[120px] rounded-full pointer-events-none -mt-16 sm:-mt-32 -mr-16 sm:-mr-32"></div>
      <div className="absolute -bottom-16 sm:-bottom-32 -left-16 sm:-left-32 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-purple-600 opacity-10 blur-[70px] md:blur-[120px] rounded-full pointer-events-none"></div>

      <Suspense fallback={
        <div className="w-full max-w-md bg-[#111] rounded-[32px] border border-white/10 p-8 shadow-2xl relative z-10 text-center">
          <h1 className="text-2xl font-bold mb-1">Crie sua conta</h1>
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      }>
        <SetupContent />
      </Suspense>
    </div>
  )
}
