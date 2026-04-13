'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle2, XCircle, HelpCircle,
  ExternalLink, AlertTriangle, Loader2, X, Plus
} from 'lucide-react'
import { cn, formatDate, getStatusLabel } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

function CompareContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [data,      setData]      = useState<any>(null)
  const [loading,   setLoading]   = useState(false)
  const [slugInput, setSlugInput] = useState('')

  const slugs = (searchParams.get('slugs') ?? '').split(',').filter(Boolean)

  useEffect(() => {
    if (slugs.length < 2) { setData(null); return }
    setLoading(true)
    fetch(`/api/tournaments/compare?slugs=${slugs.join(',')}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [searchParams.get('slugs')])

  function removeSlug(slug: string) {
    const next = slugs.filter(s => s !== slug)
    router.push(next.length > 0 ? `/tournaments/compare?slugs=${next.join(',')}` : '/tournaments/compare')
    setData(null)
  }

  function addSlug() {
    const trimmed = slugInput.trim()
    if (!trimmed || slugs.includes(trimmed) || slugs.length >= 3) return
    router.push(`/tournaments/compare?slugs=${[...slugs, trimmed].join(',')}`)
    setSlugInput('')
    setData(null)
  }

  const tournaments: any[] = data?.tournaments?.filter((t: any) => !t.error) ?? []
  const conflicts:   any[] = data?.dateConflicts ?? []

  return (
    <div className="animate-fade-in pb-8">
      {/* Header fixo */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/tournaments" className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Torneios</span>
          </Link>
          <h1 className="font-bold text-gray-900 text-sm">Comparar torneios</h1>
          <span className="text-xs text-gray-400 ml-auto">máx. 3</span>
        </div>

        {/* Chips dos slugs selecionados + campo de adição */}
        <div className="flex gap-2 flex-wrap items-center">
          {slugs.map(slug => (
            <div key={slug} className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 text-brand-700 text-xs font-medium px-2.5 py-1 rounded-full">
              <span className="truncate max-w-[140px]">{slug}</span>
              <button onClick={() => removeSlug(slug)} className="text-brand-400 hover:text-brand-700 transition-colors">
                <X size={11} />
              </button>
            </div>
          ))}
          {slugs.length < 3 && (
            <div className="flex items-center gap-1.5">
              <input
                value={slugInput}
                onChange={e => setSlugInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSlug()}
                placeholder="slug do torneio..."
                className="h-7 px-2.5 rounded-full border border-dashed border-gray-300 text-xs focus:outline-none focus:border-brand-400 w-36"
              />
              <button
                onClick={addSlug}
                disabled={!slugInput.trim()}
                className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 disabled:opacity-40 transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Estado vazio */}
        {slugs.length < 2 && !loading && (
          <div className="text-center py-20 text-gray-400">
            <p className="font-medium text-gray-600">Adicione ao menos 2 torneios para comparar</p>
            <p className="text-sm mt-2">Cole o slug de cada torneio no campo acima</p>
            <p className="text-xs mt-3 text-gray-300 font-mono">Ex: fpt-abc-open-2026</p>
            <Link href="/tournaments" className="inline-flex mt-6 text-sm text-brand-600 font-medium hover:underline">
              ← Explorar torneios
            </Link>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-brand-400" />
          </div>
        )}

        {/* Conflitos de data */}
        {conflicts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">⚠️ Conflito de datas detectado</p>
              {conflicts.map((c, i) => (
                <p key={i} className="text-xs text-amber-600 mt-1">{c.reason}</p>
              ))}
            </div>
          </div>
        )}

        {/* Grade de comparação */}
        {tournaments.length >= 2 && !loading && (
          <div className="space-y-6">

            {/* Cabeçalho dos torneios */}
            <div className={cn('grid gap-3', tournaments.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
              {tournaments.map((t: any) => (
                <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{t.organizationShortName}</p>
                  <p className="font-bold text-gray-900 text-sm leading-tight">{t.name}</p>
                  <Badge variant={t.status === 'open' ? 'open' : t.status === 'canceled' ? 'canceled' : 'default'} className="text-xs">
                    {getStatusLabel(t.status)}
                  </Badge>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>📍 {[t.venueCity, t.venueState].filter(Boolean).join(', ') || '—'}</p>
                    <p>📅 {formatDate(t.startAt)} – {formatDate(t.endAt)}</p>
                    {t.entryCloseAt && <p className={cn('font-medium', new Date(t.entryCloseAt) < new Date(Date.now() + 7*86400000) ? 'text-amber-600' : '')}>⏰ {formatDate(t.entryCloseAt, 'dd/MM HH:mm')}</p>}
                  </div>
                  <div className="pt-1 border-t border-gray-50">
                    {t.totalCompatible > 0
                      ? <span className="text-xs font-semibold text-brand-600 flex items-center gap-1"><CheckCircle2 size={11} />{t.totalCompatible} de {t.totalCategories} compatíveis</span>
                      : <span className="text-xs text-gray-400">Sem categorias compatíveis</span>
                    }
                  </div>
                  {t.officialRegUrl && (
                    <a href={t.officialRegUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-brand-600 font-medium hover:underline transition-colors">
                      <ExternalLink size={10} /> Inscrição oficial
                    </a>
                  )}
                </div>
              ))}
            </div>

            {/* Seção de categorias comparadas */}
            <div>
              <h2 className="font-semibold text-gray-900 text-sm mb-3">Categorias por torneio</h2>
              <div className={cn('grid gap-4', tournaments.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
                {tournaments.map((t: any) => (
                  <div key={t.id} className="space-y-1.5">
                    <p className="text-xs font-semibold text-gray-500 truncate">{t.name}</p>
                    {t.categories.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Nenhuma categoria disponível</p>
                    )}
                    {t.categories.slice(0, 10).map((cat: any) => {
                      const status = cat.eligibility?.status ?? 'unknown'
                      return (
                        <div key={cat.id} className={cn(
                          'flex items-start gap-2 p-2 rounded-lg border text-xs',
                          status === 'compatible'   && 'bg-brand-50 border-brand-100',
                          status === 'incompatible' && 'bg-red-50 border-red-100',
                          status === 'unknown'      && 'bg-gray-50 border-gray-100',
                        )}>
                          <span className="mt-0.5 shrink-0">
                            {status === 'compatible'   && <CheckCircle2 size={12} className="text-brand-500" />}
                            {status === 'incompatible' && <XCircle      size={12} className="text-red-400" />}
                            {status === 'unknown'      && <HelpCircle   size={12} className="text-gray-400" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="text-gray-700 font-medium">{cat.sourceCategoryText}</span>
                            {cat.priceRaw && <span className="block text-gray-400 mt-0.5">{cat.priceRaw}</span>}
                          </div>
                        </div>
                      )
                    })}
                    {t.categories.length > 10 && (
                      <p className="text-xs text-gray-400 text-center py-1">+ {t.categories.length - 10} outras</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Suspense boundary obrigatório para useSearchParams no Next.js 14
export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={28} className="animate-spin text-brand-400" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  )
}
