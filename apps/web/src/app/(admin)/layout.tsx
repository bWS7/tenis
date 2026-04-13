import { requireAdmin } from '@/lib/auth'
import Link from 'next/link'
import { LayoutDashboard, Trophy, Database, Activity, Settings } from 'lucide-react'

const navItems = [
  { href: '/admin',              label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/admin/tournaments',  label: 'Torneios',   icon: Trophy },
  { href: '/admin/sources',      label: 'Fontes',     icon: Database },
  { href: '/admin/ingestion-runs', label: 'Jobs',     icon: Activity },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col shrink-0">
        <div className="px-4 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎾</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">Tennis Hub</p>
              <p className="text-xs text-gray-400">Admin</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {navItems.map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors">
              <item.icon size={16} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <Link href="/home" className="text-xs text-gray-400 hover:text-gray-600">
            ← Voltar ao app
          </Link>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
