'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CREATOR_NET_RATE } from '@/lib/constants'
import AvatarCropModal from './AvatarCropModal'

type FastAskSuggestion = {
  label: string
  question: string
  amount: number
}

const DEFAULT_SUGGESTIONS: FastAskSuggestion[] = [
  { label: '⚡ Dica rápida', question: 'Qual é a sua dica mais valiosa que você daria para alguém começando agora?', amount: 20 },
  { label: '🎨 Análise de perfil', question: 'Você pode analisar meu perfil e me dar um feedback honesto sobre o meu estilo?', amount: 35 },
  { label: '🌟 Recomendação', question: 'Qual é a sua recomendação exclusiva para quem quer se destacar nessa área?', amount: 15 },
]

export default function SettingsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showSuccess = useCallback((msg: string, duration = 3000) => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current)
    setSuccessMessage(msg)
    msgTimerRef.current = setTimeout(() => setSuccessMessage(''), duration)
  }, [])

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
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)

  // Fast Ask
  const [suggestions, setSuggestions] = useState<FastAskSuggestion[]>(DEFAULT_SUGGESTIONS)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, bio, avatar_url, min_price, daily_limit, fast_ask_suggestions')
        .eq('id', user.id)
        .single()

      if (!profile) { router.push('/setup'); return }

      setUserId(user.id)
      setUsername(profile.username)
      setBio(profile.bio ?? '')
      setMinPrice(profile.min_price ?? 10)
      setDailyLimit(profile.daily_limit ?? 10)
      setAvatarUrl(profile.avatar_url ?? '')

      // BUG FIX: fast_ask_suggestions pode vir null do Supabase antes da migration
      // Array.isArray garante que não quebra se a coluna ainda não existir
      const saved = profile.fast_ask_suggestions
      if (Array.isArray(saved) && saved.length > 0) {
        setSuggestions(saved)
      }

      setIsLoading(false)
    }
    load()
  }, [router])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setError('')
    setCropImageSrc(URL.createObjectURL(file))
  }

  const handleCropConfirm = async (blob: Blob) => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc)
    setCropImageSrc(null)
    setIsUploading(true)
    setError('')

    const supabase = createClient()
    const path = `${userId}/${Date.now()}.jpg`

    const { data, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })

    if (uploadError || !data) {
      setError('Erro ao fazer upload. Tente novamente.')
      setIsUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path)
    setAvatarUrl(publicUrl)
    setIsUploading(false)
    showSuccess('Avatar atualizado com sucesso!')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCropCancel = () => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc)
    setCropImageSrc(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Fast Ask handlers
  const updateSuggestion = (index: number, field: keyof FastAskSuggestion, value: string | number) => {
    setSuggestions(prev => prev.map((s, i) => {
      if (i !== index) return s
      if (field === 'amount') {
        // BUG FIX: garante que amount é sempre número válido, nunca NaN
        const parsed = parseFloat(String(value))
        return { ...s, amount: isNaN(parsed) ? s.amount : Math.max(1, parsed) }
      }
      return { ...s, [field]: value }
    }))
  }

  const addSuggestion = () => {
    if (suggestions.length >= 5) return
    setSuggestions(prev => [...prev, { label: '✨ Nova sugestão', question: '', amount: minPrice }])
  }

  const removeSuggestion = (index: number) => {
    setSuggestions(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError('')
    setSuccessMessage('')

    // BUG FIX: filtra sugestões inválidas antes de salvar — evita dados corrompidos no banco
    const validSuggestions = suggestions.filter(
      s => s.label?.trim() && s.question?.trim() && Number(s.amount) > 0
    )

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
        fast_ask_suggestions: validSuggestions,
      })
      .eq('id', user.id)

    setIsSaving(false)
    if (updateError) {
      // BUG FIX: se a coluna fast_ask_suggestions ainda não existe (migration pendente),
      // tenta salvar sem ela para não bloquear o usuário
      if (updateError.message?.includes('fast_ask_suggestions')) {
        const { error: fallbackError } = await supabase
          .from('profiles')
          .update({
            bio: bio.trim().slice(0, 200) || null,
            min_price: minPrice,
            daily_limit: dailyLimit,
            avatar_url: avatarUrl || null,
          })
          .eq('id', user.id)

        if (fallbackError) {
          setError('Erro ao salvar. Tente novamente.')
        } else {
          showSuccess('Configurações salvas! (Perguntas rápidas disponíveis após atualização do banco)', 5000)
        }
      } else {
        setError('Erro ao salvar. Tente novamente.')
      }
    } else {
      showSuccess('Configurações salvas com sucesso!')
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
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-10 w-full bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ))}
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
                className={`inline-flex items-center gap-2 cursor-pointer bg-gradient-instagram text-white text-sm font-semibold px-4 py-3 rounded-xl transition-opacity ${isUploading || isLoading ? 'opacity-50 pointer-events-none' : 'hover:opacity-90'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {isUploading ? 'Enviando...' : 'Fazer upload'}
              </label>
              <p className="text-xs text-gray-500">JPG, PNG, WebP ou GIF — máx. 5 MB</p>
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
          <p className="text-right text-xs text-gray-500 mt-1">{bio.length}/200</p>
        </div>

        {/* Preço mínimo */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-bold text-lg mb-1">Preço mínimo por pergunta</h2>
          <p className="text-sm text-gray-500 mb-4">Fãs precisam pagar pelo menos este valor para enviar uma pergunta.</p>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold text-[#DD2A7B]">R$ {minPrice}</span>
            <input
              id="settings-min-price"
              type="range"
              min={5}
              max={100}
              step={5}
              value={minPrice}
              onChange={e => setMinPrice(Number(e.target.value))}
              className="flex-1 accent-[#DD2A7B]"
              aria-label={`Preço mínimo: R$ ${minPrice}`}
            />
          </div>
        </div>

        {/* Limite diário */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-bold text-lg mb-1">Limite diário de perguntas</h2>
          <p className="text-sm text-gray-500 mb-4">Máximo de perguntas que você aceita responder por dia.</p>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold">{dailyLimit} <span className="text-base text-gray-500 font-normal">perguntas/dia</span></span>
            <input
              id="settings-daily-limit"
              type="range"
              min={1}
              max={50}
              step={1}
              value={dailyLimit}
              onChange={e => setDailyLimit(Number(e.target.value))}
              className="flex-1 accent-[#DD2A7B]"
              aria-label={`Limite diário: ${dailyLimit} perguntas`}
            />
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Potencial mensal (líquido): <span className="font-bold text-green-600">R$ {netMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </p>
        </div>

        {/* ── FAST ASK ── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between mb-1">
            <h2 className="font-bold text-lg">Perguntas Rápidas</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full font-medium">
              {suggestions.length}/5
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Aparecem como pílulas clicáveis no seu perfil — facilitam a vida do fã e aumentam conversão.
          </p>

          <div className="space-y-4">
            {suggestions.map((s, index) => (
              <div key={index} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Sugestão {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSuggestion(index)}
                    className="text-gray-300 hover:text-red-400 transition-colors cursor-pointer p-2 -m-2"
                    aria-label={`Remover sugestão ${index + 1}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Texto da pílula <span className="text-gray-400">(aparece no botão)</span>
                  </label>
                  <input
                    type="text"
                    value={s.label}
                    onChange={e => updateSuggestion(index, 'label', e.target.value.slice(0, 30))}
                    maxLength={30}
                    placeholder="ex: ⚡ Dica rápida"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Pergunta completa <span className="text-gray-400">(preenche a textarea do fã)</span>
                  </label>
                  <textarea
                    value={s.question}
                    onChange={e => updateSuggestion(index, 'question', e.target.value.slice(0, 200))}
                    maxLength={200}
                    rows={2}
                    placeholder="ex: Qual é a sua dica mais valiosa para quem está começando?"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DD2A7B] resize-none"
                  />
                  <p className="text-right text-xs text-gray-400 mt-0.5">{s.question.length}/200</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Valor sugerido <span className="text-gray-400">(mínimo: R$ {minPrice})</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400">R$</span>
                    <input
                      type="number"
                      value={s.amount}
                      min={minPrice}
                      max={500}
                      onChange={e => updateSuggestion(index, 'amount', e.target.value)}
                      className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]"
                    />
                    {/* Preview da pílula */}
                    <div className="flex-1 flex justify-end">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-500 bg-white">
                        {s.label || '...'}
                        <span className="text-gray-400">· R$ {Math.max(Number(s.amount) || minPrice, minPrice)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {suggestions.length < 5 && (
            <button
              type="button"
              onClick={addSuggestion}
              className="mt-4 w-full border-2 border-dashed border-gray-200 rounded-2xl py-3 text-sm text-gray-400 font-medium hover:border-[#DD2A7B] hover:text-[#DD2A7B] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar sugestão
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-500 text-center">{error}</p>}

        {successMessage && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-2xl text-center">
            <p className="text-green-600 font-semibold text-sm">✓ {successMessage}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || isUploading}
          className="w-full bg-gradient-instagram text-white font-bold py-4 rounded-2xl disabled:opacity-50 text-base"
        >
          {isSaving ? 'Salvando...' : 'Salvar alterações'}
        </button>

        <div className="text-center space-y-3">
          <a href="/dashboard" className="block text-sm text-gray-400 hover:text-gray-600">Voltar ao dashboard</a>
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.push('/')
            }}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
          >
            Sair da conta
          </button>
        </div>
      </main>

      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  )
}
