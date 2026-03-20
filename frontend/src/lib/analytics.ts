/**
 * VOXA — Google Analytics 4 (GA_ID)
 *
 * Funil de conversão do fã:
 *   1. view_item          → /perfil/[username] carregou
 *   2. begin_checkout     → primeira interação com o form
 *   3. add_payment_info   → submit → indo pro Mercado Pago
 *   4. purchase           → retorno com payment_status=approved
 *   5. payment_failed     → retorno com payment_status=failure
 *
 * Onboarding do criador:
 *   6. creator_setup_complete → cadastro finalizado
 */

// Lê do .env ou cai no fallback do production ID
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? 'G-ZNRDGLF272'

// ─── Tipagem global ───────────────────────────────────────────────────────────
type GtagCommand = 'config' | 'event' | 'js' | 'set'

declare global {
  interface Window {
    gtag: (command: GtagCommand, target: string | Date, params?: Record<string, unknown>) => void
    dataLayer: unknown[]
  }
}

/**
 * Enfileira eventos no dataLayer diretamente.
 * Isso é race-condition-safe: quando gtag.js carregar, vai processar a fila.
 * Deve ser uma function declaration (não arrow) para manter compatibilidade
 * com o padrão `window.dataLayer.push(arguments)` do gtag.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function gtag(...args: any[]) {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(args)
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PendingPaymentData {
  creator: string
  amount: number
  serviceType: string
  preferenceId: string
}

// ─── Funil do Fã ─────────────────────────────────────────────────────────────

/**
 * Etapa 1 — Visualização do perfil do criador.
 * Chamar uma vez por montagem da página (proteger com useRef externo).
 */
export function trackProfileView(creatorUsername: string, minPrice: number) {
  gtag('event', 'view_item', {
    currency: 'BRL',
    value: minPrice,
    items: [
      {
        item_id: creatorUsername,
        item_name: `@${creatorUsername}`,
        item_category: 'creator_profile',
        price: minPrice,
      },
    ],
  })
}

/**
 * Etapa 2 — Início do preenchimento do formulário.
 * O chamador é responsável por garantir disparo único via useRef.
 */
export function trackFormStart(creatorUsername: string, mode: 'question' | 'support', amount: number) {
  gtag('event', 'begin_checkout', {
    currency: 'BRL',
    value: amount,
    items: [
      {
        item_id: creatorUsername,
        item_name: `@${creatorUsername}`,
        item_category: mode,
        price: amount,
      },
    ],
  })

  gtag('event', 'question_form_start', {
    creator_username: creatorUsername,
    mode,
  })
}

/**
 * Etapa 3 — Pagamento iniciado: indo pro Mercado Pago.
 * Persiste dados no sessionStorage para o evento purchase no retorno.
 */
export function trackPaymentInitiated(params: {
  creatorUsername: string
  amount: number
  serviceType: 'base' | 'premium' | 'support'
  preferenceId: string
  isAnonymous: boolean
}) {
  if (typeof window !== 'undefined') {
    const data: PendingPaymentData = {
      creator: params.creatorUsername,
      amount: params.amount,
      serviceType: params.serviceType,
      preferenceId: params.preferenceId,
    }
    sessionStorage.setItem('voxa_pending_payment', JSON.stringify(data))
  }

  gtag('event', 'add_payment_info', {
    currency: 'BRL',
    value: params.amount,
    payment_type: 'pix',
    items: [
      {
        item_id: params.creatorUsername,
        item_name: `@${params.creatorUsername}`,
        item_category: params.serviceType,
        price: params.amount,
        quantity: 1,
      },
    ],
  })

  gtag('event', 'payment_initiated', {
    creator_username: params.creatorUsername,
    service_type: params.serviceType,
    value: params.amount,
    currency: 'BRL',
    is_anonymous: params.isAnonymous,
  })
}

/**
 * Etapa 4 — Compra concluída (payment_status=approved).
 * Usa o payment_id real do Mercado Pago como transaction_id.
 * Deduplicação via sessionStorage para evitar duplo disparo em refresh.
 */
export function trackPurchase(params: {
  transactionId: string
  creatorUsername: string
  amount: number
  serviceType: string
}) {
  if (typeof window !== 'undefined') {
    const dedupKey = `voxa_tracked_${params.transactionId}`
    if (sessionStorage.getItem(dedupKey)) return
    sessionStorage.setItem(dedupKey, '1')
  }

  gtag('event', 'purchase', {
    transaction_id: params.transactionId,
    currency: 'BRL',
    value: params.amount,
    items: [
      {
        item_id: params.creatorUsername,
        item_name: `@${params.creatorUsername}`,
        item_category: params.serviceType,
        price: params.amount,
        quantity: 1,
      },
    ],
  })
}

export function trackPaymentFailed(creatorUsername: string, amount?: number) {
  gtag('event', 'payment_failed', {
    creator_username: creatorUsername,
    value: amount ?? 0,
    currency: 'BRL',
  })
}

export function trackPaymentPending(creatorUsername: string, amount?: number) {
  gtag('event', 'payment_pending', {
    creator_username: creatorUsername,
    value: amount ?? 0,
    currency: 'BRL',
  })
}

// ─── Onboarding do Criador ────────────────────────────────────────────────────

export function trackCreatorSetupComplete(username: string, minPrice: number) {
  gtag('event', 'creator_setup_complete', {
    username,
    min_price: minPrice,
  })
}

// ─── Helpers de sessionStorage ────────────────────────────────────────────────

export function getPendingPaymentData(): PendingPaymentData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem('voxa_pending_payment')
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingPaymentData>
    if (typeof parsed?.amount !== 'number' || typeof parsed?.preferenceId !== 'string') return null
    return parsed as PendingPaymentData
  } catch {
    return null
  }
}

export function clearPendingPaymentData() {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('voxa_pending_payment')
  }
}
