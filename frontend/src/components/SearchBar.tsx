'use client'

import { Search } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Creator = {
  username: string
  bio: string | null
  avatar_url: string | null
  min_price: number
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
          .select('username, bio, avatar_url, min_price')
          .eq('is_active', true)
          .ilike('username', `%${busca}%`)
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
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
        <input
          type="text"
          value={busca}
          onChange={e => {
            setBusca(e.target.value)
            setMostraSugestoes(true)
          }}
          onBlur={() => setMostraSugestoes(false)}
          placeholder="Para quem você tem uma pergunta?"
          className="w-full bg-[#12121A] border border-white/10 rounded-xl py-4 pl-12 pr-32 text-[#F9FAFB] placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 focus:border-[#7C3AED]/60 transition-all duration-200 text-sm"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold px-4 py-3 rounded-xl transition-all duration-200 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] cursor-pointer"
        >
          Buscar
        </button>
      </form>

      {/* Sugestões dropdown */}
      {mostraSugestoes && busca.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#12121A] border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden z-50">
          {carregando ? (
            <div className="p-4 text-center text-[#9CA3AF] text-sm">Carregando...</div>
          ) : sugestoes.length === 0 ? (
            <div className="p-4 text-center text-[#9CA3AF] text-sm">Nenhum criador encontrado</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {sugestoes.map(creator => (
                <Link
                  key={creator.username}
                  href={`/perfil/${creator.username}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#16161F] transition-colors border-b border-white/5 last:border-b-0"
                  onMouseDown={() => setMostraSugestoes(false)}
                >
                  <img
                    src={creator.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.username}`}
                    alt={creator.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#F9FAFB] text-sm">@{creator.username}</p>
                    <p className="text-xs text-[#9CA3AF] truncate">{creator.bio || 'Criador na VOXA'}</p>
                  </div>
                  <span className="text-xs font-bold text-[#7C3AED]">R$ {creator.min_price}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
