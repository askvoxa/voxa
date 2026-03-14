'use client'

import { useState } from 'react'

export default function VisibilityToggle({
  questionId,
  initialVisible,
}: {
  questionId: string
  initialVisible: boolean
}) {
  const [isVisible, setIsVisible] = useState(initialVisible)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState(false)

  const toggle = async () => {
    setIsUpdating(true)
    setError(false)
    const newValue = !isVisible
    // Otimista
    setIsVisible(newValue)

    const res = await fetch('/api/questions/visibility', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, is_shareable: newValue }),
    })

    if (!res.ok) {
      // Rollback
      setIsVisible(!newValue)
      setError(true)
      setTimeout(() => setError(false), 3000)
    }
    setIsUpdating(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={isUpdating}
        title={isVisible ? 'Ocultar do perfil' : 'Mostrar no perfil'}
        className={`text-xs px-2 py-1 rounded-lg font-semibold transition-all disabled:opacity-60 border ${
          isVisible
            ? 'bg-green-50 text-green-600 border-green-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
            : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
        }`}
      >
        {isVisible ? '👁 Visível' : '🔒 Oculta'}
      </button>
      {error && (
        <p className="text-xs text-red-500">Erro ao alterar. Tente novamente.</p>
      )}
    </div>
  )
}
