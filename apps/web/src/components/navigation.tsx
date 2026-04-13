'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Star, Bell, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/home',      label: 'Início',   icon: Home },
  { href: '/tournaments', label: 'Torneios', icon: Search },
  { href: '/watchlist', label: 'Agenda',   icon: Star },
  { href: '/alerts',    label: 'Alertas',  icon: Bell },
  { href: '/profile',   label: 'Perfil',   icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 safe-area-pb">
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 px-3 flex-1',
                'text-xs font-medium transition-colors',
                active ? 'text-brand-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.75}
                className={cn('transition-transform', active && 'scale-105')}
              />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export function TopBar({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div>
          <h1 className="font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  )
}
