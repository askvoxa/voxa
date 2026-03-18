export type MilestoneTier = 'bronze' | 'silver' | 'gold' | null

export type MilestoneType =
  | 'soldout'
  | 'streak'
  | 'fast_responder'
  | 'total_answered'
  | 'response_rate'
  | 'marathoner'

export type Milestone = {
  type: MilestoneType
  tier: MilestoneTier
  label: string
  icon: string
  currentValue: number
  nextTierValue: number | null
  progress: number // 0-100
}

export type CreatorStats = {
  creator_id: string
  total_answered: number
  total_received: number
  total_expired: number
  current_streak: number
  max_streak: number
  last_active_date: string | null
  avg_response_seconds: number
  soldout_days_last30: number
  marathon_count: number
}

type MilestoneConfig = {
  label: string
  icon: string
  tiers: { bronze: number; silver: number; gold: number }
}

const MILESTONE_CONFIG: Record<MilestoneType, MilestoneConfig> = {
  soldout: {
    label: 'Sold Out',
    icon: '🔥',
    tiers: { bronze: 3, silver: 7, gold: 15 },
  },
  streak: {
    label: 'Sequência',
    icon: '⚡',
    tiers: { bronze: 7, silver: 30, gold: 100 },
  },
  fast_responder: {
    label: 'Resposta Rápida',
    icon: '⏱️',
    tiers: { bronze: 12 * 3600, silver: 6 * 3600, gold: 2 * 3600 },
  },
  total_answered: {
    label: 'Respostas',
    icon: '💬',
    tiers: { bronze: 50, silver: 100, gold: 500 },
  },
  response_rate: {
    label: 'Taxa de Resposta',
    icon: '✅',
    tiers: { bronze: 90, silver: 95, gold: 100 },
  },
  marathoner: {
    label: 'Maratonista',
    icon: '🏃',
    tiers: { bronze: 1, silver: 5, gold: 15 },
  },
}

export const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
} as const

export const TIER_LABELS: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
}

function getTodayBRT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function daysDiff(dateStr: string): number {
  const today = new Date(getTodayBRT())
  const date = new Date(dateStr)
  return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

function computeTierAndProgress(
  value: number,
  thresholds: { bronze: number; silver: number; gold: number },
  inverted = false,
): { tier: MilestoneTier; nextTierValue: number | null; progress: number } {
  if (inverted) {
    // Lower is better (fast_responder: seconds)
    if (value <= 0) return { tier: null, nextTierValue: thresholds.bronze, progress: 0 }
    if (value <= thresholds.gold) return { tier: 'gold', nextTierValue: null, progress: 100 }
    if (value <= thresholds.silver) {
      const progress = Math.round(((thresholds.silver - value) / (thresholds.silver - thresholds.gold)) * 100)
      return { tier: 'silver', nextTierValue: thresholds.gold, progress: Math.min(99, progress) }
    }
    if (value <= thresholds.bronze) {
      const progress = Math.round(((thresholds.bronze - value) / (thresholds.bronze - thresholds.silver)) * 100)
      return { tier: 'bronze', nextTierValue: thresholds.silver, progress: Math.min(99, progress) }
    }
    const progress = Math.round(Math.max(0, (1 - (value - thresholds.bronze) / thresholds.bronze)) * 100)
    return { tier: null, nextTierValue: thresholds.bronze, progress: Math.max(0, progress) }
  }

  // Higher is better (default)
  if (value >= thresholds.gold) return { tier: 'gold', nextTierValue: null, progress: 100 }
  if (value >= thresholds.silver) {
    const progress = Math.round(((value - thresholds.silver) / (thresholds.gold - thresholds.silver)) * 100)
    return { tier: 'silver', nextTierValue: thresholds.gold, progress: Math.min(99, progress) }
  }
  if (value >= thresholds.bronze) {
    const progress = Math.round(((value - thresholds.bronze) / (thresholds.silver - thresholds.bronze)) * 100)
    return { tier: 'bronze', nextTierValue: thresholds.silver, progress: Math.min(99, progress) }
  }
  const progress = thresholds.bronze > 0 ? Math.round((value / thresholds.bronze) * 100) : 0
  return { tier: null, nextTierValue: thresholds.bronze, progress: Math.min(99, Math.max(0, progress)) }
}

export function computeMilestones(stats: CreatorStats | null): Milestone[] {
  if (!stats) {
    return (Object.keys(MILESTONE_CONFIG) as MilestoneType[]).map(type => ({
      type,
      tier: null,
      label: MILESTONE_CONFIG[type].label,
      icon: MILESTONE_CONFIG[type].icon,
      currentValue: 0,
      nextTierValue: MILESTONE_CONFIG[type].tiers.bronze,
      progress: 0,
    }))
  }

  // Validate streak: if last_active_date is more than 1 day ago, streak is 0
  const effectiveStreak =
    stats.last_active_date && daysDiff(stats.last_active_date) <= 1
      ? stats.current_streak
      : 0

  // Response rate
  const responseRate =
    stats.total_received > 0
      ? (stats.total_answered / stats.total_received) * 100
      : 0

  const values: Record<MilestoneType, { value: number; inverted: boolean; hasData: boolean }> = {
    soldout: { value: stats.soldout_days_last30, inverted: false, hasData: true },
    streak: { value: effectiveStreak, inverted: false, hasData: true },
    fast_responder: { value: stats.avg_response_seconds, inverted: true, hasData: stats.total_answered > 0 },
    total_answered: { value: stats.total_answered, inverted: false, hasData: true },
    response_rate: { value: responseRate, inverted: false, hasData: stats.total_received > 0 },
    marathoner: { value: stats.marathon_count, inverted: false, hasData: true },
  }

  return (Object.keys(MILESTONE_CONFIG) as MilestoneType[]).map(type => {
    const config = MILESTONE_CONFIG[type]
    const { value, inverted, hasData } = values[type]

    if (!hasData) {
      return {
        type,
        tier: null,
        label: config.label,
        icon: config.icon,
        currentValue: 0,
        nextTierValue: config.tiers.bronze,
        progress: 0,
      }
    }

    const { tier, nextTierValue, progress } = computeTierAndProgress(value, config.tiers, inverted)

    return {
      type,
      tier,
      label: config.label,
      icon: config.icon,
      currentValue: value,
      nextTierValue,
      progress,
    }
  })
}

export function formatMilestoneValue(type: MilestoneType, value: number): string {
  switch (type) {
    case 'fast_responder': {
      const hours = Math.round(value / 3600)
      if (hours < 1) return '<1h'
      return `${hours}h`
    }
    case 'response_rate':
      return `${Math.round(value)}%`
    case 'soldout':
    case 'streak':
      return `${value} dias`
    case 'marathoner':
      return value === 1 ? '1 vez' : `${value} vezes`
    case 'total_answered':
      return `${value}`
    default:
      return `${value}`
  }
}

export function getMilestoneDescription(type: MilestoneType, tier: MilestoneTier): string {
  const config = MILESTONE_CONFIG[type]
  if (!tier) return `Ainda não desbloqueado`

  const threshold = config.tiers[tier]

  switch (type) {
    case 'soldout':
      return `Esgotou vagas em ${threshold} dias no último mês`
    case 'streak':
      return `${threshold} dias consecutivos respondendo`
    case 'fast_responder': {
      const h = threshold / 3600
      return `Tempo médio de resposta menor que ${h}h`
    }
    case 'total_answered':
      return `${threshold} perguntas respondidas`
    case 'response_rate':
      return `${threshold}% das perguntas respondidas`
    case 'marathoner':
      return `Respondeu 10+ perguntas em ${threshold} dia${threshold > 1 ? 's' : ''}`
    default:
      return ''
  }
}
