// Server-side only — uses service role key. Do not import in client components.
import { createClient } from '@supabase/supabase-js'

export type PlatformSettings = {
  platform_fee_rate: number       // e.g. 0.10 = 10%
  response_deadline_hours: number // e.g. 36
}

/** Fallback used if the DB table hasn't been migrated yet */
export const FALLBACK_SETTINGS: PlatformSettings = {
  platform_fee_rate: 0.1,
  response_deadline_hours: 36,
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('platform_settings')
    .select('platform_fee_rate, response_deadline_hours')
    .eq('id', 1)
    .single()

  if (!data) return FALLBACK_SETTINGS
  return {
    platform_fee_rate: Number(data.platform_fee_rate),
    response_deadline_hours: Number(data.response_deadline_hours),
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
