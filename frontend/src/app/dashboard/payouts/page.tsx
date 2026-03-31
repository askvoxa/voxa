'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatPixKey, validatePixKey, stripMask } from '@/lib/pix-validation'

type BalanceData = {
  available_balance: number
  pending_release: number
  total_withdrawn: number
  has_pix_key: boolean
  min_payout_amount: number
  payout_day_of_week: number
  payout_release_days: number
  payouts_paused: boolean
  payouts_blocked: boolean
  can_request: boolean
}

type PixKeyData = {
  has_key: boolean
  key_type?: 'cpf' | 'cnpj'
  masked_value?: string
}

type PayoutItem = {
  id: string
  amount: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  failure_reason?: string
  requested_at: string
  processed_at?: string
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  processing: 'Processando',
  completed: 'Concluído',
  failed: 'Falhou',
}

export default function PayoutsPage() {
  // Estado do saldo
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(true)

  // Estado da chave PIX
  const [pixKey, setPixKey] = useState<PixKeyData | null>(null)
  const [keyType, setKeyType] = useState<'cpf' | 'cnpj'>('cpf')
  const [keyValue, setKeyValue] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [keyError, setKeyError] = useState('')
  const [keySuccess, setKeySuccess] = useState(false)
  const [editingKey, setEditingKey] = useState(false)

  // Estado do modal de saque
  const [showModal, setShowModal] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [requestSuccess, setRequestSuccess] = useState(false)

  // Estado do histórico
  const [payouts, setPayouts] = useState<PayoutItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)

  // Carregar dados
  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/payout/balance')
      if (res.ok) setBalance(await res.json())
    } catch { /* silenciar */ }
    setLoadingBalance(false)
  }, [])

  const loadPixKey = useCallback(async () => {
    try {
      const res = await fetch('/api/payout/pix-key')
      if (res.ok) setPixKey(await res.json())
    } catch { /* silenciar */ }
  }, [])

  const loadHistory = useCallback(async (page = 1) => {
    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/payout/history?page=${page}&per_page=10`)
      if (res.ok) {
        const data = await res.json()
        setPayouts(data.payouts)
        setHistoryTotal(data.total)
        setHistoryPage(page)
      }
    } catch { /* silenciar */ }
    setLoadingHistory(false)
  }, [])

  useEffect(() => {
    loadBalance()
    loadPixKey()
    loadHistory()
  }, [loadBalance, loadPixKey, loadHistory])

  // Salvar chave PIX
  const handleSaveKey = async () => {
    setKeyError('')
    setKeySuccess(false)
    const raw = stripMask(keyValue)

    if (!validatePixKey(keyType, raw)) {
      setKeyError(`${keyType.toUpperCase()} inválido. Verifique os dígitos.`)
      return
    }

    setSavingKey(true)
    try {
      const res = await fetch('/api/payout/pix-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key_type: keyType, key_value: raw }),
      })
      const data = await res.json()
      if (!res.ok) {
        setKeyError(data.error || 'Erro ao cadastrar chave.')
      } else {
        setPixKey({ has_key: true, key_type: keyType, masked_value: data.masked_value })
        setKeyValue('')
        setKeySuccess(true)
        setEditingKey(false)
        loadBalance()
        setTimeout(() => setKeySuccess(false), 3000)
      }
    } catch {
      setKeyError('Erro de conexão.')
    }
    setSavingKey(false)
  }

  // Solicitar saque
  const handleRequestPayout = async () => {
    setRequestError('')
    setRequesting(true)
    try {
      const res = await fetch('/api/payout/request', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setRequestError(data.error || 'Erro ao solicitar saque.')
      } else {
        setRequestSuccess(true)
        setShowModal(false)
        loadBalance()
        loadHistory()
        setTimeout(() => setRequestSuccess(false), 5000)
      }
    } catch {
      setRequestError('Erro de conexão.')
    }
    setRequesting(false)
  }

  // Formatação de moeda
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // Próximo dia de processamento
  const nextPayoutDay = () => {
    if (!balance) return ''
    const day = balance.payout_day_of_week
    const now = new Date()
    const currentDay = now.getUTCDay()
    const daysUntil = day >= currentDay ? day - currentDay : 7 - currentDay + day
    const nextDate = new Date(now.getTime() + daysUntil * 24 * 60 * 60 * 1000)
    return `${DAY_NAMES[day]}, ${nextDate.toLocaleDateString('pt-BR')}`
  }

  // Loading state
  if (loadingBalance) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 w-full">
        <div className="space-y-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-3" />
              <div className="h-8 w-24 bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 w-full">
      <h1 className="text-2xl font-bold text-zinc-100">Saques</h1>

      {/* Painel de Saldo */}
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
        <p className="text-sm text-zinc-400 mb-1">Saldo disponível</p>
        <p className="text-3xl font-bold text-zinc-100">{fmtBRL(balance?.available_balance ?? 0)}</p>

        {(balance?.pending_release ?? 0) > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <p className="text-sm text-zinc-400">
              A liberar: <span className="font-semibold text-zinc-200">{fmtBRL(balance!.pending_release)}</span>
            </p>
            <span className="relative group">
              <span className="text-zinc-500 cursor-help text-xs border border-zinc-600 rounded-full w-4 h-4 inline-flex items-center justify-center">?</span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-700 text-zinc-100 text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Valores liberados {balance?.payout_release_days ?? 7} dias após resposta
              </span>
            </span>
          </div>
        )}

        {(balance?.total_withdrawn ?? 0) > 0 && (
          <p className="text-xs text-zinc-500 mt-2">Total já sacado: {fmtBRL(balance!.total_withdrawn)}</p>
        )}

        <div className="mt-4">
          {balance?.payouts_paused && (
            <p className="text-sm text-amber-400 font-medium mb-2">Saques temporariamente pausados pela plataforma.</p>
          )}
          {balance?.payouts_blocked && (
            <p className="text-sm text-red-400 font-medium mb-2">Seus saques estão bloqueados. Entre em contato com o suporte.</p>
          )}

          <button
            onClick={() => setShowModal(true)}
            disabled={!balance?.can_request}
            className="bg-gradient-instagram text-white font-bold py-3 px-8 rounded-2xl disabled:opacity-50 transition-opacity"
          >
            Solicitar Saque
          </button>

          {!balance?.has_pix_key && (
            <p className="text-xs text-zinc-500 mt-2">Cadastre uma chave PIX para solicitar saque.</p>
          )}
          {balance?.has_pix_key && (balance?.available_balance ?? 0) < (balance?.min_payout_amount ?? 50) && (
            <p className="text-xs text-zinc-500 mt-2">
              Valor mínimo para saque: {fmtBRL(balance?.min_payout_amount ?? 50)}
            </p>
          )}
        </div>
      </div>

      {/* Sucesso do saque */}
      {requestSuccess && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl">
          <p className="text-green-400 font-semibold text-sm">Saque solicitado com sucesso!</p>
          <p className="text-green-500/80 text-xs mt-1">Processamento previsto: {nextPayoutDay()}</p>
        </div>
      )}

      {/* Chave PIX */}
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
        <h2 className="font-bold text-base text-zinc-100 mb-1">Chave PIX</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Cadastre sua chave PIX para receber os pagamentos.
        </p>

        {pixKey?.has_key && !editingKey ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{pixKey.key_type}</span>
              <p className="text-base font-mono text-zinc-200 mt-0.5">{pixKey.masked_value}</p>
            </div>
            <button
              onClick={() => setEditingKey(true)}
              className="text-sm text-[#DD2A7B] font-semibold hover:underline"
            >
              Alterar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => { setKeyType('cpf'); setKeyValue('') }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  keyType === 'cpf' ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                CPF
              </button>
              <button
                onClick={() => { setKeyType('cnpj'); setKeyValue('') }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  keyType === 'cnpj' ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                CNPJ
              </button>
            </div>

            <input
              type="text"
              inputMode="numeric"
              placeholder={keyType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
              value={keyValue}
              onChange={e => setKeyValue(formatPixKey(keyType, e.target.value))}
              maxLength={keyType === 'cpf' ? 14 : 18}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]"
            />

            {keyError && <p className="text-sm text-red-400">{keyError}</p>}
            {keySuccess && <p className="text-sm text-green-400 font-semibold">Chave cadastrada com sucesso!</p>}

            <div className="flex gap-2">
              <button
                onClick={handleSaveKey}
                disabled={savingKey || !keyValue}
                className="bg-gradient-instagram text-white font-bold py-2.5 px-6 rounded-2xl text-sm disabled:opacity-50"
              >
                {savingKey ? 'Salvando...' : 'Salvar chave PIX'}
              </button>
              {pixKey?.has_key && (
                <button
                  onClick={() => { setEditingKey(false); setKeyError(''); setKeyValue('') }}
                  className="text-sm text-zinc-400 hover:text-zinc-200 px-4 py-2.5"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Histórico de Saques */}
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
        <h2 className="font-bold text-base text-zinc-100 mb-4">Histórico de Saques</h2>

        {loadingHistory ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-14 bg-zinc-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : payouts.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum saque realizado ainda.</p>
        ) : (
          <div className="space-y-3">
            {payouts.map(p => (
              <div key={p.id} className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{fmtBRL(p.amount)}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(p.requested_at).toLocaleDateString('pt-BR')}
                    {p.processed_at && ` — Processado: ${new Date(p.processed_at).toLocaleDateString('pt-BR')}`}
                  </p>
                  {p.status === 'failed' && p.failure_reason && (
                    <p className="text-xs text-red-400 mt-0.5">{p.failure_reason}</p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
            ))}

            {historyTotal > payouts.length && (
              <button
                onClick={() => loadHistory(historyPage + 1)}
                className="w-full text-sm text-[#DD2A7B] font-semibold py-2 hover:underline"
              >
                Carregar mais
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Saque */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full border border-zinc-800 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-zinc-100 mb-4">Confirmar Saque</h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-sm text-zinc-400">Valor</span>
                <span className="text-sm font-bold text-zinc-100">{fmtBRL(balance?.available_balance ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-zinc-400">Chave PIX</span>
                <span className="text-sm font-mono text-zinc-200">{pixKey?.masked_value}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-zinc-400">Processamento</span>
                <span className="text-sm text-zinc-200">{nextPayoutDay()}</span>
              </div>
            </div>

            {requestError && <p className="text-sm text-red-400 mb-4">{requestError}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleRequestPayout}
                disabled={requesting}
                className="flex-1 bg-gradient-instagram text-white font-bold py-3 rounded-2xl disabled:opacity-50 text-sm"
              >
                {requesting ? 'Processando...' : 'Confirmar Saque'}
              </button>
              <button
                onClick={() => { setShowModal(false); setRequestError('') }}
                className="px-6 py-3 text-sm text-zinc-400 font-semibold hover:text-zinc-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
