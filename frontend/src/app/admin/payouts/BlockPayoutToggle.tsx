'use client'

import { useState } from 'react'

type Props = {
  creatorId: string
  initialBlocked: boolean
}

export default function BlockPayoutToggle({ creatorId, initialBlocked }: Props) {
  const [blocked, setBlocked] = useState(initialBlocked)
  const [loading, setLoading] = useState(false)
  const [showReason, setShowReason] = useState(false)
  const [reason, setReason] = useState('')

  const handleToggle = async () => {
    // Se vai bloquear, mostrar input de motivo primeiro
    if (!blocked && !showReason) {
      setShowReason(true)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/creator/${creatorId}/block-payout`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: !blocked, reason: reason || undefined }),
      })
      if (res.ok) {
        setBlocked(!blocked)
        setShowReason(false)
        setReason('')
      }
    } catch { /* silenciar */ }
    setLoading(false)
  }

  if (showReason) {
    return (
      <div className="flex flex-col gap-2">
        <input
          type="text"
          placeholder="Motivo do bloqueio (opcional)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-48 focus:outline-none focus:ring-1 focus:ring-[#DD2A7B]"
        />
        <div className="flex gap-1">
          <button
            onClick={handleToggle}
            disabled={loading}
            className="text-xs font-semibold bg-red-600 text-white px-3 py-1 rounded-lg disabled:opacity-50"
          >
            {loading ? '...' : 'Bloquear'}
          </button>
          <button
            onClick={() => { setShowReason(false); setReason('') }}
            className="text-xs text-gray-500 px-2"
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
        blocked
          ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
          : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
      } disabled:opacity-50`}
    >
      {loading ? '...' : blocked ? 'Bloqueado' : 'Liberado'}
    </button>
  )
}
