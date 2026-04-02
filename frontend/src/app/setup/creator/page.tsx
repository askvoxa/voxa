'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CREATOR_NET_RATE, MP_PROCESSING_FEE_ESTIMATE } from '@/lib/constants'
import { trackCreatorSetupComplete } from '@/lib/analytics'

type Niche = { id: string; slug: string; label: string }

function getPriceBenchmark(price: number): string {
  if (price < 15) return 'Abaixo da média — pode deixar dinheiro na mesa'
  if (price <= 25) return 'Faixa popular — boa conversão para criadores iniciantes'
  if (price <= 50) return 'Faixa recomendada — equilíbrio entre volume e valor'
  if (price <= 100) return 'Faixa premium — ideal para especialistas com audiência engajada'
  return 'Exclusivo — para criadores com forte reputação no nicho'
}

const STEPS = ['Perfil', 'Rede Social', 'Termos']

export default function CreatorSetupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [isFromInvite, setIsFromInvite] = useState(false)

  // Step 1
  const [bio, setBio] = useState('')
  const [minPrice, setMinPrice] = useState(10)
  const [dailyLimit, setDailyLimit] = useState(10)
  const [niches, setNiches] = useState<Niche[]>([])
  const [selectedNiches, setSelectedNiches] = useState<string[]>([])

  // Step 2
  const [socialLink, setSocialLink] = useState('')

  // Step 3
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  // UI
  const [isLoading, setIsLoading] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, account_type, creator_setup_completed, approval_status')
        .eq('id', user.id)
        .single()

      if (!profile) { router.push('/setup'); return }

      // Fan que quer virar criador (sem convite) — ok, continua
      // Influencer com setup pendente (via convite) — ok, continua
      // Influencer rejeitado que quer reenviar — ok, continua
      // Influencer aprovado com setup completo — vai pro dashboard
      if (profile.account_type === 'influencer' && profile.creator_setup_completed &&
          profile.approval_status !== 'rejected') {
        router.push('/dashboard')
        return
      }

      // Se já é influencer via convite (não rejeitado), atualiza perfil direto sem aprovação
      // Influenciadores rejeitados precisam passar pelo fluxo de aprovação novamente via API
      if (profile.account_type === 'influencer' && profile.approval_status !== 'rejected') {
        setIsFromInvite(true)
      }

      // Fan sem convite pode acessar direto se veio do botão "Quero ser criador"
      setUsername(profile.username)

      // Carregar nichos
      const { data: nichesData } = await supabase
        .from('niches')
        .select('id, slug, label')
        .order('label')

      if (nichesData) setNiches(nichesData)
      setIsPageLoading(false)
    }
    load()
  }, [router])

  const toggleNiche = (nicheId: string) => {
    setSelectedNiches(prev => {
      if (prev.includes(nicheId)) return prev.filter(id => id !== nicheId)
      if (prev.length >= 3) return prev
      return [...prev, nicheId]
    })
  }

  // Valida se o link é um URL válido de rede social
  // Aceita: https://instagram.com/user, instagram.com/user, ou @user para Instagram
  const isValidSocialLink = (link: string): boolean => {
    const trimmed = link.trim()
    if (!trimmed) return false

    // Padrões aceitos: domínios conhecidos com ou sem https://
    const socialDomains = ['instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'twitch.tv', 'facebook.com', 'linkedin.com', 'threads.net', 'kwai.com']

    // Se já começa com https://, validar normalmente
    if (trimmed.startsWith('https://')) {
      try {
        const url = new URL(trimmed)
        return socialDomains.some(domain => url.hostname === domain || url.hostname === `www.${domain}`)
      } catch {
        return false
      }
    }

    // Se começa com um domínio conhecido (com ou sem www), é válido
    if (socialDomains.some(domain => trimmed.startsWith(domain) || trimmed.startsWith(`www.${domain}`))) {
      return true
    }

    // Se começa com @, assume Instagram
    if (trimmed.startsWith('@')) {
      return true
    }

    return false
  }

  // Normaliza o link para o formato https://domínio/...
  const normalizeSocialLink = (link: string): string => {
    const trimmed = link.trim()

    // Se já tem https://, retorna como está
    if (trimmed.startsWith('https://')) {
      return trimmed
    }

    // Se é apenas username do Instagram (@usuario ou usuario), normaliza para instagram.com
    if (trimmed.startsWith('@') || !trimmed.includes('.')) {
      const username = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
      return `https://instagram.com/${username}`
    }

    // Se tem domínio mas sem protocolo, adiciona https://
    if (trimmed.includes('.')) {
      return `https://${trimmed}`
    }

    return trimmed
  }

  const canAdvanceStep1 = selectedNiches.length >= 1
  const canAdvanceStep2 = isValidSocialLink(socialLink)
  const canSubmit = acceptedTerms

  const handleNext = () => {
    setError('')
    if (step === 1 && !canAdvanceStep1) {
      setError('Selecione pelo menos 1 nicho.')
      return
    }
    if (step === 2 && !canAdvanceStep2) {
      setError('Insira um link válido (Instagram, TikTok, YouTube, Twitter/X, etc.)')
      return
    }
    setStep(prev => prev + 1)
  }

  const handleBack = () => {
    setError('')
    setStep(prev => prev - 1)
  }

  const handleSubmit = async () => {
    if (!userId || !canSubmit) return
    setIsLoading(true)
    setError('')

    const supabase = createClient()
    const normalizedLink = normalizeSocialLink(socialLink)

    // Se é fan (sem convite), precisa promover via API
    if (!isFromInvite) {
      const res = await fetch('/api/setup/become-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: bio.trim() || null,
          min_price: minPrice,
          daily_limit: dailyLimit,
          social_link: normalizedLink,
          accepted_terms_at: new Date().toISOString(),
          niche_ids: selectedNiches,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erro ao enviar cadastro. Tente novamente.')
        setIsLoading(false)
        return
      }
    } else {
      // Já é influencer (via convite) — só atualiza perfil normalmente
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          bio: bio.trim() || null,
          min_price: minPrice,
          daily_limit: dailyLimit,
          social_link: normalizedLink,
          accepted_terms_at: new Date().toISOString(),
          creator_setup_completed: true,
        })
        .eq('id', userId)

      if (updateError) {
        setError('Erro ao configurar perfil. Tente novamente.')
        setIsLoading(false)
        return
      }

      // Salvar nichos
      if (selectedNiches.length > 0) {
        await supabase.from('creator_niches').delete().eq('creator_id', userId)
        await supabase.from('creator_niches').insert(
          selectedNiches.map(niche_id => ({ creator_id: userId, niche_id }))
        )
      }
    }

    trackCreatorSetupComplete(username, minPrice)
    router.push('/dashboard')
  }

  const netMonthly = minPrice * dailyLimit * 30 * (1 - MP_PROCESSING_FEE_ESTIMATE) * CREATOR_NET_RATE

  if (isPageLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4 text-white">
        <div className="w-full max-w-md bg-[#111] rounded-[32px] border border-white/10 p-8 shadow-2xl text-center">
          <h1 className="text-2xl font-bold mb-1">Configure seu perfil</h1>
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] p-4 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-[#DD2A7B] opacity-10 blur-[70px] md:blur-[120px] rounded-full pointer-events-none -mt-16 sm:-mt-32 -mr-16 sm:-mr-32"></div>
      <div className="absolute -bottom-16 sm:-bottom-32 -left-16 sm:-left-32 w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-purple-600 opacity-10 blur-[70px] md:blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#111] rounded-[32px] border border-white/10 p-8 shadow-2xl relative z-10">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1.5 rounded-full transition-colors ${i + 1 <= step ? 'bg-gradient-instagram' : 'bg-white/10'}`} />
              <p className={`text-[10px] mt-1.5 text-center font-medium ${i + 1 === step ? 'text-white' : 'text-gray-600'}`}>{label}</p>
            </div>
          ))}
        </div>

        {/* Step 1: Perfil */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold mb-1">Configure seu perfil</h1>
              <p className="text-gray-500 text-sm">
                Seus fãs enviarão perguntas para <span className="text-white font-medium">voxa.com/perfil/<span className="text-transparent bg-clip-text bg-gradient-instagram">{username}</span></span>
              </p>
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
              <p className="text-right text-xs text-gray-500 mt-1">{bio.length}/200</p>
            </div>

            {/* Nicho */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Seu nicho <span className="text-gray-500">(1 a 3)</span> <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {niches.map(niche => {
                  const selected = selectedNiches.includes(niche.id)
                  return (
                    <button
                      key={niche.id}
                      type="button"
                      onClick={() => toggleNiche(niche.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        selected
                          ? 'bg-gradient-instagram text-white'
                          : selectedNiches.length >= 3
                            ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {niche.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Preço */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Preço mínimo por pergunta: <span className="text-white font-bold">R$ {minPrice}</span>
              </label>
              <input
                type="range" min={5} max={100} step={5} value={minPrice}
                onChange={e => setMinPrice(Number(e.target.value))}
                className="w-full accent-pink-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>R$ 5</span><span>R$ 100</span>
              </div>
              <p className="text-xs text-gray-500 mt-1.5 italic">{getPriceBenchmark(minPrice)}</p>
            </div>

            {/* Limite */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Limite de perguntas por dia: <span className="text-white font-bold">{dailyLimit}</span>
              </label>
              <input
                type="range" min={1} max={50} step={1} value={dailyLimit}
                onChange={e => setDailyLimit(Number(e.target.value))}
                className="w-full accent-pink-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span><span>50</span>
              </div>
            </div>

            {/* Estimativa */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <p className="text-xs text-gray-500 mb-1">Estimativa mensal com essa configuração:</p>
              <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-instagram">
                R$ {netMonthly.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">estimativa após taxa Voxa (10%) + processamento MP (~1,2%)</p>
            </div>
          </div>
        )}

        {/* Step 2: Rede Social */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold mb-1">Sua rede social</h1>
              <p className="text-gray-500 text-sm">Usamos para confirmar que você é quem diz ser. O admin verificará seu perfil antes de aprovar.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Link do seu perfil principal <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="instagram.com/seu_perfil ou @seu_perfil"
                value={socialLink}
                onChange={e => setSocialLink(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-white/20 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
              />
              <p className="text-xs text-gray-500 mt-1.5">Com ou sem https:// — instagram.com/usuario, @usuario, tiktok.com/usuario, etc.</p>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <p className="text-sm font-medium text-gray-300">Por que pedimos isso?</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>- Verificamos que sua conta corresponde ao perfil criado</li>
                <li>- Garante mais confiança dos fãs que vão te pagar</li>
                <li>- Seu link não será exibido publicamente</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 3: Termos */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold mb-1">Termos de uso</h1>
              <p className="text-gray-500 text-sm">Leia e aceite os termos para finalizar seu cadastro.</p>
            </div>

            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 max-h-60 overflow-y-auto text-xs text-gray-400 space-y-3">
              <p className="font-semibold text-gray-300">Resumo dos pontos principais:</p>
              <ul className="space-y-2">
                <li><strong className="text-gray-300">Prazo de resposta:</strong> Você tem até 36 horas para responder cada pergunta. Após esse prazo, o pagamento é automaticamente estornado ao fã.</li>
                <li><strong className="text-gray-300">Taxas:</strong> A VOXA cobra uma taxa de plataforma sobre cada transação. O Mercado Pago cobra taxa adicional de processamento. O valor líquido é exibido no seu dashboard.</li>
                <li><strong className="text-gray-300">Conteúdo:</strong> Você é responsável pelas respostas que envia. Conteúdo ilegal, discurso de ódio ou assédio resultam em suspensão imediata da conta.</li>
                <li><strong className="text-gray-300">Pagamentos:</strong> Os valores recebidos ficam disponíveis para saque conforme política de liberação da plataforma. Dados bancários serão solicitados no momento do primeiro saque.</li>
                <li><strong className="text-gray-300">Conta:</strong> Você pode pausar ou desativar seu perfil a qualquer momento. Perguntas pendentes no momento da desativação serão estornadas.</li>
                <li><strong className="text-gray-300">Privacidade:</strong> Seus dados pessoais são tratados conforme a LGPD. O link de rede social informado é usado apenas para verificação interna e não é exibido publicamente.</li>
              </ul>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={e => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-pink-500 rounded shrink-0"
              />
              <span className="text-sm text-gray-300">
                Li e aceito os <span className="text-white font-medium">Termos de Uso</span> e a <span className="text-white font-medium">Política de Privacidade</span> da VOXA.
              </span>
            </label>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 border border-white/20 rounded-xl py-3 px-4 text-white font-medium hover:bg-white/5 transition-colors"
            >
              Voltar
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 bg-gradient-instagram rounded-xl py-3 px-4 text-white font-bold disabled:opacity-40 transition-all"
            >
              Próximo
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || !canSubmit}
              className="flex-1 bg-gradient-instagram rounded-xl py-3 px-4 text-white font-bold disabled:opacity-40 transition-all"
            >
              {isLoading ? 'Enviando...' : isFromInvite ? 'Ativar meu perfil' : 'Enviar para análise'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
