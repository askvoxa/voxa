import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { setupLimiter } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  // Autenticação obrigatória
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Rate limiting por usuário
  const { success: rateLimitOk } = setupLimiter.check(user.id)
  if (!rateLimitOk) {
    return NextResponse.json({ error: 'Muitas requisições. Tente novamente em breve.' }, { status: 429 })
  }

  // Verificar que é fan
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('account_type, approval_status')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
  }

  // Permitir: fans (novo cadastro) ou influencers rejeitados (reenvio)
  const isNewCreator = profile.account_type === 'fan'
  const isResubmit = profile.account_type === 'influencer' && profile.approval_status === 'rejected'

  if (!isNewCreator && !isResubmit) {
    return NextResponse.json({ error: 'Não é possível solicitar cadastro de criador' }, { status: 409 })
  }

  const body = await request.json()
  const { bio, min_price, daily_limit, social_link, accepted_terms_at, niche_ids } = body

  // Validações — permitir apenas domínios de redes sociais conhecidas (previne SSRF/phishing)
  const allowedSocialDomains = [
    'instagram.com', 'www.instagram.com',
    'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
    'tiktok.com', 'www.tiktok.com',
    'youtube.com', 'www.youtube.com', 'youtu.be',
    'twitch.tv', 'www.twitch.tv',
    'facebook.com', 'www.facebook.com',
    'linkedin.com', 'www.linkedin.com',
    'threads.net', 'www.threads.net',
    'kwai.com', 'www.kwai.com',
  ]
  let socialUrl: URL | null = null
  try { socialUrl = new URL(String(social_link).trim()) } catch { /* URL inválida */ }

  if (!socialUrl || socialUrl.protocol !== 'https:' || !allowedSocialDomains.includes(socialUrl.hostname)) {
    return NextResponse.json({ error: 'Link inválido. Use um perfil do Instagram, TikTok, YouTube, X ou outra rede social.' }, { status: 400 })
  }
  if (!accepted_terms_at) {
    return NextResponse.json({ error: 'Aceite dos termos é obrigatório' }, { status: 400 })
  }
  if (!Array.isArray(niche_ids) || niche_ids.length < 1 || niche_ids.length > 3) {
    return NextResponse.json({ error: 'Selecione entre 1 e 3 nichos' }, { status: 400 })
  }

  const sanitizedPrice = Math.min(100, Math.max(5, Number(min_price) || 10))
  const sanitizedLimit = Math.min(50, Math.max(1, Number(daily_limit) || 10))

  // Promover fan → influencer com approval_status = 'pending_review'
  let query = supabaseAdmin
    .from('profiles')
    .update({
      account_type: 'influencer',
      bio: String(bio || '').trim().slice(0, 200) || null,
      min_price: sanitizedPrice,
      daily_limit: sanitizedLimit,
      social_link: String(social_link).trim(),
      accepted_terms_at: new Date().toISOString(), // Timestamp do servidor para compliance legal
      approval_status: 'pending_review',
      rejection_reason: null,
      creator_setup_completed: false, // Só será true após aprovação do admin
    })
    .eq('id', user.id)

  // Para fans, filtrar por account_type; para reenvios, já é influencer
  if (isNewCreator) {
    query = query.eq('account_type', 'fan')
  }

  const { error: updateError } = await query

  if (updateError) {
    console.error('become-creator error:', updateError)
    return NextResponse.json({ error: 'Erro ao enviar cadastro' }, { status: 500 })
  }

  // Salvar nichos
  if (niche_ids.length > 0) {
    await supabaseAdmin.from('creator_niches').delete().eq('creator_id', user.id)
    await supabaseAdmin.from('creator_niches').insert(
      niche_ids.map((niche_id: string) => ({ creator_id: user.id, niche_id }))
    )
  }

  return NextResponse.json({ success: true })
}
