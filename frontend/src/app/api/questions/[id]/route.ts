import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import MercadoPagoConfig, { PaymentRefund } from 'mercadopago'
import { sendResponseNotification } from '@/lib/email'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar que a pergunta pertence ao criador logado
    const { data: question, error: fetchError } = await supabase
      .from('questions')
      .select('id, creator_id, status, sender_name, sender_email')
      .eq('id', params.id)
      .single()

    if (fetchError || !question) {
      return NextResponse.json({ error: 'Pergunta não encontrada' }, { status: 404 })
    }

    if (question.creator_id !== user.id) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    if (question.status === 'answered' || question.status === 'rejected') {
      return NextResponse.json({ error: 'Pergunta já respondida' }, { status: 422 })
    }

    const body = await request.json()
    const { response_text, response_audio_url, action } = body

    if (action === 'reject') {
      const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      const { data: transaction } = await supabaseAdmin
        .from('transactions')
        .select('mp_payment_id, amount')
        .eq('question_id', params.id)
        .single()

      if (transaction?.mp_payment_id) {
        try {
          const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
          const refundClient = new PaymentRefund(mp)
          await refundClient.create({
            payment_id: String(transaction.mp_payment_id),
            body: { amount: transaction.amount },
          })
        } catch (err) {
          console.error('[reject] erro no reembolso MP:', err)
          return NextResponse.json({ error: 'Falha ao processar reembolso' }, { status: 500 })
        }
      }

      await supabaseAdmin
        .from('questions')
        .update({ status: 'rejected' })
        .eq('id', params.id)

      return NextResponse.json({ ok: true })
    }

    if (!response_text && !response_audio_url) {
      return NextResponse.json({ error: 'Informe a resposta' }, { status: 400 })
    }

    // Validar que a URL de áudio vem do bucket correto do Supabase (evita URLs maliciosas)
    if (response_audio_url) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const allowedPrefix = `${supabaseUrl}/storage/v1/object/public/responses/`
      if (!String(response_audio_url).startsWith(allowedPrefix)) {
        return NextResponse.json({ error: 'URL de áudio inválida' }, { status: 400 })
      }
    }

    // Atualizar a pergunta
    const { error: updateError } = await supabase
      .from('questions')
      .update({
        status: 'answered',
        response_text: response_text ?? null,
        response_audio_url: response_audio_url ?? null,
        answered_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (updateError) {
      return NextResponse.json({ error: 'Erro ao salvar resposta' }, { status: 500 })
    }

    // Admin client reutilizado para RPC e email
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Incrementar questions_answered_today no perfil (admin client garante permissão)
    const { error: rpcError } = await supabaseAdmin.rpc('increment_answered_today', { profile_id: user.id })
    if (rpcError) {
      // Contador fora de sincronia afeta enforcement do daily_limit — logar com destaque
      console.error('[CRITICAL] Falha ao incrementar contador diário para user:', user.id, rpcError)
    }

    // Notificar fã por email (fire-and-forget)
    if (question.sender_email) {
      const { data: creatorProfile } = await supabaseAdmin
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      if (creatorProfile) {
        sendResponseNotification({
          fanEmail: question.sender_email,
          fanName: question.sender_name ?? 'Fã',
          creatorUsername: creatorProfile.username,
        }).catch(err => console.error('[email] Erro ao notificar fã:', err))
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('PATCH /api/questions/[id] error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
