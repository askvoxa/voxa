/**
 * Rate limiter com Upstash Redis + fallback in-memory.
 *
 * Produção (com UPSTASH_REDIS_REST_URL): usa Redis persistente (multi-instância).
 * Dev local (sem Redis): fallback para in-memory com cleanup automático.
 * Fail-open: se Redis cair, permite requests (segurança financeira está na RPC).
 *
 * Uso:
 *   const limiter = createRateLimiter({ interval: 60_000, maxRequests: 10 })
 *   const { success } = limiter.check(identifier)
 *
 *   // Para pagamentos/saques (async, com Redis):
 *   const { success } = await checkPayoutRateLimit(userId)
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

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

/**
 * Rate limiter para saques (pagamentos críticos).
 * Usa Redis se disponível (UPSTASH_REDIS_REST_URL), senão fallback in-memory.
 * Fail-open se Redis indisponível: segurança financeira real está na RPC (FOR UPDATE lock).
 */
export async function checkPayoutRateLimit(userId: string): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  // Com Redis configurado: usar persistente (multi-instância)
  if (url && token) {
    try {
      const redis = new Redis({ url, token })
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1, '1 h'),
        prefix: 'voxa:payout',
      })
      const result = await ratelimit.limit(userId)
      return {
        success: result.success,
        remaining: Math.max(0, result.remaining),
        resetAt: result.reset,
      }
    } catch (err) {
      // Fail-open: segurança financeira está no RPC request_payout (FOR UPDATE lock + existence check)
      // Redis indisponível não deve bloquear saques legítimos de usuários
      console.warn('[rate-limit] Redis indisponível, permitindo request:', err instanceof Error ? err.message : String(err))
      return { success: true, remaining: 0, resetAt: Date.now() + 3_600_000 }
    }
  }

  // Fallback in-memory para dev local (sem Redis configurado)
  return paymentLimiter.check(userId)
}
