'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Mail, CheckCircle2, ShieldCheck, Flag, Settings, LogOut, Wallet } from 'lucide-react'

export default function AdminBottomNav() {
  const pathname = usePathname()

  const navItems = [
    { name: 'Geral', href: '/admin', icon: LayoutDashboard },
    { name: 'Aprovações', href: '/admin/approvals', icon: CheckCircle2 },
    { name: 'Usuários', href: '/admin/users', icon: Users },
    { name: 'Convites', href: '/admin/invites', icon: Mail },
    { name: 'Verificar', href: '/admin/verifications', icon: ShieldCheck },
    { name: 'Denúncias', href: '/admin/reports', icon: Flag },
    { name: 'Payouts', href: '/admin/payouts', icon: Wallet },
    { name: 'Sair', href: '/dashboard', icon: LogOut },
  ]

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200 flex items-center justify-around px-2 pt-2 z-50"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 20px) + 8px)' }}
    >
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center w-16 min-h-[44px] gap-1 transition-colors ${
              isActive ? 'text-[#dd2a7b]' : 'text-gray-500 hover:text-gray-600'
            }`}
          >
            <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className="text-[10px] font-medium">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
