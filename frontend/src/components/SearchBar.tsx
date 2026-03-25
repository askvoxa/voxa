'use client'

import { Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import FounderBadge from '@/components/FounderBadge'

type Creator = {
  username: string
  bio: string | null
  avatar_url: string | null
  min_price: number
  is_founder?: boolean
}

export default function SearchBar() {
  const [busca, setBusca] = useState('')
  const [sugestoes, setSugestoes] = useState<Creator[]>([])
  const [mostraSugestoes, setMostraSugestoes] = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (!busca.trim()) {
      setSugestoes([])
      return
    }

    let isMounted = true

    const buscarCriadores = async () => {
      setCarregando(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('profiles')
          .select('username, bio, avatar_url, min_price, is_founder')
          .eq('is_active', true)
          .ilike('username', `%${busca.replace(/[%_\\]/g, '\\$&')}%`)
          .limit(5)

        if (isMounted) {
          setSugestoes(data ?? [])
          setMostraSugestoes(true)
        }
      } catch (err) {
        if (isMounted) {
          console.error('Erro ao buscar:', err)
          setSugestoes([])
        }
      } finally {
        if (isMounted) {
          setCarregando(false)
        }
      }
    }

    const timer = setTimeout(buscarCriadores, 300)
    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [busca])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const username = busca.toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (username) {
      window.location.href = `/perfil/${username}`
    }
  }

  return (
    <div className="relative max-w-lg mx-auto">
      <form onSubmit={handleSubmit}>
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={busca}
          onChange={e => {
            setBusca(e.target.value)
            setMostraSugestoes(true)
          }}
          onBlur={() => setMostraSugestoes(false)}
          placeholder="Para quem você tem uma pergunta?"
          className="w-full bg-white border border-black/10 rounded-2xl py-4 pl-12 pr-32 text-[#111] placeholder-gray-400 focus:outline-none focus:ring-0 focus:border-[#833ab4]/50 focus:shadow-[0_0_0_4px_rgba(131,58,180,0.08)] transition-all text-sm shadow-sm"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-story text-white text-sm font-bold px-5 py-3 rounded-xl hover:opacity-90 hover:shadow-[0_4px_20px_rgba(131,58,180,0.4)] transition-all duration-200 cursor-pointer"
        >
          Buscar
        </button>
      </form>

      {/* Sugestões dropdown */}
      {mostraSugestoes && busca.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-black/10 rounded-xl shadow-lg overflow-hidden z-50">
          {carregando ? (
            <div className="p-4 text-center text-gray-500 text-sm">Carregando...</div>
          ) : sugestoes.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">Nenhum criador encontrado</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {sugestoes.map(creator => (
                <Link
                  key={creator.username}
                  href={`/perfil/${creator.username}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-black/5 last:border-b-0"
                  onMouseDown={() => setMostraSugestoes(false)}
                >
                  <img
                    src={creator.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.username}`}
                    alt={creator.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#111] text-sm flex items-center gap-1">@{creator.username} <FounderBadge isFounder={!!creator.is_founder} size="sm" /></p>
                    <p className="text-xs text-gray-500 truncate">{creator.bio || 'Criador na VOXA'}</p>
                  </div>
                  <span className="text-xs font-bold text-transparent bg-clip-text bg-gradient-story">R$ {creator.min_price}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
