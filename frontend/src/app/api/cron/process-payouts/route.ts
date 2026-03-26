import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/cron/process-payouts
 * Cron executado diariamente, mas só processa no dia da semana configurado.
 * Busca payout_requests pendentes/failed e envia via API de Payouts do Mercado Pago.
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

  // Buscar configurações da plataforma
  const { data: settings } = await supabaseAdmin
    .from('platform_settings')
    .select('payout_day_of_week, payouts_paused')
    .eq('id', 1)
    .single()

  if (settings?.payouts_paused) {
    return NextResponse.json({ skipped: true, reason: 'Payouts pausados globalmente' })
  }

  // Verificar se hoje é o dia configurado (UTC)
  const today = new Date().getUTCDay()
  if (today !== (settings?.payout_day_of_week ?? 1)) {
    return NextResponse.json({ skipped: true, reason: `Hoje não é o dia de processamento (configurado: ${settings?.payout_day_of_week})` })
  }

  // Buscar payouts pendentes ou failed com retry < 3, de criadores não bloqueados
  const { data: payouts, error: queryError } = await supabaseAdmin
    .from('payout_requests')
    .select(`
      id, creator_id, amount, pix_key_id, status, retry_count,
      creator_pix_keys!inner (key_type, key_value),
      profiles!inner (username, payouts_blocked)
    `)
    .or('status.eq.pending,and(status.eq.failed,retry_count.lt.3)')
    .eq('profiles.payouts_blocked', false)

  if (queryError) {
    console.error('[cron/process-payouts] Erro ao buscar payouts:', queryError.message)
    return NextResponse.json({ error: 'Erro ao buscar payouts.' }, { status: 500 })
  }

  const mpAccessToken = process.env.MP_ACCESS_TOKEN
  if (!mpAccessToken) {
    console.error('[cron/process-payouts] MP_ACCESS_TOKEN não configurado')
    return NextResponse.json({ error: 'Erro de configuração do Mercado Pago.' }, { status: 500 })
  }

  let processed = 0
  let succeeded = 0
  let failed = 0

  for (const payout of payouts ?? []) {
    processed++

    // Marcar como processing
    await supabaseAdmin
      .from('payout_requests')
      .update({ status: 'processing' })
      .eq('id', payout.id)

    // Extrair dados da chave PIX
    const pixKey = payout.creator_pix_keys as unknown as { key_type: string; key_value: string }
    const profile = payout.profiles as unknown as { username: string }

    // Montar payload para API de Payouts do MP (conforme design seção 3)
    const mpPayload = {
      amount: Number(payout.amount),
      currency_id: 'BRL',
      description: `VOXA - Saque criador @${profile.username}`,
      payment_method_id: 'pix',
      bank_transfer_type: 'pix',
      receiver: {
        identification: {
          type: pixKey.key_type.toUpperCase(),
          number: pixKey.key_value,
        },
      },
    }

    try {
      const response = await fetch('https://api.mercadopago.com/v1/payouts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mpPayload),
      })

      const result = await response.json()

      if (response.ok && result.id) {
        // Sucesso
        await supabaseAdmin
          .from('payout_requests')
          .update({
            status: 'completed',
            mp_payout_id: String(result.id),
            processed_at: new Date().toISOString(),
          })
          .eq('id', payout.id)

        succeeded++
        console.log(`[cron/process-payouts] Payout ${payout.id} concluído. MP ID: ${result.id}`)
      } else {
        // Falha na API do MP
        const errorMsg = result.message || result.error || JSON.stringify(result)
        await supabaseAdmin
          .from('payout_requests')
          .update({
            status: 'failed',
            failure_reason: errorMsg.slice(0, 500),
            retry_count: (payout.retry_count ?? 0) + 1,
          })
          .eq('id', payout.id)

        failed++
        console.error(`[cron/process-payouts] Payout ${payout.id} falhou: ${errorMsg}`)
      }
    } catch (err) {
      // Erro de rede/conexão
      const errorMsg = err instanceof Error ? err.message : 'Erro de conexão'
      await supabaseAdmin
        .from('payout_requests')
        .update({
          status: 'failed',
          failure_reason: errorMsg.slice(0, 500),
          retry_count: (payout.retry_count ?? 0) + 1,
        })
        .eq('id', payout.id)

      failed++
      console.error(`[cron/process-payouts] Payout ${payout.id} erro de rede:`, errorMsg)
    }
  }

  console.log(`[cron/process-payouts] Processados: ${processed}, sucesso: ${succeeded}, falha: ${failed}`)

  return NextResponse.json({ processed, succeeded, failed })
}
