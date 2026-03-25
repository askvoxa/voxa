import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { waitlistLimiter, getRequestIP } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    // Rate limiting por IP (endpoint público, sem auth)
    const ip = getRequestIP(request)
    const { success: rateLimitOk } = waitlistLimiter.check(ip)
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Muitas requisições. Tente novamente em breve.' }, { status: 429 })
    }

    const body = await request.json()
    const { name, email, instagram, followers_range, niche, whatsapp, referral_code } = body

    // Validação básica
    if (!name || !email || !instagram || !followers_range || !niche) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Checar duplicata por email
    const { data: existing } = await supabaseAdmin
      .from('waitlist')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Este email já está na waitlist' }, { status: 409 })
    }

    // Resolver referral
    let referred_by = null
    if (referral_code) {
      const { data: referrer } = await supabaseAdmin
        .from('waitlist')
        .select('id')
        .eq('referral_code', referral_code.toUpperCase().trim())
        .single()

      if (referrer) {
        referred_by = referrer.id
      }
    }

    // Gerar código de referral único para o novo inscrito
    const newReferralCode = `VOXA-${name.split(' ')[0].toUpperCase().slice(0, 4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

    // Sanitizar instagram (remover @ se presente)
    const cleanInstagram = instagram.replace(/^@/, '').trim()

    const { data, error } = await supabaseAdmin
      .from('waitlist')
      .insert({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        instagram: cleanInstagram,
        followers_range,
        niche,
        whatsapp: whatsapp?.trim() || null,
        referral_code: newReferralCode,
        referred_by,
      })
      .select('id, referral_code')
      .single()

    if (error) {
      console.error('Erro ao inserir na waitlist:', error)
      return NextResponse.json({ error: 'Erro ao cadastrar' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      referral_code: data.referral_code,
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
