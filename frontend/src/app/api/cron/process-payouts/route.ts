import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { timingSafeEqual } from 'crypto'

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

  // Verificar se hoje é o dia configurado (horário de Brasília)
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay()
  if (today !== (settings?.payout_day_of_week ?? 1)) {
    return NextResponse.json({ skipped: true, reason: `Hoje não é o dia de processamento (configurado: ${settings?.payout_day_of_week})` })
  }

  // Buscar payouts pendentes ou failed com retry < 3, de criadores não bloqueados
  const { data: payouts, error: queryError } = await supabaseAdmin
    .from('payout_requests')
    .select(`
      id, creator_id, amount, pix_key_id, status, retry_count,
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

  const pixEncryptionKey = process.env.PIX_ENCRYPTION_KEY
  if (!pixEncryptionKey) {
    console.error('[cron/process-payouts] PIX_ENCRYPTION_KEY não configurada')
    return NextResponse.json({ error: 'Erro de configuração de criptografia.' }, { status: 500 })
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

    // Decriptar chave PIX via RPC (valor nunca transita em plaintext fora do DB)
    const { data: pixKeyData, error: decryptError } = await supabaseAdmin
      .rpc('get_decrypted_pix_key_for_payout', {
        p_payout_id: payout.id,
        p_encryption_key: pixEncryptionKey,
      })

    if (decryptError || !pixKeyData || pixKeyData.length === 0) {
      const errorMsg = decryptError?.message || 'Chave PIX não encontrada ou falha na decriptação'
      await supabaseAdmin
        .from('payout_requests')
        .update({
          status: 'failed',
          failure_reason: errorMsg.slice(0, 500),
          retry_count: (payout.retry_count ?? 0) + 1,
        })
        .eq('id', payout.id)
      failed++
      console.error(`[cron/process-payouts] Payout ${payout.id} falha ao decriptar PIX: ${errorMsg}`)
      continue
    }

    const pixKey = pixKeyData[0] as { key_type: string; key_value: string }
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

  // C3: Reverter débitos de payouts que falharam permanentemente (retry_count >= 3)
  // Insere credit compensatório no ledger para devolver o saldo ao criador
  const { data: permanentFailures } = await supabaseAdmin
    .from('payout_requests')
    .select('id, creator_id, amount')
    .eq('status', 'failed')
    .gte('retry_count', 3)

  let reversed = 0
  for (const failedPayout of permanentFailures ?? []) {
    // Verificar se já existe um credit de compensação para este payout
    const { count } = await supabaseAdmin
      .from('creator_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('reference_type', 'payout')
      .eq('reference_id', failedPayout.id)
      .eq('type', 'credit')

    if ((count ?? 0) > 0) continue // Já revertido

    // Inserir credit compensatório (trigger atualiza available_balance automaticamente)
    const { error: reverseError } = await supabaseAdmin
      .from('creator_ledger')
      .insert({
        creator_id: failedPayout.creator_id,
        type: 'credit',
        amount: Number(failedPayout.amount),
        reference_type: 'payout',
        reference_id: failedPayout.id,
        description: `Estorno automático - saque #${failedPayout.id} falhou permanentemente`,
      })

    if (reverseError) {
      // Constraint UNIQUE previne duplicatas — ignorar conflitos silenciosamente
      if (reverseError.code !== '23505') {
        console.error(`[cron/process-payouts] Erro ao reverter payout ${failedPayout.id}:`, reverseError.message)
      }
      continue
    }

    reversed++
    console.log(`[cron/process-payouts] Payout ${failedPayout.id} revertido — R$${failedPayout.amount} devolvido ao criador ${failedPayout.creator_id}`)
  }

  console.log(`[cron/process-payouts] Processados: ${processed}, sucesso: ${succeeded}, falha: ${failed}, revertidos: ${reversed}`)

  return NextResponse.json({ processed, succeeded, failed, reversed })
}
