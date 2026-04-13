'use client'

import { cn, formatDate, getStatusLabel, isClosingSoon } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { MapPin, Calendar, Clock, Star, GitCompare } from 'lucide-react'
import Link from 'next/link'

export interface TournamentCardData {
  id: string
  slug: string
  name: string
  organizationName: string
  organizationShortName?: string | null
  venueCity?: string | null
  venueState?: string | null
  startAt?: string | Date | null
  endAt?: string | Date | null
  entryCloseAt?: string | Date | null
  status: string
  categoriesCount: number
  compatibleCount: number
  isWatched?: boolean
  modalidade?: string
  isSelected?: boolean
}

interface TournamentCardProps {
  tournament: TournamentCardData
  showEligibility?: boolean
  className?: string
  onWatchToggle?: (id: string) => void
  onSelectToggle?: (id: string) => void
}

export function TournamentCard({ tournament, showEligibility = true, className, onWatchToggle, onSelectToggle }: TournamentCardProps) {
  const closing       = tournament.entryCloseAt ? isClosingSoon(tournament.entryCloseAt, 7) : false
  const hasCompatible = tournament.compatibleCount > 0

  return (
    <div className={cn(
      'group relative flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm border transition-all duration-200 active:scale-[0.99]',
      tournament.isSelected ? 'border-brand-400 ring-2 ring-brand-200' : 'border-gray-100 hover:border-brand-200 hover:shadow-md',
      className
    )}>
      <Link href={`/tournaments/${tournament.slug}`} className="flex flex-col gap-3">
        {/* Header */}
        <div className="pr-14 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{tournament.organizationShortName ?? tournament.organizationName}</span>
            {closing && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                <Clock size={10} /> Encerra em breve
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 leading-tight line-clamp-2 group-hover:text-brand-700 transition-colors">{tournament.name}</h3>
        </div>

        {/* Info */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
          {(tournament.venueCity || tournament.venueState) && (
            <span className="flex items-center gap-1"><MapPin size={13} className="text-gray-400" />{[tournament.venueCity, tournament.venueState].filter(Boolean).join(', ')}</span>
          )}
          {tournament.startAt && (
            <span className="flex items-center gap-1"><Calendar size={13} className="text-gray-400" />{formatDate(tournament.startAt)}{tournament.endAt && ` – ${formatDate(tournament.endAt)}`}</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-50">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={tournament.status === 'open' ? 'open' : tournament.status === 'closing_soon' ? 'closing' : tournament.status === 'closed' ? 'closed' : tournament.status === 'canceled' ? 'canceled' : 'default'}>
              {getStatusLabel(tournament.status)}
            </Badge>
            {showEligibility && tournament.categoriesCount > 0 && (
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border',
                hasCompatible ? 'text-brand-600 bg-brand-50 border-brand-200' : 'text-gray-400 bg-gray-50 border-gray-200'
              )}>
                {hasCompatible ? `${tournament.compatibleCount} compatível${tournament.compatibleCount > 1 ? 'is' : ''}` : 'Sem compatíveis'}
              </span>
            )}
          </div>
          {tournament.entryCloseAt && <span className="text-xs text-gray-400 shrink-0">Prazo: {formatDate(tournament.entryCloseAt)}</span>}
        </div>
      </Link>

      {/* Ações - fora do link */}
      <div className="absolute right-3 top-3 flex items-center gap-1">
        {onSelectToggle && (
          <button onClick={e => { e.preventDefault(); onSelectToggle(tournament.id) }}
            className={cn('rounded-full p-1.5 transition-colors', tournament.isSelected ? 'text-brand-500 bg-brand-100' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50')}
            title="Selecionar para comparar">
            <GitCompare size={13} />
          </button>
        )}
        {onWatchToggle && (
          <button onClick={e => { e.preventDefault(); onWatchToggle(tournament.id) }}
            className={cn('rounded-full p-1.5 transition-colors', tournament.isWatched ? 'text-brand-500 bg-brand-50' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50')}
            title={tournament.isWatched ? 'Remover da watchlist' : 'Salvar'}>
            <Star size={13} className={tournament.isWatched ? 'fill-current' : ''} />
          </button>
        )}
      </div>
    </div>
  )
}
