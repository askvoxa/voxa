'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, User, Clock, Settings } from 'lucide-react'

type BottomNavProps = {
  username: string;
}

export default function BottomNav({ username }: BottomNavProps) {
  const pathname = usePathname()

  const navItems = [
    { name: 'Início', href: '/dashboard', icon: Home },
    { name: 'Histórico', href: '/dashboard/history', icon: Clock },
    { name: 'Perfil', href: `/perfil/${username}`, icon: User },
    { name: 'Configurações', href: '/dashboard/settings', icon: Settings },
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
