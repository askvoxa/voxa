'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CREATOR_NET_RATE } from '@/lib/constants'

export default function SettingsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [bio, setBio] = useState('')
  const [minPrice, setMinPrice] = useState(10)
  const [dailyLimit, setDailyLimit] = useState(10)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

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

      setUserId(user.id)
      setUsername(profile.username)
      setBio(profile.bio ?? '')
      setMinPrice(profile.min_price ?? 10)
      setDailyLimit(profile.daily_limit ?? 10)
      setAvatarUrl(profile.avatar_url ?? '')
      setIsLoading(false)
    }
    load()
  }, [router])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploading(true)
    setError('')

    const supabase = createClient()
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    }
    const ext = extMap[file.type] ?? 'jpg'
    const path = `${userId}/${Date.now()}.${ext}`

    const { data, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError || !data) {
      setError('Erro ao fazer upload. Tente novamente.')
      setIsUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path)
    setAvatarUrl(publicUrl)
    setIsUploading(false)
    setSuccessMessage('Avatar atualizado com sucesso!')
    setTimeout(() => setSuccessMessage(''), 3000)

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    setSuccessMessage('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        bio: bio.trim().slice(0, 200) || null,
        min_price: minPrice,
        daily_limit: dailyLimit,
        avatar_url: avatarUrl || null,
      })
      .eq('id', user.id)

    setIsSaving(false)
    if (updateError) {
      setError('Erro ao salvar. Tente novamente.')
    } else {
      setSuccessMessage('Configurações salvas com sucesso!')
      setTimeout(() => setSuccessMessage(''), 3000)
    }
  }

  const previewAvatar = avatarUrl.trim() || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
  const netMonthly = minPrice * dailyLimit * 30 * CREATOR_NET_RATE

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 bg-gray-200 rounded animate-pulse" />
              <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-9 w-32 bg-gray-200 rounded-xl animate-pulse" />
                <div className="h-3 w-44 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-64 bg-gray-100 rounded animate-pulse mb-4" />
              <div className="h-10 w-full bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ))}
          <div className="h-14 w-full bg-gray-200 rounded-2xl animate-pulse" />
        </main>
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
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <img
                src={previewAvatar}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-100"
                onError={(e) => {
                  const el = e.target as HTMLImageElement
                  el.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`
                }}
              />
              {isUploading && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileUpload}
                className="hidden"
                id="avatar-upload"
              />
              <label
                htmlFor="avatar-upload"
                className={`inline-flex items-center gap-2 cursor-pointer bg-gradient-instagram text-white text-sm font-semibold px-4 py-2 rounded-xl transition-opacity ${isUploading || isLoading ? 'opacity-50 pointer-events-none' : 'hover:opacity-90'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {isUploading ? 'Enviando...' : 'Fazer upload'}
              </label>
              <p className="text-xs text-gray-400">JPG, PNG, WebP ou GIF — máx. 5 MB</p>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Remover foto (usar avatar gerado)
                </button>
              )}
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

        {successMessage && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-2xl text-center">
            <p className="text-green-600 font-semibold text-sm">✓ {successMessage}</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={isSaving || isUploading}
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
