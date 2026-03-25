import { NextResponse } from 'next/server'
import MercadoPagoConfig, { Preference } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { paymentLimiter } from '@/lib/rate-limit'

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

// Client com service role para escrever em payment_intents (bypass RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_SERVICE_TYPES = ['base', 'premium'] as const

export async function POST(request: Request) {
  try {
    // Autenticação obrigatória
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Autenticação necessária' }, { status: 401 })
    }

    // Rate limiting por usuário autenticado
    const { success: rateLimitOk } = paymentLimiter.check(user.id)
    if (!rateLimitOk) {
      return NextResponse.json({ error: 'Muitas requisições. Tente novamente em breve.' }, { status: 429 })
    }

    // Buscar perfil do sender (fã)
    const { data: senderProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .eq('id', user.id)
      .single()

    if (!senderProfile) {
      return NextResponse.json({ error: 'Perfil não encontrado. Complete seu cadastro.' }, { status: 403 })
    }

    const senderEmail = user.email ?? ''
    const senderName = senderProfile.username

    const body = await request.json()
    const { username, question, amount, serviceType, isAnonymous, isShareable, is_support_only } = body

    if (!username || !question || !amount) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // Sanitizar e validar entradas
    const sanitizedQuestion = String(question).trim().slice(0, 1000)
    const sanitizedServiceType: 'base' | 'premium' = VALID_SERVICE_TYPES.includes(serviceType) ? serviceType : 'base'
    const sanitizedAmount = Number(amount)

    if (!sanitizedQuestion) {
      return NextResponse.json({ error: 'Pergunta inválida' }, { status: 400 })
    }
    if (isNaN(sanitizedAmount) || sanitizedAmount <= 0 || sanitizedAmount > 10000) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    // Buscar o perfil do criador pelo username
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, min_price, daily_limit, is_paused, paused_until, approval_status')
      .eq('username', username)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Criador não encontrado' }, { status: 404 })
    }

    // Impedir auto-envio (criador enviando pergunta para si mesmo)
    if (profile.id === user.id) {
      return NextResponse.json({ error: 'Não é possível enviar uma pergunta para si mesmo' }, { status: 422 })
    }

    // Verificar se o criador está aprovado (NULL = legado, tratado como aprovado)
    if (profile.approval_status && profile.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Este criador ainda não foi aprovado na plataforma' }, { status: 422 })
    }

    // Verificar se o criador pausou o recebimento de perguntas
    if (profile.is_paused && (!profile.paused_until || new Date(profile.paused_until) > new Date())) {
      return NextResponse.json({ error: 'Este criador pausou o recebimento de perguntas temporariamente' }, { status: 422 })
    }

    // Validar limite diário via função SQL atômica (evita race condition)
    const { data: canAccept, error: limitError } = await supabaseAdmin
      .rpc('can_accept_question', { p_creator_id: profile.id })

    if (limitError || !canAccept) {
      return NextResponse.json({ error: 'Limite diário atingido' }, { status: 422 })
    }

    // Validar valor mínimo
    const minPrice = sanitizedServiceType === 'premium' ? Math.max(50, profile.min_price) : profile.min_price
    if (sanitizedAmount < minPrice) {
      return NextResponse.json({ error: `Valor mínimo é R$ ${minPrice}` }, { status: 422 })
    }

    const externalRef = randomUUID()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const displayName = isAnonymous ? 'Anônimo' : senderName

    // Salvar intenção de pagamento no Supabase (com todos os dados da pergunta)
    const { error: intentError } = await supabaseAdmin
      .from('payment_intents')
      .insert({
        id: externalRef,
        creator_id: profile.id,
        amount: sanitizedAmount,
        question_data: {
          creator_id: profile.id,
          sender_id: user.id,
          sender_name: displayName,
          sender_email: senderEmail || null,
          content: sanitizedQuestion,
          price_paid: sanitizedAmount,
          service_type: sanitizedServiceType,
          is_anonymous: Boolean(isAnonymous),
          is_shareable: Boolean(isShareable),
          is_support_only: Boolean(is_support_only),
        },
      })

    if (intentError) {
      console.error('Erro ao salvar payment_intent:', intentError)
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }

    // Criar preferência no Mercado Pago
    const preference = new Preference(mp)
    let result
    try {
      result = await preference.create({
        body: {
          external_reference: externalRef,
          items: [
            {
              id: externalRef,
              title: `Pergunta para @${username} (${sanitizedServiceType === 'premium' ? 'Vídeo' : 'Base'})`,
              description: sanitizedQuestion.slice(0, 256),
              category_id: 'services',
              quantity: 1,
              unit_price: sanitizedAmount,
              currency_id: 'BRL',
            },
          ],
          payer: {
            name: displayName,
            surname: '',
            ...(senderEmail && { email: senderEmail }),
          },
          payment_methods: {
            default_payment_method_id: 'pix',
            installments: 12,
            default_installments: 1,
          },
          statement_descriptor: 'VOXA',
          back_urls: {
            success: `${appUrl}/perfil/${username}?payment_status=approved&ref=${externalRef}`,
            failure: `${appUrl}/perfil/${username}?payment_status=failure&ref=${externalRef}`,
            pending: `${appUrl}/perfil/${username}?payment_status=pending&ref=${externalRef}`,
          },
          auto_return: 'approved',
          notification_url: `${appUrl}/api/payment/webhook`,
          expires: true,
          expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
        },
      })
    } catch (mpError: any) {
      // Limpar payment_intent órfão se a criação da preference no MP falhou
      await supabaseAdmin.from('payment_intents').delete().eq('id', externalRef)
      console.error('create-preference MP error:', mpError)
      return NextResponse.json({ error: 'Erro ao criar preferência de pagamento' }, { status: 500 })
    }

    // Atualizar o payment_intent com o preference_id do MP
    await supabaseAdmin
      .from('payment_intents')
      .update({ mp_preference_id: result.id })
      .eq('id', externalRef)

    return NextResponse.json({
      init_point: result.init_point,
      preference_id: result.id,
    })
  } catch (error: any) {
    console.error('create-preference error:', error)
    return NextResponse.json({ error: 'Erro ao criar preferência de pagamento' }, { status: 500 })
  }
}
