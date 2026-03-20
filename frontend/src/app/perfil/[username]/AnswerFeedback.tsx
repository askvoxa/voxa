'use client'

import { useState, useEffect } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'

type Props = {
  answerId: string
}

type VoteState = 1 | -1 | null

const STORAGE_KEY = 'voxa_answer_votes'

function getStoredVotes(): Record<string, VoteState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setStoredVote(answerId: string, vote: VoteState) {
  try {
    const votes = getStoredVotes()
    if (vote === null) {
      delete votes[answerId]
    } else {
      votes[answerId] = vote
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(votes))
  } catch {
    // localStorage indisponível — falha silenciosa
  }
}

// Contador mockado — será substituído por query real quando o banco estiver pronto
// Gera um número estável baseado no answerId para parecer real
function getMockScore(answerId: string): number {
  let hash = 0
  for (let i = 0; i < answerId.length; i++) {
    hash = (hash * 31 + answerId.charCodeAt(i)) & 0xffff
  }
  return (hash % 20) + 1 // valor entre 1 e 20
}

export default function AnswerFeedback({ answerId }: Props) {
  const [vote, setVote] = useState<VoteState>(null)
  const [score, setScore] = useState<number>(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Carrega voto salvo e score base
    const stored = getStoredVotes()
    const storedVote = (stored[answerId] ?? null) as VoteState
    const baseScore = getMockScore(answerId)

    setVote(storedVote)
    // Ajusta score baseado no voto já dado
    setScore(baseScore + (storedVote ?? 0))
    setMounted(true)
  }, [answerId])

  const handleVote = (newVote: 1 | -1) => {
    const baseScore = getMockScore(answerId)

    if (vote === newVote) {
      // Desfaz o voto
      setVote(null)
      setScore(baseScore)
      setStoredVote(answerId, null)
    } else {
      // Aplica novo voto
      setVote(newVote)
      setScore(baseScore + newVote)
      setStoredVote(answerId, newVote)
    }
  }

  // Evita hydration mismatch — não renderiza antes do cliente
  if (!mounted) return null

  return (
    <div className="flex items-center gap-3 justify-end mt-3">
      <button
        type="button"
        onClick={() => handleVote(1)}
        title="Útil"
        className={`flex items-center justify-center gap-1.5 px-4 min-h-[44px] min-w-[44px] rounded-full border text-xs font-medium transition-all cursor-pointer ${
          vote === 1
            ? 'bg-[#16A34A]/15 border-green-500/40 text-green-400'
            : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
        }`}
      >
        <ThumbsUp className="w-3.5 h-3.5" />
        <span className={vote === 1 ? 'text-green-400' : 'text-gray-500'}>
          {score > 0 ? score : ''}
        </span>
      </button>

      <button
        type="button"
        onClick={() => handleVote(-1)}
        title="Não útil"
        className={`flex items-center justify-center gap-1.5 px-4 min-h-[44px] min-w-[44px] rounded-full border text-xs font-medium transition-all cursor-pointer ${
          vote === -1
            ? 'bg-red-500/15 border-red-500/40 text-red-400'
            : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'
        }`}
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
