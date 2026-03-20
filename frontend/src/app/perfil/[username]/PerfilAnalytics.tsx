'use client'

import { useEffect, useRef } from 'react'
import {
  trackProfileView,
  trackPurchase,
  trackPaymentFailed,
  trackPaymentPending,
  getPendingPaymentData,
  clearPendingPaymentData,
} from '@/lib/analytics'

type Props = {
  creatorUsername: string
  minPrice: number
  paymentStatus: string | null
  /** payment_id enviado pelo MP na query string de retorno */
  paymentId: string | null
}

export default function PerfilAnalytics({ creatorUsername, minPrice, paymentStatus, paymentId }: Props) {
  const profileTracked = useRef(false)

  // Dispara view_item exatamente uma vez por montagem
  useEffect(() => {
    if (profileTracked.current) return
    profileTracked.current = true
    trackProfileView(creatorUsername, minPrice)
  }, [creatorUsername, minPrice])

  // Processa o retorno do Mercado Pago
  useEffect(() => {
    if (!paymentStatus) return

    const pending = getPendingPaymentData()
    const amount = pending?.amount ?? 0
    const serviceType = pending?.serviceType ?? 'unknown'
    // Usa o payment_id real do MP para deduplicação; cai no preferenceId como fallback
    const transactionId = paymentId ?? pending?.preferenceId ?? creatorUsername

    if (paymentStatus === 'approved') {
      trackPurchase({ transactionId, creatorUsername, amount, serviceType })
      clearPendingPaymentData()
    } else if (paymentStatus === 'failure') {
      trackPaymentFailed(creatorUsername, amount)
      clearPendingPaymentData()
    } else if (paymentStatus === 'pending') {
      trackPaymentPending(creatorUsername, amount)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus, creatorUsername])

  return null
}
