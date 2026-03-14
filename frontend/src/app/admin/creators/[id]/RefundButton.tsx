'use client'

import { useState } from 'react'

type Props = {
  questionId: string
}

export default function RefundButton({ questionId }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  async function handleRefund() {
    const confirmed = window.confirm('Processar reembolso para esta pergunta?')
    if (!confirmed) return

    setStatus('loading')
    try {
      const res = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: questionId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Erro')
      }
      setStatus('done')
    } catch (err: any) {
      alert(`Erro: ${err.message}`)
      setStatus('error')
    }
  }

  if (status === 'done') {
    return <span className="text-xs text-green-600 font-semibold">Reembolsado</span>
  }

  return (
    <button
      onClick={handleRefund}
      disabled={status === 'loading'}
      className="text-xs font-semibold px-2 py-1 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50"
    >
      {status === 'loading' ? '...' : 'Reembolsar'}
    </button>
  )
}
