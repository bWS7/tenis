'use client'

import { TopBar } from '@/components/navigation'
import { useAlerts } from '@/hooks/use-tennis-data'
import { Bell, Clock, AlertTriangle, CheckCircle2, Loader2, CheckCheck } from 'lucide-react'
import { cn, formatRelative } from '@/lib/utils'
import Link from 'next/link'

const TYPE_CONFIG: Record<string, { icon: any; color: string }> = {
  deadline_reminder: { icon: Clock,         color: 'text-amber-500 bg-amber-50 border-amber-100' },
  status_changed:    { icon: CheckCircle2,  color: 'text-brand-500 bg-brand-50 border-brand-100' },
  draws_published:   { icon: CheckCircle2,  color: 'text-blue-500 bg-blue-50 border-blue-100' },
  canceled:          { icon: AlertTriangle, color: 'text-red-500 bg-red-50 border-red-100' },
  default:           { icon: Bell,          color: 'text-gray-400 bg-gray-50 border-gray-100' },
}

export default function AlertsPage() {
  const { items, unreadCount, loading, markRead } = useAlerts()

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Alertas"
        subtitle={unreadCount > 0 ? `${unreadCount} não lido${unreadCount > 1 ? 's' : ''}` : 'Tudo em dia'}
        action={
          unreadCount > 0 ? (
            <button onClick={() => markRead()}
              className="flex items-center gap-1 text-xs text-brand-600 font-medium">
              <CheckCheck size={14} /> Marcar tudo
            </button>
          ) : undefined
        }
      />

      <div className="px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-brand-400" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-20">
            <Bell size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="font-semibold text-gray-400">Nenhum alerta ainda</p>
            <p className="text-sm text-gray-300 mt-1">Salve torneios na watchlist para receber notificações</p>
          </div>
        ) : (
          items.map(alert => {
            const config = TYPE_CONFIG[alert.type] ?? TYPE_CONFIG.default
            const Icon   = config.icon
            const isRead = !!alert.readAt

            return (
              <div key={alert.id}
                onClick={() => !isRead && markRead(alert.id)}
                className={cn('flex gap-3 p-4 rounded-xl border transition-colors cursor-pointer',
                  isRead ? 'bg-white border-gray-100' : 'bg-white border-gray-200 shadow-sm hover:border-brand-200'
                )}>
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center border shrink-0', config.color)}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/tournaments/${alert.tournament.slug}`}
                      className={cn('text-xs font-semibold truncate hover:underline', isRead ? 'text-gray-500' : 'text-gray-800')}>
                      {alert.tournament.name}
                    </Link>
                    {!isRead && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1" />}
                  </div>
                  <p className={cn('text-sm mt-0.5 leading-snug', isRead ? 'text-gray-400' : 'text-gray-600')}>
                    {alert.subject}
                  </p>
                  <p className="text-xs text-gray-300 mt-1.5">{formatRelative(alert.createdAt)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
