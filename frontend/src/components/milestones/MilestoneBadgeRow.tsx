'use client'

import { Milestone } from '@/lib/milestones'
import MilestoneBadge from './MilestoneBadge'

type Props = {
  milestones: Milestone[]
  size?: 'sm' | 'md' | 'lg'
  maxVisible?: number
}

export default function MilestoneBadgeRow({ milestones, size = 'sm', maxVisible }: Props) {
  const earned = milestones.filter(m => m.tier !== null)

  if (earned.length === 0) return null

  // Sort: gold first, then silver, then bronze
  const tierOrder = { gold: 0, silver: 1, bronze: 2 }
  const sorted = [...earned].sort((a, b) => tierOrder[a.tier!] - tierOrder[b.tier!])
  const visible = maxVisible ? sorted.slice(0, maxVisible) : sorted
  const remaining = maxVisible ? sorted.length - maxVisible : 0

  return (
    <div className="flex items-center gap-1">
      {visible.map(m => (
        <MilestoneBadge
          key={m.type}
          type={m.type}
          tier={m.tier}
          icon={m.icon}
          label={m.label}
          size={size}
        />
      ))}
      {remaining > 0 && (
        <span className="text-[10px] text-gray-500 font-medium ml-0.5">+{remaining}</span>
      )}
    </div>
  )
}
