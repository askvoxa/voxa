'use client'

import { useState, useEffect } from 'react'

type Settings = {
  platform_fee_rate: number
  response_deadline_hours: number
  updated_at?: string
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [feeInput, setFeeInput] = useState('')
  const [deadlineInput, setDeadlineInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/admin/platform-settings')
      .then(r => {
        if (!r.ok) throw new Error('Erro ao carregar configurações.')
        return r.json()
      })
      .then((data: Settings) => {
        if (!data.platform_fee_rate) throw new Error('Resposta inválida do servidor.')
        setSettings(data)
        setFeeInput(String((data.platform_fee_rate * 100).toFixed(1).replace(/\.0$/, '')))
        setDeadlineInput(String(data.response_deadline_hours))
      })
      .catch((err: Error) => setError(err.message))
  }, [])

  const creatorPct = () => {
    const fee = parseFloat(feeInput)
    if (isNaN(fee)) return '—'
    return `${(100 - fee).toFixed(1).replace(/\.0$/, '')}%`
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess(false)

    const feeVal = parseFloat(feeInput)
    const deadlineVal = parseInt(deadlineInput)

    if (isNaN(feeVal) || feeVal < 0 || feeVal > 50) {
      setError('Taxa deve estar entre 0% e 50%.')
      setSaving(false)
      return
    }
    if (isNaN(deadlineVal) || deadlineVal < 1 || deadlineVal > 720) {
      setError('Prazo deve estar entre 1 e 720 horas.')
      setSaving(false)
      return
    }

    let res: Response, data: { error?: string }
    try {
      res = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_fee_rate: feeVal / 100,
          response_deadline_hours: deadlineVal,
        }),
      })
      data = await res.json()
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setSaving(false)
      return
    }

    setSaving(false)
    if (!res.ok) {
      setError(data.error ?? 'Erro ao salvar.')
      return
    }

    setSettings(prev => prev ? {
      ...prev,
      platform_fee_rate: feeVal / 100,
      response_deadline_hours: deadlineVal,
      updated_at: new Date().toISOString(),
    } : prev)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  if (!settings) {
    return (
      <div className="p-8 text-gray-400 text-sm">Carregando...</div>
    )
  }

  const lastUpdated = settings.updated_at
    ? new Date(settings.updated_at).toLocaleString('pt-BR')
    : null

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Parâmetros da Plataforma</h1>
      {lastUpdated && (
        <p className="text-xs text-gray-400 mb-8">Última atualização: {lastUpdated}</p>
      )}

      <div className="space-y-6">
        {/* Fee */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="font-bold text-base text-gray-900 mb-1">Taxa da Plataforma</h2>
          <p className="text-sm text-gray-500 mb-4">
            Percentual cobrado sobre cada transação. O criador recebe o restante.
          </p>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={feeInput}
                onChange={e => setFeeInput(e.target.value)}
                className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm text-right pr-7 focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
            <span className="text-sm text-gray-400">→ criador recebe</span>
            <span className="font-bold text-green-600 text-base">{creatorPct()}</span>
          </div>
        </div>

        {/* Deadline */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="font-bold text-base text-gray-900 mb-1">Prazo de Resposta</h2>
          <p className="text-sm text-gray-500 mb-4">
            Horas que o criador tem para responder antes do reembolso automático ao fã.
          </p>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="number"
                min={1}
                max={720}
                step={1}
                value={deadlineInput}
                onChange={e => setDeadlineInput(e.target.value)}
                className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm text-right pr-12 focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">h</span>
            </div>
            <span className="text-sm text-gray-400">
              ≈ {Math.round(parseFloat(deadlineInput || '0') / 24 * 10) / 10} dias
            </span>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-2xl">
            <p className="text-green-700 font-semibold text-sm">Parâmetros salvos com sucesso.</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-instagram text-white font-bold py-3 px-8 rounded-2xl disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar parâmetros'}
        </button>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs text-amber-800 font-semibold mb-1">Atenção</p>
          <p className="text-xs text-amber-700">
            Alterações aqui afetam novos criadores e cálculos no painel. Criadores com parâmetros
            individuais configurados não são impactados. O processamento de pagamentos em andamento
            usa os valores vigentes no momento da transação.
          </p>
        </div>
      </div>
    </div>
  )
}
