import { NextResponse } from 'next/server'
import MercadoPagoConfig, { Preference } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

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
    const body = await request.json()
    const { username, question, name, amount, serviceType, isAnonymous, isShareable } = body

    if (!username || !question || !amount) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
    }

    // Sanitizar e validar entradas
    const sanitizedQuestion = String(question).trim().slice(0, 1000)
    const sanitizedName = String(name || '').trim().slice(0, 100)
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
      .select('id, username, min_price, daily_limit, questions_answered_today')
      .eq('username', username)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Criador não encontrado' }, { status: 404 })
    }

    // Validar limite diário
    if (profile.questions_answered_today >= profile.daily_limit) {
      return NextResponse.json({ error: 'Limite diário atingido' }, { status: 422 })
    }

    // Validar valor mínimo
    const minPrice = sanitizedServiceType === 'premium' ? Math.max(50, profile.min_price) : profile.min_price
    if (sanitizedAmount < minPrice) {
      return NextResponse.json({ error: `Valor mínimo é R$ ${minPrice}` }, { status: 422 })
    }

    const total = Number((sanitizedAmount * 1.1).toFixed(2))
    const externalRef = randomUUID()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Salvar intenção de pagamento no Supabase (com todos os dados da pergunta)
    const { error: intentError } = await supabaseAdmin
      .from('payment_intents')
      .insert({
        id: externalRef,
        creator_id: profile.id,
        amount: total,
        question_data: {
          creator_id: profile.id,
          sender_name: isAnonymous ? 'Anônimo' : (sanitizedName || 'Anônimo'),
          content: sanitizedQuestion,
          price_paid: sanitizedAmount,
          service_type: sanitizedServiceType,
          is_anonymous: Boolean(isAnonymous),
          is_shareable: Boolean(isShareable),
        },
      })

    if (intentError) {
      console.error('Erro ao salvar payment_intent:', intentError)
      return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
    }

    // Criar preferência no Mercado Pago
    const preference = new Preference(mp)
    const result = await preference.create({
      body: {
        external_reference: externalRef,
        items: [
          {
            id: externalRef,
            title: `Pergunta para @${username} (${sanitizedServiceType === 'premium' ? 'Vídeo' : 'Base'})`,
            description: sanitizedQuestion.slice(0, 256),
            quantity: 1,
            unit_price: total,
            currency_id: 'BRL',
          },
        ],
        back_urls: {
          success: `${appUrl}/perfil/${username}?payment_status=approved&ref=${externalRef}`,
          failure: `${appUrl}/perfil/${username}?payment_status=failure`,
          pending: `${appUrl}/perfil/${username}?payment_status=pending&ref=${externalRef}`,
        },
        auto_return: 'approved',
        notification_url: `${appUrl}/api/payment/webhook`,
        expires: true,
        expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
      },
    })

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
