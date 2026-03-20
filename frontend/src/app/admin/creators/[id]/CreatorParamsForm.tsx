'use client'

import { useState } from 'react'

type PlatformSettings = {
  platform_fee_rate: number
  response_deadline_hours: number
}

type Props = {
  creatorId: string
  username: string
  customCreatorRate: number | null
  customDeadlineHours: number | null
  platformSettings: PlatformSettings
}

export default function CreatorParamsForm({
  creatorId,
  username,
  customCreatorRate,
  customDeadlineHours,
  platformSettings,
}: Props) {
  const defaultCreatorRate = 1 - platformSettings.platform_fee_rate
  const defaultDeadline = platformSettings.response_deadline_hours

  // Creator rate state
  const [useDefaultRate, setUseDefaultRate] = useState(customCreatorRate === null)
  const [rateInput, setRateInput] = useState(
    customCreatorRate !== null
      ? String((customCreatorRate * 100).toFixed(1).replace(/\.0$/, ''))
      : String((defaultCreatorRate * 100).toFixed(1).replace(/\.0$/, ''))
  )

  // Deadline state
  const [useDefaultDeadline, setUseDefaultDeadline] = useState(customDeadlineHours === null)
  const [deadlineInput, setDeadlineInput] = useState(
    customDeadlineHours !== null
      ? String(customDeadlineHours)
      : String(defaultDeadline)
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess(false)

    const body: Record<string, number | null> = {}

    if (useDefaultRate) {
      body.custom_creator_rate = null
    } else {
      const rate = parseFloat(rateInput)
      if (isNaN(rate) || rate < 50 || rate > 100) {
        setError('Percentual do criador deve estar entre 50% e 100%.')
        setSaving(false)
        return
      }
      body.custom_creator_rate = rate / 100
    }

    if (useDefaultDeadline) {
      body.custom_deadline_hours = null
    } else {
      const hours = parseInt(deadlineInput)
      if (isNaN(hours) || hours < 1 || hours > 720) {
        setError('Prazo deve estar entre 1 e 720 horas.')
        setSaving(false)
        return
      }
      body.custom_deadline_hours = hours
    }

    let res: Response, data: { error?: string }
    try {
      res = await fetch(`/api/admin/creators/${creatorId}/params`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const platFmtRate = `${(defaultCreatorRate * 100).toFixed(1).replace(/\.0$/, '')}%`
  const platFmtFee = `${(platformSettings.platform_fee_rate * 100).toFixed(1).replace(/\.0$/, '')}%`

  const effectiveFee = useDefaultRate
    ? `${(platformSettings.platform_fee_rate * 100).toFixed(1).replace(/\.0$/, '')}%`
    : `${(100 - parseFloat(rateInput || '0')).toFixed(1).replace(/\.0$/, '')}%`

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      <h2 className="text-base font-bold text-gray-900 mb-1">Parâmetros Individuais</h2>
      <p className="text-xs text-gray-500 mb-5">
        Configurações negociadas com @{username}. Sobrepõem os padrões da plataforma.
      </p>

      <div className="space-y-6">
        {/* Creator rate */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Repasse ao criador</p>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="radio"
              checked={useDefaultRate}
              onChange={() => setUseDefaultRate(true)}
              className="accent-[#DD2A7B]"
            />
            <span className="text-sm text-gray-700">
              Padrão da plataforma —{' '}
              <span className="font-semibold text-green-600">{platFmtRate} para o criador</span>
              <span className="text-gray-500"> / taxa {platFmtFee}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              checked={!useDefaultRate}
              onChange={() => setUseDefaultRate(false)}
              className="accent-[#DD2A7B] mt-0.5"
            />
            <div className="flex-1">
              <span className="text-sm text-gray-700">Percentual individual</span>
              {!useDefaultRate && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min={50}
                      max={100}
                      step={0.5}
                      value={rateInput}
                      onChange={e => setRateInput(e.target.value)}
                      className="w-24 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-right pr-7 focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">%</span>
                  </div>
                  <span className="text-xs text-gray-500">para o criador → taxa {effectiveFee}</span>
                </div>
              )}
            </div>
          </label>
        </div>

        {/* Deadline */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Prazo de resposta</p>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="radio"
              checked={useDefaultDeadline}
              onChange={() => setUseDefaultDeadline(true)}
              className="accent-[#DD2A7B]"
            />
            <span className="text-sm text-gray-700">
              Padrão da plataforma —{' '}
              <span className="font-semibold">{defaultDeadline}h</span>
            </span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              checked={!useDefaultDeadline}
              onChange={() => setUseDefaultDeadline(false)}
              className="accent-[#DD2A7B] mt-0.5"
            />
            <div>
              <span className="text-sm text-gray-700">Prazo individual</span>
              {!useDefaultDeadline && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={720}
                      step={1}
                      value={deadlineInput}
                      onChange={e => setDeadlineInput(e.target.value)}
                      className="w-24 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-right pr-7 focus:outline-none focus:ring-2 focus:ring-[#DD2A7B]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">h</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    ≈ {Math.round(parseFloat(deadlineInput || '0') / 24 * 10) / 10} dias
                  </span>
                </div>
              )}
            </div>
          </label>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {success && (
          <p className="text-sm text-green-600 font-semibold">Parâmetros salvos.</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm font-semibold px-5 py-2 rounded-xl bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar parâmetros'}
        </button>
      </div>
    </div>
  )
}
