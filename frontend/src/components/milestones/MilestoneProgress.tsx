'use client'

import { Milestone, TIER_COLORS, TIER_LABELS, formatMilestoneValue, getMilestoneDescription } from '@/lib/milestones'

type Props = {
  milestones: Milestone[]
}

export default function MilestoneProgress({ milestones }: Props) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4">
        Conquistas
      </h3>
      <div className="space-y-4">
        {milestones.map(m => {
          const tierColor = m.tier ? TIER_COLORS[m.tier] : '#9CA3AF'
          const nextLabel = m.tier
            ? m.nextTierValue !== null
              ? `Próximo: ${TIER_LABELS[m.tier === 'bronze' ? 'silver' : 'gold']}`
              : 'Nível máximo!'
            : `Faltam ${m.nextTierValue !== null ? formatMilestoneValue(m.type, m.nextTierValue) : ''}`

          return (
            <div key={m.type}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm" role="img" aria-label={m.label}>{m.icon}</span>
                  <span className="text-sm font-semibold text-gray-800">{m.label}</span>
                  {m.tier && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ color: tierColor, backgroundColor: `${tierColor}15` }}
                    >
                      {TIER_LABELS[m.tier]}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 font-medium">
                  {m.currentValue > 0 ? formatMilestoneValue(m.type, m.currentValue) : '—'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${m.progress}%`,
                    background: m.tier
                      ? `linear-gradient(90deg, ${tierColor}, ${tierColor}CC)`
                      : 'linear-gradient(90deg, #DD2A7B, #F77737)',
                  }}
                />
              </div>

              <p className="text-[10px] text-gray-400 mt-1">
                {m.tier ? getMilestoneDescription(m.type, m.tier) : nextLabel}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
