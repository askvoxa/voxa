import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPayoutRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  // Autenticação
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Autenticação necessária' }, { status: 401 })
  }

  // Rate limit (Redis com fallback in-memory)
  const { success: rateLimitOk } = await checkPayoutRateLimit(user.id)
  if (!rateLimitOk) {
    return NextResponse.json(
      { error: 'Limite de solicitações atingido. Tente novamente em 1 hora.' },
      { status: 429 }
    )
  }

  // Chamar RPC atômica de saque
  const { data, error } = await supabaseAdmin
    .rpc('request_payout', { p_creator_id: user.id })

  if (error) {
    console.error('[payout/request] Erro na RPC:', error.message)

    // Mensagens amigáveis para erros conhecidos da RPC
    if (error.message.includes('bloqueados')) {
      return NextResponse.json({ error: 'Seus saques estão bloqueados. Entre em contato com o suporte.' }, { status: 403 })
    }
    if (error.message.includes('pausados')) {
      return NextResponse.json({ error: 'Saques estão temporariamente pausados.' }, { status: 403 })
    }
    if (error.message.includes('insuficiente')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error.message.includes('chave PIX')) {
      return NextResponse.json({ error: 'Cadastre uma chave PIX antes de solicitar saque.' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Erro ao processar solicitação de saque.' }, { status: 500 })
  }

  // data contém o UUID do payout criado
  const payoutId = data

  // Buscar detalhes do payout criado
  const { data: payout } = await supabaseAdmin
    .from('payout_requests')
    .select('id, amount, status, requested_at')
    .eq('id', payoutId)
    .single()

  console.log(`[payout/request] Criador ${user.id} solicitou saque de R$${payout?.amount}. Payout ID: ${payoutId}`)

  return NextResponse.json({
    success: true,
    payout,
  })
}
