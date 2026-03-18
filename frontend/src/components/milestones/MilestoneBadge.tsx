'use client'

import { MilestoneType, MilestoneTier, TIER_COLORS, TIER_LABELS } from '@/lib/milestones'
import { useState } from 'react'

type Props = {
  type: MilestoneType
  tier: MilestoneTier
  icon: string
  label: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: { container: 'w-7 h-7', text: 'text-xs', tooltip: 'text-[10px]' },
  md: { container: 'w-9 h-9', text: 'text-sm', tooltip: 'text-xs' },
  lg: { container: 'w-11 h-11', text: 'text-base', tooltip: 'text-xs' },
}

export default function MilestoneBadge({ tier, icon, label, size = 'md' }: Props) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (!tier) return null

  const color = TIER_COLORS[tier]
  const s = SIZES[size]

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`${s.container} rounded-full flex items-center justify-center border-2 bg-white/5 backdrop-blur-sm cursor-default`}
        style={{ borderColor: color }}
      >
        <span className={s.text} role="img" aria-label={label}>{icon}</span>
      </div>

      {showTooltip && (
        <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg bg-gray-900 text-white whitespace-nowrap z-50 pointer-events-none ${s.tooltip}`}>
          <span className="font-semibold">{label}</span>
          <span className="mx-1">·</span>
          <span style={{ color }}>{TIER_LABELS[tier]}</span>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  )
}
