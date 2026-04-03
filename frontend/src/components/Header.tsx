'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DashboardModeToggle from './DashboardModeToggle'

type HeaderProps = {
  hideDesktopNav?: boolean
  accountType?: string
  dashboardMode?: 'fan' | 'creator'
  onModeChange?: (mode: 'fan' | 'creator') => void
}

export default function Header({ hideDesktopNav = false, accountType, dashboardMode, onModeChange }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()

  const isInfluencer = accountType === 'influencer' || accountType === 'admin'
  const isFanMode = !isInfluencer || dashboardMode === 'fan'

  const navItems = isFanMode
    ? [
        { name: 'Dashboard', path: '/dashboard' },
        { name: 'Perguntas', path: '/dashboard/questions' },
        { name: 'Gastos', path: '/dashboard/spending' },
        { name: 'Perfil', path: '/dashboard/profile' },
      ]
    : [
        { name: 'Dashboard', path: '/dashboard' },
        { name: 'Histórico', path: '/dashboard/history' },
        { name: 'Saques', path: '/dashboard/payouts' },
        { name: 'Configurações', path: '/dashboard/settings' },
      ]

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 lg:px-0 h-16 flex justify-between items-center">
        {/* Logo + Mode Toggle */}
        <div className="flex items-center gap-3">
          <Link href="/" className="font-bold text-xl text-transparent bg-clip-text bg-gradient-instagram">
            VOXA
          </Link>
          {isInfluencer && dashboardMode && onModeChange && (
            <DashboardModeToggle mode={dashboardMode} onModeChange={onModeChange} />
          )}
        </div>

        {/* Desktop Navigation */}
        {!hideDesktopNav && (
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.path
              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`text-sm tracking-wide font-medium transition-colors ${
                    isActive ? 'text-[#DD2A7B] font-bold' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {item.name}
                </Link>
              )
            })}
          </nav>
        )}

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleLogout}
            className="text-gray-500 hover:text-red-500 transition-colors p-2 md:p-0"
            aria-label="Sair da conta"
            title="Sair"
          >
            <LogOut className="w-5 h-5 md:w-4 md:h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
