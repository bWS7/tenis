'use client'

import { useRouter } from 'next/navigation'
import { GitCompare, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompareBarProps {
  selectedSlugs: string[]
  onClear: () => void
}

export function CompareBar({ selectedSlugs, onClear }: CompareBarProps) {
  const router = useRouter()

  if (selectedSlugs.length === 0) return null

  function goCompare() {
    router.push(`/tournaments/compare?slugs=${selectedSlugs.join(',')}`)
  }

  return (
    <div className={cn(
      'fixed bottom-20 left-1/2 -translate-x-1/2 z-50',
      'bg-gray-900 text-white rounded-2xl shadow-xl px-4 py-3',
      'flex items-center gap-3 max-w-sm w-[calc(100%-2rem)]',
      'animate-slide-up'
    )}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <GitCompare size={16} className="text-brand-400 shrink-0" />
        <span className="text-sm font-medium">
          {selectedSlugs.length} selecionado{selectedSlugs.length > 1 ? 's' : ''}
        </span>
        {selectedSlugs.length < 2 && (
          <span className="text-xs text-gray-400">Selecione mais 1</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {selectedSlugs.length >= 2 && (
          <button
            onClick={goCompare}
            className="h-8 px-3 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Comparar
          </button>
        )}
        <button
          onClick={onClear}
          className="w-7 h-7 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
