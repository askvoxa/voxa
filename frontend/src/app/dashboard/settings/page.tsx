'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [bio, setBio] = useState('')
  const [minPrice, setMinPrice] = useState(10)
  const [dailyLimit, setDailyLimit] = useState(10)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, bio, avatar_url, min_price, daily_limit')
        .eq('id', user.id)
        .single()

      if (!profile) { router.push('/setup'); return }

      setUsername(profile.username)
      setBio(profile.bio ?? '')
      setMinPrice(profile.min_price ?? 10)
      setDailyLimit(profile.daily_limit ?? 10)
      setAvatarUrl(profile.avatar_url ?? '')
      setIsLoading(false)
    }
    load()
  }, [router])

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    setSuccess(false)

    const trimmedAvatarUrl = avatarUrl.trim()
    if (trimmedAvatarUrl && !trimmedAvatarUrl.startsWith('https://')) {
      setError('URL da foto de perfil deve começar com https://')
      setIsSaving(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        bio: bio.trim().slice(0, 200) || null,
        min_price: minPrice,
        daily_limit: dailyLimit,
        avatar_url: trimmedAvatarUrl || null,
      })
      .eq('id', user.id)

    setIsSaving(false)
    if (updateError) {
      setError('Erro ao salvar. Tente novamente.')
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  const previewAvatar = avatarUrl.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
  const netMonthly = minPrice * dailyLimit * 30 * 0.9

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="font-bold text-xl text-gradient-instagram">VOXA</h1>
          </div>
          <span className="text-sm text-gray-500">Configurações</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Avatar */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-bold text-lg mb-4">Foto de perfil</h2>
          <div className="flex items-center gap-4">
            <img
              src={previewAvatar}
              alt="Avatar"
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-100"
              onError={(e) => {
                const el = e.target as HTMLImageElement
                el.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
              }}
            />
            <div className="flex-1">
              <input
                type="url"
                value={avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                placeholder="URL da imagem (deixe em branco para usar avatar gerado)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]"
              />
              <p className="text-xs text-gray-400 mt-1">Deixe em branco para usar o avatar padrão gerado automaticamente.</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-bold text-lg mb-4">Bio</h2>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Conte um pouco sobre você e o que você responde..."
            rows={3}
            maxLength={200}
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#DD2A7B] resize-none"
          />
          <p className="text-right text-xs text-gray-400 mt-1">{bio.length}/200</p>
        </div>

        {/* Preço mínimo */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-bold text-lg mb-1">Preço mínimo por pergunta</h2>
          <p className="text-sm text-gray-500 mb-4">Fãs precisam pagar pelo menos este valor para enviar uma pergunta.</p>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-[#DD2A7B]">R$ {minPrice}</span>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={minPrice}
              onChange={e => setMinPrice(Number(e.target.value))}
              className="flex-1 accent-[#DD2A7B]"
            />
          </div>
        </div>

        {/* Limite diário */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-bold text-lg mb-1">Limite diário de perguntas</h2>
          <p className="text-sm text-gray-500 mb-4">Máximo de perguntas que você aceita responder por dia.</p>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold">{dailyLimit} <span className="text-base text-gray-400 font-normal">perguntas/dia</span></span>
            <input
              type="range"
              min={1}
              max={50}
              step={1}
              value={dailyLimit}
              onChange={e => setDailyLimit(Number(e.target.value))}
              className="flex-1 accent-[#DD2A7B]"
            />
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Potencial mensal (líquido): <span className="font-bold text-green-600">R$ {netMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </p>
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-2xl text-center">
            <p className="text-green-600 font-semibold text-sm">✓ Configurações salvas com sucesso!</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-gradient-instagram text-white font-bold py-4 rounded-2xl disabled:opacity-50 text-base"
        >
          {isSaving ? 'Salvando...' : 'Salvar alterações'}
        </button>

        <div className="text-center">
          <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">Voltar ao dashboard</a>
        </div>
      </main>
    </div>
  )
}
