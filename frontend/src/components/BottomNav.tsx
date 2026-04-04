'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, User, Clock, Settings, MessageSquare, Receipt, Wallet } from 'lucide-react'

type BottomNavProps = {
  accountType?: string
  dashboardMode?: 'fan' | 'creator'
}

export default function BottomNav({ accountType = 'fan', dashboardMode = 'fan' }: BottomNavProps) {
  const pathname = usePathname()

  const isFanMode = accountType === 'fan' || dashboardMode === 'fan'

  const navItems = isFanMode
    ? [
        { name: 'Início', href: '/dashboard', icon: Home },
        { name: 'Histórico', href: '/dashboard/questions', icon: MessageSquare },
        { name: 'Gastos', href: '/dashboard/spending', icon: Receipt },
        { name: 'Configurações', href: '/dashboard/profile', icon: User },
      ]
    : [
        { name: 'Início', href: '/dashboard', icon: Home },
        { name: 'Histórico', href: '/dashboard/history', icon: Clock },
        { name: 'Saques', href: '/dashboard/payouts', icon: Wallet },
        { name: 'Config', href: '/dashboard/settings', icon: Settings },
      ]

  return (
    <>
      {/* Spacer to prevent content from being hidden behind the bottom nav */}
      <div className="h-20 md:hidden" />

      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-200 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}
      >
        <div className="flex justify-around items-center h-16 pointer-events-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full min-h-[44px] min-w-[44px] select-none ${
                  isActive ? 'text-[#DD2A7B]' : 'text-gray-500 hover:text-gray-600'
                } transition-colors`}
              >
                <Icon className={`w-6 h-6 mb-1 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
