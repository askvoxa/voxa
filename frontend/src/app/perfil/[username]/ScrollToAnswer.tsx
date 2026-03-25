'use client'

import { useEffect } from 'react'

/**
 * Componente client que faz scroll até a resposta destacada.
 * Substitui o uso de dangerouslySetInnerHTML com query params (vetor XSS).
 */
export default function ScrollToAnswer({ answerId }: { answerId: string }) {
  useEffect(() => {
    // Sanitizar ID para prevenir manipulação
    const safeId = answerId.replace(/[^a-zA-Z0-9-]/g, '')
    if (!safeId) return

    const el = document.getElementById(`answer-${safeId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [answerId])

  return null
}
