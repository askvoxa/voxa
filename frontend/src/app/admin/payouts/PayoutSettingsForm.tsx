'use client'

import { useState, useEffect } from 'react'

const DAY_OPTIONS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
]

type PayoutSettings = {
  payout_day_of_week: number
  min_payout_amount: number
  payout_release_days: number
  payouts_paused: boolean
}

export default function PayoutSettingsForm() {
  const [settings, setSettings] = useState<PayoutSettings | null>(null)
  const [dayInput, setDayInput] = useState(1)
  const [minAmountInput, setMinAmountInput] = useState('50')
  const [releaseDaysInput, setReleaseDaysInput] = useState('7')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/admin/payouts/settings')
      .then(r => { if (!r.ok) throw new Error('Erro'); return r.json() })
      .then((data: PayoutSettings) => {
        setSettings(data)
        setDayInput(data.payout_day_of_week)
        setMinAmountInput(String(data.min_payout_amount))
        setReleaseDaysInput(String(data.payout_release_days))
      })
      .catch(() => setError('Erro ao carregar configurações.'))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess(false)

    const minAmount = parseFloat(minAmountInput)
    const releaseDays = parseInt(releaseDaysInput)

    if (isNaN(minAmount) || minAmount <= 0) {
      setError('Valor mínimo deve ser maior que R$0.')
      setSaving(false)
      return
    }
    if (isNaN(releaseDays) || releaseDays < 1) {
      setError('Dias de carência deve ser pelo menos 1.')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/admin/payouts/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payout_day_of_week: dayInput,
          min_payout_amount: minAmount,
          payout_release_days: releaseDays,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao salvar.')
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch {
      setError('Erro de conexão.')
    }
    setSaving(false)
  }

  if (!settings) return <div className="text-sm text-gray-500">Carregando...</div>

  return (
    <div className="space-y-4">
      {/* Dia da semana */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Dia de processamento
        </label>
        <select
          value={dayInput}
          onChange={e => setDayInput(Number(e.target.value))}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]"
        >
          {DAY_OPTIONS.map(d => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      {/* Valor mínimo */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Valor mínimo para saque
        </label>
        <div className="relative w-36">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
          <input
            type="number"
            min={1}
            step={1}
            value={minAmountInput}
            onChange={e => setMinAmountInput(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]"
          />
        </div>
      </div>

      {/* Dias de carência */}
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
          Carência após resposta
        </label>
        <div className="flex items-center gap-2">
          <div className="relative w-24">
            <input
              type="number"
              min={1}
              max={90}
              step={1}
              value={releaseDaysInput}
              onChange={e => setReleaseDaysInput(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-right pr-12 focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">dias</span>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-green-700 font-semibold text-sm">Configurações salvas.</p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-gray-900 text-white font-bold py-2.5 px-6 rounded-2xl text-sm disabled:opacity-50"
      >
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}
