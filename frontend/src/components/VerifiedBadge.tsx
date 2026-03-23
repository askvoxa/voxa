type Props = {
  isVerified: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export default function VerifiedBadge({ isVerified, size = 'md', className = '' }: Props) {
  if (!isVerified) return null

  return (
    <svg
      className={`inline-block shrink-0 ${sizeMap[size]} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Verificado"
      role="img"
    >
      {/* Instagram-style starburst/shield */}
      <path
        d="M12 1.5l2.61 3.098 3.98-.607-.607 3.98L21.08 10.58l-2.49 3.2.607 3.98-3.98-.607L12 22.5l-2.61-3.098-3.98.607.607-3.98L2.92 13.42l2.49-3.2-.607-3.98 3.98.607L12 1.5z"
        fill="#1D9BF0"
      />
      <path
        d="M9.5 12.5L11 14L15 10"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
