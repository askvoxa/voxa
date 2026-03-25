/**
 * Rate limiter in-memory com cleanup automático.
 * Para produção com múltiplas instâncias, migrar para Redis (ex: @upstash/ratelimit).
 *
 * Uso:
 *   const limiter = createRateLimiter({ interval: 60_000, maxRequests: 10 })
 *   const { success } = limiter.check(identifier)
 */

interface RateLimiterConfig {
  /** Janela de tempo em ms */
  interval: number
  /** Máximo de requests permitidos na janela */
  maxRequests: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

interface RateLimiterEntry {
  count: number
  resetAt: number
}

export function createRateLimiter(config: RateLimiterConfig) {
  const entries = new Map<string, RateLimiterEntry>()

  // Cleanup periódico para evitar memory leak (a cada 5 minutos)
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) {
        entries.delete(key)
      }
    }
  }, 5 * 60_000)

  // Permitir garbage collection do intervalo em ambientes não-serverless
  if (cleanupInterval.unref) {
    cleanupInterval.unref()
  }

  return {
    check(identifier: string): RateLimitResult {
      const now = Date.now()
      const entry = entries.get(identifier)

      // Janela expirada ou primeira requisição — resetar
      if (!entry || entry.resetAt <= now) {
        const resetAt = now + config.interval
        entries.set(identifier, { count: 1, resetAt })
        return { success: true, remaining: config.maxRequests - 1, resetAt }
      }

      // Dentro da janela — incrementar
      entry.count++
      if (entry.count > config.maxRequests) {
        return { success: false, remaining: 0, resetAt: entry.resetAt }
      }

      return {
        success: true,
        remaining: config.maxRequests - entry.count,
        resetAt: entry.resetAt,
      }
    },
  }
}

// Rate limiters pré-configurados por contexto
// Pagamentos: 10 requests por minuto por usuário
export const paymentLimiter = createRateLimiter({ interval: 60_000, maxRequests: 10 })

// Waitlist: 5 requests por minuto por IP (público, sem auth)
export const waitlistLimiter = createRateLimiter({ interval: 60_000, maxRequests: 5 })

// Rotas de setup/config: 10 requests por minuto
export const setupLimiter = createRateLimiter({ interval: 60_000, maxRequests: 10 })

// Rotas de report: 5 requests por 10 minutos
export const reportLimiter = createRateLimiter({ interval: 600_000, maxRequests: 5 })

/** Extrai IP do request para usar como identificador de rate limit */
export function getRequestIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}
