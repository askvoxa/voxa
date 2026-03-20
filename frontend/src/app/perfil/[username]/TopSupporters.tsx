import { generatePseudonym, formatBRL, SupporterRow } from '@/lib/supporters'

type Props = {
  supporters: SupporterRow[]
}

export default function TopSupporters({ supporters }: Props) {
  // Don't render if no supporters this month
  if (!supporters || supporters.length === 0) {
    return null
  }

  const MEDALS = ['🥇', '🥈', '🥉']
  const MEDAL_COLORS = ['border-yellow-500/30', 'border-gray-400/30', 'border-orange-400/30']

  return (
    <section className="w-full max-w-2xl mt-10 px-4 md:px-0">
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        👑 Top Apoiadores do Mês
      </h2>

      {/* Podium: positions 1-3 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {supporters.slice(0, 3).map((supporter, index) => {
          const displayName = supporter.is_anonymous
            ? generatePseudonym(supporter.email_hash)
            : supporter.display_name

          return (
            <div
              key={index}
              className={`bg-[#111] rounded-2xl p-4 border ${MEDAL_COLORS[index]} hover:border-white/10 transition-colors text-center relative overflow-hidden`}
            >
              {/* Medal emoji in a circle */}
              <div className="flex justify-center mb-2">
                <span className="text-2xl">{MEDALS[index]}</span>
              </div>

              {/* Supporter name */}
              <p className="text-xs font-bold text-white truncate break-words">{displayName}</p>

              {/* Anonymous label */}
              {supporter.is_anonymous && (
                <p className="text-[10px] text-gray-500 mt-0.5">(anônimo)</p>
              )}

              {/* Amount with gradient */}
              <p className="text-xs font-bold text-transparent bg-clip-text bg-gradient-instagram mt-2">
                {formatBRL(supporter.total_paid)}
              </p>
            </div>
          )
        })}
      </div>

      {/* List: positions 4-5 */}
      {supporters.length > 3 && (
        <div className="space-y-2">
          {supporters.slice(3).map((supporter, index) => {
            const displayName = supporter.is_anonymous
              ? generatePseudonym(supporter.email_hash)
              : supporter.display_name
            const position = index + 4

            return (
              <div
                key={index}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#111] border border-white/5 hover:border-white/10 transition-colors"
              >
                {/* Position number */}
                <span className="text-gray-600 font-bold text-sm w-5">{position}</span>

                {/* Name column */}
                <div className="flex-1 px-3">
                  <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                  {supporter.is_anonymous && (
                    <p className="text-[10px] text-gray-500 mt-0.5">(anônimo)</p>
                  )}
                </div>

                {/* Amount badge */}
                <span className="text-xs font-semibold text-green-400 bg-[#16A34A]/10 border border-green-500/20 px-2.5 py-1 rounded-lg whitespace-nowrap">
                  {formatBRL(supporter.total_paid)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
