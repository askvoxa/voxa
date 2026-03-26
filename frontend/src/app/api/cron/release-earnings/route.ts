import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/cron/release-earnings
 * Cron diário: libera valores de perguntas respondidas após o período de carência.
 * Insere lançamentos 'credit' no creator_ledger para transações elegíveis.
 * Protegido por Bearer token (PAYOUT_SECRET).
 */
export async function POST(req: NextRequest) {
  // Autenticação via Bearer token
  const authHeader = req.headers.get('authorization')
  const secret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const payoutSecret = process.env.PAYOUT_SECRET

  if (!payoutSecret || !secret || secret.length !== payoutSecret.length
      || !timingSafeEqual(Buffer.from(secret), Buffer.from(payoutSecret))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Buscar dias de carência configurados
  const { data: settings } = await supabaseAdmin
    .from('platform_settings')
    .select('payout_release_days')
    .eq('id', 1)
    .single()

  const releaseDays = settings?.payout_release_days ?? 7

  // Buscar transações elegíveis para liberação:
  // - Transaction approved + question answered
  // - answered_at mais antigo que o período de carência
  // - Sem lançamento de credit correspondente no ledger
  const { data: eligible, error: queryError } = await supabaseAdmin
    .rpc('get_eligible_earnings_for_release', { p_release_days: releaseDays })

  // Fallback: se a RPC não existir, usar query direta
  let transactions: Array<{ transaction_id: string; creator_id: string; creator_net: number; question_id: string }> = []

  if (queryError) {
    // Query direta como fallback
    const { data: rawData, error: rawError } = await supabaseAdmin
      .from('transactions')
      .select(`
        id,
        creator_net,
        question_id,
        questions!inner (
          creator_id,
          status,
          answered_at
        )
      `)
      .eq('status', 'approved')
      .eq('questions.status', 'answered')
      .not('creator_net', 'is', null)

    if (rawError) {
      console.error('[cron/release-earnings] Erro na query:', rawError.message)
      return NextResponse.json({ error: 'Erro ao buscar transações.' }, { status: 500 })
    }

    // Filtrar manualmente pelo período de carência e ausência no ledger
    const cutoffDate = new Date(Date.now() - releaseDays * 24 * 60 * 60 * 1000)

    for (const t of rawData ?? []) {
      const question = t.questions as unknown as { creator_id: string; answered_at: string }
      if (!question?.answered_at || new Date(question.answered_at) > cutoffDate) continue

      // Verificar se já existe entry no ledger
      const { count } = await supabaseAdmin
        .from('creator_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('reference_type', 'transaction')
        .eq('reference_id', t.id)
        .eq('type', 'credit')

      if ((count ?? 0) === 0) {
        transactions.push({
          transaction_id: t.id,
          creator_id: question.creator_id,
          creator_net: Number(t.creator_net),
          question_id: t.question_id,
        })
      }
    }
  } else {
    transactions = eligible ?? []
  }

  // Inserir credits no ledger para cada transação elegível
  let releasedCount = 0
  let totalAmount = 0

  for (const t of transactions) {
    const { error: insertError } = await supabaseAdmin
      .from('creator_ledger')
      .insert({
        creator_id: t.creator_id,
        type: 'credit',
        amount: t.creator_net,
        reference_type: 'transaction',
        reference_id: t.transaction_id,
        description: `Liberação pergunta #${t.question_id}`,
      })

    if (insertError) {
      // Constraint UNIQUE previne duplicatas — ignorar conflitos
      if (insertError.code === '23505') continue
      console.error(`[cron/release-earnings] Erro ao inserir credit para transaction ${t.transaction_id}:`, insertError.message)
      continue
    }

    releasedCount++
    totalAmount += t.creator_net
  }

  console.log(`[cron/release-earnings] Liberados ${releasedCount} lançamentos, total R$${totalAmount.toFixed(2)}`)

  return NextResponse.json({
    released_count: releasedCount,
    total_amount: totalAmount,
    checked: transactions.length,
  })
}
