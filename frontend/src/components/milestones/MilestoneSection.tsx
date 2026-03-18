'use client'

import { Milestone, TIER_COLORS, TIER_LABELS, formatMilestoneValue, getMilestoneDescription } from '@/lib/milestones'

type Props = {
  milestones: Milestone[]
}

export default function MilestoneSection({ milestones }: Props) {
  const earned = milestones.filter(m => m.tier !== null)

  if (earned.length === 0) return null

  return (
    <div className="w-full max-w-2xl mt-10 px-2">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span role="img" aria-label="Troféu">🏆</span>
        Conquistas
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {earned.map(m => (
          <div
            key={m.type}
            className="bg-[#111] rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center border-2 bg-white/5"
                style={{ borderColor: TIER_COLORS[m.tier!] }}
              >
                <span className="text-sm" role="img" aria-label={m.label}>{m.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{m.label}</p>
                <p className="text-[10px] font-semibold" style={{ color: TIER_COLORS[m.tier!] }}>
                  {TIER_LABELS[m.tier!]}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 leading-snug">
              {getMilestoneDescription(m.type, m.tier)}
            </p>
            <p className="text-xs font-bold text-gray-300 mt-1.5">
              {formatMilestoneValue(m.type, m.currentValue)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
