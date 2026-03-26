'use client'

import { useState } from 'react'

export default function PayoutPauseButton({ initialPaused }: { initialPaused: boolean }) {
  const [paused, setPaused] = useState(initialPaused)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payouts/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payouts_paused: !paused }),
      })
      if (res.ok) {
        setPaused(!paused)
      }
    } catch { /* silenciar */ }
    setLoading(false)
    setConfirming(false)
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">
          {paused ? 'Retomar payouts?' : 'Pausar todos os payouts?'}
        </span>
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`text-sm font-bold px-4 py-1.5 rounded-xl ${
            paused
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          } disabled:opacity-50`}
        >
          {loading ? '...' : 'Confirmar'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className={`text-sm font-bold px-4 py-1.5 rounded-xl border transition-colors ${
        paused
          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
      }`}
    >
      {paused ? 'Retomar Payouts' : 'Pausar Payouts'}
    </button>
  )
}
