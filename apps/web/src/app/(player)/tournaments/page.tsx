'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/navigation'
import { TournamentCard } from '@/components/tournament-card'
import { CompareBar } from '@/components/compare-bar'
import { useTournaments, useWatchlist, usePlayerProfile } from '@/hooks/use-tennis-data'
import { getSportAge } from '@/lib/utils'
import { Search, SlidersHorizontal, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATES = ['SP','RJ','MG','RS','PR','SC','BA','GO','PE','CE','DF','ES','MT','MS']

const STATUS_CHIPS = [
  { label: 'Todos',       value: '' },
  { label: 'Abertas',     value: 'open' },
  { label: 'Compatíveis', value: 'compatible' },
  { label: 'Fechando',    value: 'closing_soon' },
]

export default function TournamentsPage() {
  const [search,       setSearch]        = useState('')
  const [statusFilter, setStatusFilter]  = useState('')
  const [stateFilter,  setStateFilter]   = useState('')
  const [showFilters,  setShowFilters]   = useState(false)
  const [debouncedQ,   setDebouncedQ]    = useState('')
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const apiParams = useMemo(() => {
    const p: Record<string, string> = { limit: '30' }
    if (debouncedQ)  p.q      = debouncedQ
    if (stateFilter) p.state  = stateFilter
    if (statusFilter === 'closing_soon') p.closing = '14'
    else if (statusFilter && statusFilter !== 'compatible') p.status = statusFilter
    return p
  }, [debouncedQ, stateFilter, statusFilter])

  const { tournaments, loading } = useTournaments(apiParams)
  const { watchedIds, toggle }   = useWatchlist()
  const { profile }              = usePlayerProfile()

  function countCompat(categories: any[]): number {
    if (!profile) return 0
    const classCode = profile.categories.find((c: any) => c.taxonomy === 'FPT_CLASS')?.code
    const age = getSportAge(profile.birthYear)
    return categories.filter(cat => {
      if (profile.gender && cat.genderScope && cat.genderScope !== 'Mixed' && cat.genderScope !== profile.gender) return false
      if (cat.classCode && classCode) {
        const pNum = parseInt(classCode), cNum = parseInt(cat.classCode)
        if (!isNaN(pNum) && !isNaN(cNum) && (pNum > cNum + 1 || pNum < cNum)) return false
      }
      if (cat.minAge && cat.ageType === 'exact'   && age < cat.minAge) return false
      if (cat.maxAge && cat.ageType === 'exact'   && age > cat.maxAge) return false
      if (cat.minAge && cat.ageType === 'minimum' && age < cat.minAge) return false
      return true
    }).length
  }

  const displayed = useMemo(() => {
    let list = tournaments.map(t => ({
      ...t,
      isWatched:       watchedIds.has(t.id),
      compatibleCount: countCompat((t as any).categories ?? []),
      isSelected:      selectedSlugs.includes(t.slug),
    }))
    if (statusFilter === 'compatible') list = list.filter(t => t.compatibleCount > 0)
    return list
  }, [tournaments, watchedIds, profile, statusFilter, selectedSlugs])

  const handleSelectToggle = useCallback((id: string) => {
    const t = displayed.find(x => x.id === id)
    if (!t) return
    setSelectedSlugs(prev => {
      if (prev.includes(t.slug)) return prev.filter(s => s !== t.slug)
      if (prev.length >= 3) return prev
      return [...prev, t.slug]
    })
  }, [displayed])

  const hasActiveFilters = statusFilter || stateFilter

  return (
    <div className="animate-fade-in">
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Buscar torneio ou cidade..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 h-10 rounded-xl border border-gray-200 bg-gray-50 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={14} className="text-gray-400" /></button>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={cn('flex items-center gap-1.5 h-10 px-3 rounded-xl border text-sm font-medium transition-colors',
              hasActiveFilters ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-gray-50 border-gray-200 text-gray-600')}>
            <SlidersHorizontal size={15} />
            {hasActiveFilters && <span className="w-4 h-4 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center">{[statusFilter, stateFilter].filter(Boolean).length}</span>}
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {STATUS_CHIPS.map(f => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={cn('shrink-0 px-3 h-7 rounded-full text-xs font-medium border transition-colors',
                statusFilter === f.value ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300')}>
              {f.label}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="animate-slide-down pt-2 space-y-3 border-t border-gray-100">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Estado</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setStateFilter('')} className={cn('px-3 h-7 rounded-full text-xs font-medium border', !stateFilter ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200')}>Todos</button>
                {STATES.map(s => <button key={s} onClick={() => setStateFilter(s)} className={cn('px-3 h-7 rounded-full text-xs font-medium border', stateFilter === s ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-gray-600 border-gray-200')}>{s}</button>)}
              </div>
            </div>
            {hasActiveFilters && <button onClick={() => { setStatusFilter(''); setStateFilter('') }} className="flex items-center gap-1 text-xs text-red-500 font-medium"><X size={12} /> Limpar filtros</button>}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {selectedSlugs.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3 flex items-center justify-between">
            <p className="text-xs text-blue-700 font-medium">
              {selectedSlugs.length} torneio{selectedSlugs.length > 1 ? 's' : ''} selecionado{selectedSlugs.length > 1 ? 's' : ''} para comparar (máx. 3)
            </p>
            <button onClick={() => setSelectedSlugs([])} className="text-xs text-blue-500 hover:underline">Limpar</button>
          </div>
        )}

        <p className="text-xs text-gray-400 mb-3 font-medium">
          {loading ? 'Buscando...' : `${displayed.length} torneio${displayed.length !== 1 ? 's' : ''} encontrado${displayed.length !== 1 ? 's' : ''}`}
          {!loading && <span className="text-gray-300 ml-2">· Ícone <span className="text-brand-400">⊕</span> para comparar</span>}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-brand-400" /></div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Search size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum torneio encontrado</p>
            <p className="text-sm mt-1">Tente ajustar os filtros</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(t => (
              <TournamentCard
                key={t.id}
                tournament={t}
                showEligibility={!!profile}
                onWatchToggle={toggle}
                onSelectToggle={handleSelectToggle}
              />
            ))}
          </div>
        )}
      </div>

      <CompareBar selectedSlugs={selectedSlugs} onClear={() => setSelectedSlugs([])} />
    </div>
  )
}
