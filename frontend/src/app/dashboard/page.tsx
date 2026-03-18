'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import QuestionList from './QuestionList'
import { CREATOR_NET_RATE } from '@/lib/constants'

type Question = {
  id: string
  sender_name: string
  content: string
  price_paid: number
  service_type: string
  is_shareable: boolean
  is_anonymous: boolean
  created_at: string
  status: string
}

type Profile = {
  id: string
  username: string
  avatar_url: string | null
  min_price: number
  daily_limit: number
  questions_answered_today: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, min_price, daily_limit, questions_answered_today')
        .eq('id', user.id)
        .single()

      if (!profileData) { router.push('/setup'); return }
      setProfile(profileData)

      const { data: questionsData } = await supabase
        .from('questions')
        .select('id, sender_name, content, price_paid, service_type, is_shareable, is_anonymous, created_at, status')
        .eq('creator_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)

      setQuestions(questionsData ?? [])
      setIsLoading(false)
    }
    load()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="h-6 w-16 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-16 w-full bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ))}
        </main>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <p className="text-gray-500 text-lg">Perfil não encontrado.</p>
          <p className="text-gray-400 text-sm">Você precisa configurar seu perfil de criador primeiro.</p>
          <a href="/setup" className="inline-block bg-gradient-instagram text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
            Configurar perfil
          </a>
        </div>
      </div>
    )
  }

  const pendingEarnings = questions.reduce((sum, q) => sum + Number(q.price_paid), 0)
  const questionsLeft = Math.max(0, profile.daily_limit - profile.questions_answered_today)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-xl text-gradient-instagram">VOXA</h1>
          </div>
          <div className="flex items-center gap-4">
            <a href={`/perfil/${profile.username}`} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Meu perfil
            </a>
            <a href="/dashboard/history" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Histórico
            </a>
            <a href="/dashboard/settings" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Configurações
            </a>
            <button
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                router.push('/')
              }}
              className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
              aria-label="Sair da conta"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Pendentes</p>
            <p className="text-2xl font-bold text-gray-800">{questions.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">A receber</p>
            <p className="text-2xl font-bold text-green-600">
              R$ {(pendingEarnings * CREATOR_NET_RATE).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">líquido após taxa Voxa (10%)</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Vagas hoje</p>
            <p className="text-2xl font-bold text-gray-800">{questionsLeft}<span className="text-sm text-gray-400 font-normal">/{profile.daily_limit}</span></p>
          </div>
        </div>

        {/* Questions */}
        <QuestionList
          questions={questions}
          creatorUsername={profile.username}
          creatorId={profile.id}
        />
      </main>
    </div>
  )
}
