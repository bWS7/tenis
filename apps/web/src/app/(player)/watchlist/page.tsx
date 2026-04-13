'use client'

import { TopBar } from '@/components/navigation'
import { TournamentCard } from '@/components/tournament-card'
import { useWatchlist } from '@/hooks/use-tennis-data'
import { Star, Archive, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pretendo:           { label: 'Pretendo jogar',   color: 'text-blue-600 bg-blue-50 border-blue-200' },
  inscrito_declarado: { label: 'Inscrito',          color: 'text-brand-600 bg-brand-50 border-brand-200' },
  desisti:            { label: 'Desisti',           color: 'text-gray-500 bg-gray-50 border-gray-200' },
  concluido:          { label: 'Concluído',         color: 'text-purple-600 bg-purple-50 border-purple-200' },
}

const TABS = [
  { id: 'ativos',    label: 'Ativos',    icon: Star },
  { id: 'historico', label: 'Histórico', icon: Archive },
]

export default function WatchlistPage() {
  const { items, loading, toggle, updateStatus } = useWatchlist()
  const [activeTab, setActiveTab] = useState('ativos')

  const ativos    = items.filter(i => i.userStatus !== 'concluido' && i.userStatus !== 'desisti')
  const historico = items.filter(i => i.userStatus === 'concluido' || i.userStatus === 'desisti')
  const list      = activeTab === 'ativos' ? ativos : historico

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Minha Agenda"
        subtitle={loading ? 'Carregando...' : `${ativos.length} torneio${ativos.length !== 1 ? 's' : ''} acompanhado${ativos.length !== 1 ? 's' : ''}`}
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-4 bg-white">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            )}>
            <tab.icon size={14} />
            {tab.label}
            {tab.id === 'ativos' && ativos.length > 0 && (
              <span className="bg-brand-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{ativos.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-brand-400" /></div>
        ) : list.length === 0 ? (
          <div className="text-center py-20">
            <Star size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="font-semibold text-gray-400">
              {activeTab === 'ativos' ? 'Nenhum torneio salvo' : 'Sem histórico ainda'}
            </p>
            <p className="text-sm text-gray-300 mt-1">Explore torneios e clique na ⭐ para acompanhar</p>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map(item => {
              const statusInfo = STATUS_LABELS[item.userStatus] ?? STATUS_LABELS.pretendo
              const cardData = { ...item.tournament, isWatched: true }
              return (
                <div key={item.id} className="space-y-2">
                  <TournamentCard tournament={cardData} showEligibility={false} onWatchToggle={() => toggle(item.tournament.id)} />
                  <div className="flex items-center justify-between px-1">
                    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-full border', statusInfo.color)}>
                      {statusInfo.label}
                    </span>
                    <select
                      value={item.userStatus}
                      onChange={e => updateStatus(item.id, e.target.value)}
                      className="text-xs text-gray-500 bg-transparent border-none outline-none cursor-pointer"
                    >
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
