// Server-side only — uses service role key. Do not import in client components.
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'

export type PlatformSettings = {
  platform_fee_rate: number       // e.g. 0.10 = 10%
  response_deadline_hours: number // e.g. 36
  // Parâmetros de payout
  payout_day_of_week: number      // 0=domingo, 1=segunda, ..., 6=sábado
  min_payout_amount: number       // valor mínimo para saque em R$
  payout_release_days: number     // dias após resposta para liberar valor
  payouts_paused: boolean         // pausa global de payouts
}

/** Fallback used if the DB table hasn't been migrated yet */
export const FALLBACK_SETTINGS: PlatformSettings = {
  platform_fee_rate: 0.1,
  response_deadline_hours: 36,
  payout_day_of_week: 1,
  min_payout_amount: 50,
  payout_release_days: 7,
  payouts_paused: false,
}

// Cache com Redis (multi-instância) + fallback in-memory (dev local)
let cachedSettings: PlatformSettings | null = null
let cacheExpiry = 0
const CACHE_KEY = 'voxa:platform_settings'
const CACHE_TTL_MS = 5_000 // fallback: reduzido de 60s para 5s entre instâncias
const REDIS_TTL_SECONDS = 30 // Redis: 30s, suficiente para settings com baixa frequência de mudança

export async function getPlatformSettings(): Promise<PlatformSettings> {
  // Tentar Redis primeiro (compartilhado entre instâncias serverless)
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (redisUrl && redisToken) {
    try {
      const redis = new Redis({ url: redisUrl, token: redisToken })
      const cached = await redis.get<PlatformSettings>(CACHE_KEY)
      if (cached) return cached
    } catch (err) {
      // Fallback silencioso para DB se Redis falhar
      console.warn('[platform-settings] Redis indisponível, usando fallback')
    }
  }

  // Fallback: in-memory com TTL curto (sem Redis) ou cache local
  if (cachedSettings && Date.now() < cacheExpiry) {
    return cachedSettings
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('platform_settings')
    .select('platform_fee_rate, response_deadline_hours, payout_day_of_week, min_payout_amount, payout_release_days, payouts_paused')
    .eq('id', 1)
    .single()

  if (!data) return FALLBACK_SETTINGS

  cachedSettings = {
    platform_fee_rate: Number(data.platform_fee_rate),
    response_deadline_hours: Number(data.response_deadline_hours),
    payout_day_of_week: Number(data.payout_day_of_week),
    min_payout_amount: Number(data.min_payout_amount),
    payout_release_days: Number(data.payout_release_days),
    payouts_paused: Boolean(data.payouts_paused),
  }
  cacheExpiry = Date.now() + CACHE_TTL_MS

  // Armazenar no Redis se disponível (para próximas instâncias)
  if (redisUrl && redisToken) {
    try {
      const redis = new Redis({ url: redisUrl, token: redisToken })
      await redis.setex(CACHE_KEY, REDIS_TTL_SECONDS, cachedSettings)
    } catch {
      // Silenciar erros de Redis — fallback in-memory já está em uso
    }
  }

  return cachedSettings
}

/** Invalida o cache (Redis + in-memory) para forçar re-leitura do banco na próxima chamada */
export async function invalidateSettingsCache(): Promise<void> {
  // Invalidar in-memory
  cachedSettings = null
  cacheExpiry = 0

  // Invalidar Redis se disponível
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

  if (redisUrl && redisToken) {
    try {
      const redis = new Redis({ url: redisUrl, token: redisToken })
      await redis.del(CACHE_KEY)
    } catch {
      // Silenciar erros ao apagar Redis — in-memory already invalidated
    }
  }
}

/** Returns creator's effective take-home rate (0–1). Custom overrides platform default. */
export function effectiveCreatorRate(
  settings: PlatformSettings,
  customCreatorRate: number | null | undefined
): number {
  if (customCreatorRate != null) return Number(customCreatorRate)
  return 1 - settings.platform_fee_rate
}

/** Returns creator's effective deadline hours. Custom overrides platform default. */
export function effectiveDeadlineHours(
  settings: PlatformSettings,
  customDeadlineHours: number | null | undefined
): number {
  if (customDeadlineHours != null) return Number(customDeadlineHours)
  return settings.response_deadline_hours
}

/** Format as percentage string, e.g. 0.9 → "90%" */
export function fmtPct(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, '')}%`
}
