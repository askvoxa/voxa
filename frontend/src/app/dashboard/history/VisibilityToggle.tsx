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
        aria-label={isVisible ? 'Ocultar do perfil' : 'Mostrar no perfil'}
        className={`text-xs px-3 py-2 rounded-lg font-semibold transition-all disabled:opacity-60 border cursor-pointer ${
          isVisible
            ? 'bg-green-50 text-green-600 border-green-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200'
            : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-green-50 hover:text-green-600 hover:border-green-200'
        }`}
      >
        {isUpdating ? (
          <span className="flex items-center gap-1" role="status" aria-label="Atualizando">
            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            ...
          </span>
        ) : isVisible ? <><span role="img" aria-hidden="true">👁</span> Visível</> : <><span role="img" aria-hidden="true">🔒</span> Oculta</>}
      </button>
      {error && (
        <p className="text-sm text-red-500" role="alert">Erro ao alterar. Tente novamente.</p>
      )}
    </div>
  )
}
