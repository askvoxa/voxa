'use client'

import { useState } from 'react'

export default function PayoutRetryButton({ payoutId, onRetried }: { payoutId: string; onRetried?: () => void }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleRetry = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payouts/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payout_id: payoutId }),
      })
      if (res.ok) {
        setDone(true)
        onRetried?.()
      }
    } catch { /* silenciar */ }
    setLoading(false)
  }

  if (done) {
    return <span className="text-xs text-green-600 font-semibold">Re-enfileirado</span>
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="text-xs font-semibold text-[#DD2A7B] hover:underline disabled:opacity-50"
    >
      {loading ? '...' : 'Re-tentar'}
    </button>
  )
}
