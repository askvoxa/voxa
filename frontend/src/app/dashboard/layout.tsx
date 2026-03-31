'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

type DashboardContextType = {
  username: string
  accountType: string
  dashboardMode: 'fan' | 'creator'
}

const DashboardContext = createContext<DashboardContextType | null>(null)
export function useDashboardContext() { return useContext(DashboardContext) }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [profile, setProfile] = useState<{ username: string; accountType: string } | null>(null)
  const [dashboardMode, setDashboardMode] = useState<'fan' | 'creator'>('fan')
  const [isReady, setIsReady] = useState(false)

  const handleModeChange = (mode: 'fan' | 'creator') => {
    setDashboardMode(mode)
    localStorage.setItem('voxa_dashboard_mode', mode)
  }

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()

      // DEV: Restaurar sessão injetada por testes (Playwright)
      if (typeof window !== 'undefined' && (window as any).__VOXATESTSESSION__) {
        const session = (window as any).__VOXATESTSESSION__
        const { error } = await supabase.auth.setSession(session)
        console.log('[Dashboard] setSession:', error ? `ERRO: ${error.message}` : 'OK')
        delete (window as any).__VOXATESTSESSION__

        // Aguardar um pouco para a sessão ser registrada
        await new Promise(r => setTimeout(r, 100))
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, account_type')
        .eq('id', user.id)
        .single()

      if (!profileData) { router.push('/setup'); return }

      const isInfluencer = profileData.account_type === 'influencer' || profileData.account_type === 'admin'
      const savedMode = localStorage.getItem('voxa_dashboard_mode')

      if (isInfluencer && savedMode === 'creator') {
        setDashboardMode('creator')
      } else if (isInfluencer) {
        setDashboardMode('creator')
        localStorage.setItem('voxa_dashboard_mode', 'creator')
      } else {
        setDashboardMode('fan')
      }

      setProfile({ username: profileData.username, accountType: profileData.account_type })
      setIsReady(true)
    }
    load()
  }, [router])

  const isInfluencer = profile?.accountType === 'influencer' || profile?.accountType === 'admin'

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <DashboardContext.Provider value={{
      username: profile!.username,
      accountType: profile!.accountType,
      dashboardMode,
    }}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header
          username={profile!.username}
          accountType={profile!.accountType}
          dashboardMode={dashboardMode}
          onModeChange={isInfluencer ? handleModeChange : undefined}
        />

        {children}

        <BottomNav
          username={profile!.username}
          accountType={profile!.accountType}
          dashboardMode={dashboardMode}
        />
      </div>
    </DashboardContext.Provider>
  )
}
