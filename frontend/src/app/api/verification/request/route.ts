import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // Verificar se o criador já tem solicitação pendente
  const { data: existing } = await supabaseAdmin
    .from('verification_requests')
    .select('id')
    .eq('creator_id', user.id)
    .eq('status', 'pending')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'Você já tem uma solicitação de verificação pendente' }, { status: 422 })
  }

  // Verificar se já é verificado
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('is_verified, account_type')
    .eq('id', user.id)
    .single()

  if (!profile || profile.account_type === 'fan') {
    return NextResponse.json({ error: 'Apenas criadores podem solicitar verificação' }, { status: 403 })
  }

  if (profile.is_verified) {
    return NextResponse.json({ error: 'Seu perfil já está verificado' }, { status: 422 })
  }

  const formData = await request.formData()
  const socialLink = formData.get('social_link') as string | null
  const documentFile = formData.get('document') as File | null

  // Validar que social_link é de um domínio de rede social conhecido (previne SSRF/phishing)
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
  let parsedSocialUrl: URL | null = null
  try { parsedSocialUrl = new URL(String(socialLink).trim()) } catch { /* URL inválida */ }

  if (!parsedSocialUrl || parsedSocialUrl.protocol !== 'https:' || !allowedSocialDomains.includes(parsedSocialUrl.hostname)) {
    return NextResponse.json({ error: 'Link inválido. Use um perfil do Instagram, TikTok, YouTube, X ou outra rede social.' }, { status: 400 })
  }

  if (!documentFile) {
    return NextResponse.json({ error: 'Documento de identidade é obrigatório' }, { status: 400 })
  }

  // Validar tipo de arquivo
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(documentFile.type)) {
    return NextResponse.json({ error: 'Formato inválido. Use JPG, PNG ou WebP.' }, { status: 400 })
  }

  if (documentFile.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5 MB.' }, { status: 400 })
  }

  // Cooldown de 7 dias após rejeição
  const { data: recentRejection } = await supabaseAdmin
    .from('verification_requests')
    .select('id, created_at')
    .eq('creator_id', user.id)
    .eq('status', 'rejected')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (recentRejection) {
    const daysSince = (Date.now() - new Date(recentRejection.created_at).getTime()) / 86_400_000
    if (daysSince < 7) {
      const daysLeft = Math.ceil(7 - daysSince)
      return NextResponse.json({ error: `Aguarde ${daysLeft} dia(s) após a rejeição para reenviar.` }, { status: 422 })
    }
  }

  // Upload do documento para bucket privado — extensão derivada do MIME type validado
  const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = extMap[documentFile.type] ?? 'jpg'
  const path = `${user.id}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await documentFile.arrayBuffer())

  const { error: uploadError } = await supabaseAdmin.storage
    .from('verification-docs')
    .upload(path, buffer, { contentType: documentFile.type })

  if (uploadError) {
    console.error('[verification/request] Upload error:', uploadError)
    return NextResponse.json({ error: 'Erro ao fazer upload do documento' }, { status: 500 })
  }

  // Criar solicitação
  const { error: insertError } = await supabaseAdmin
    .from('verification_requests')
    .insert({
      creator_id: user.id,
      social_link: parsedSocialUrl.href,
      document_url: path,
      status: 'pending',
    })

  if (insertError) {
    console.error('[verification/request] Insert error:', insertError)
    return NextResponse.json({ error: 'Erro ao criar solicitação' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
