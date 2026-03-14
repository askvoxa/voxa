'use client'

import { useState } from 'react'

type Props = {
  creatorId: string
  isActive: boolean
  username: string
}

export default function BanToggle({ creatorId, isActive, username }: Props) {
  const [active, setActive] = useState(isActive)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    const action = active ? 'banir' : 'reativar'
    const confirmed = window.confirm(
      `Tem certeza que deseja ${action} @${username}?`
    )
    if (!confirmed) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/creators/${creatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !active }),
      })
      if (!res.ok) throw new Error('Erro na requisição')
      setActive(!active)
    } catch {
      alert('Erro ao atualizar status do criador.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
        active
          ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
          : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
      }`}
    >
      {loading ? '...' : active ? 'Banir conta' : 'Reativar conta'}
    </button>
  )
}
