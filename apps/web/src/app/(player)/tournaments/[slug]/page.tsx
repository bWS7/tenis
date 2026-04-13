'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, Calendar, Clock, ExternalLink, Star,
  CheckCircle2, XCircle, HelpCircle, ChevronDown, ChevronUp,
  AlertTriangle, Info, Shield, FileText, Loader2
} from 'lucide-react'
import { cn, formatDate, formatRelative, getStatusLabel, isClosingSoon } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useWatchlist } from '@/hooks/use-tennis-data'

type EligStatus = 'compatible' | 'incompatible' | 'unknown'

function EligibilityIcon({ status }: { status: EligStatus }) {
  if (status === 'compatible')   return <CheckCircle2 size={16} className="text-brand-500 shrink-0" />
  if (status === 'incompatible') return <XCircle      size={16} className="text-red-400 shrink-0" />
  return                                <HelpCircle   size={16} className="text-gray-400 shrink-0" />
}

function EligibilityBadge({ status }: { status: EligStatus }) {
  if (status === 'compatible')   return <Badge variant="compatible">Compatível</Badge>
  if (status === 'incompatible') return <Badge variant="incompatible">Incompatível</Badge>
  return                                <Badge variant="unknown">Indeterminado</Badge>
}

function CategoryRow({ cat }: { cat: any }) {
  const [expanded, setExpanded] = useState(false)
  const status = (cat.eligibility?.status ?? 'unknown') as EligStatus
  const reasons: string[] = cat.eligibility?.reasons ?? []
  const ruleSource: string | undefined = cat.eligibility?.ruleSource

  return (
    <div className={cn('rounded-xl border p-3 transition-colors',
      status === 'compatible'   && 'bg-brand-50/50 border-brand-100',
      status === 'incompatible' && 'bg-red-50/50 border-red-100',
      status === 'unknown'      && 'bg-gray-50 border-gray-100',
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <EligibilityIcon status={status} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-800 truncate">{cat.sourceCategoryText}</p>
            {cat.priceRaw && <p className="text-xs text-gray-400 mt-0.5">{cat.priceRaw}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EligibilityBadge status={status} />
          {(reasons.length > 0 || ruleSource) && (
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 animate-slide-down">
          {reasons.map((r: string, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
              <span>{r}</span>
            </div>
          ))}
          {ruleSource && (
            <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
              <Shield size={12} className="shrink-0" />
              <span>Fonte: {ruleSource}</span>
            </div>
          )}
          {status === 'unknown' && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Info size={12} className="shrink-0" />
              <span>Consulte o regulamento oficial para verificar sua elegibilidade</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TournamentDetailPage({ params }: { params: { slug: string } }) {
  const [tournament, setTournament]   = useState<any>(null)
  const [eligibility, setEligibility] = useState<any>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const { watchedIds, toggle }        = useWatchlist()

  useEffect(() => {
    Promise.all([
      fetch(`/api/tournaments/${params.slug}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/tournaments/${params.slug}/eligibility`).then(r => r.ok ? r.json() : null),
    ]).then(([t, e]) => {
      if (!t) { setError('Torneio não encontrado'); setLoading(false); return }
      setTournament(t)
      setEligibility(e)
      setLoading(false)
    }).catch(() => { setError('Erro ao carregar torneio'); setLoading(false) })
  }, [params.slug])

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={28} className="animate-spin text-brand-400" />
    </div>
  )

  if (error || !tournament) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-gray-400">{error || 'Torneio não encontrado'}</p>
      <Link href="/tournaments" className="text-brand-600 font-medium text-sm">← Voltar</Link>
    </div>
  )

  const t = tournament
  const isWatched = watchedIds.has(t.id)
  const closing   = isClosingSoon(t.entryCloseAt, 7)

  // Mescla dados do torneio com elegibilidade calculada
  const categories = eligibility?.categories ?? t.categories.map((c: any) => ({ ...c, eligibility: { status: 'unknown', reasons: ['Faça login para ver sua elegibilidade'] } }))
  const compatibles   = categories.filter((c: any) => c.eligibility?.status === 'compatible')
  const incompatibles = categories.filter((c: any) => c.eligibility?.status === 'incompatible')
  const unknowns      = categories.filter((c: any) => c.eligibility?.status === 'unknown')

  const regLink = t.links?.find((l: any) => l.linkType === 'registration')
  const pdfLink = t.links?.find((l: any) => l.linkType === 'regulation')

  return (
    <div className="animate-fade-in pb-6">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <Link href="/tournaments" className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors">
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Torneios</span>
        </Link>
        <button
          onClick={() => toggle(t.id)}
          className={cn('flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm font-medium transition-all',
            isWatched ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:border-brand-200'
          )}
        >
          <Star size={14} className={isWatched ? 'fill-current' : ''} />
          {isWatched ? 'Salvo' : 'Salvar'}
        </button>
      </div>

      <div className="px-4 pt-5 space-y-5">
        {/* Hero */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{t.organization?.shortName}</span>
            <Badge variant={t.status === 'open' ? 'open' : t.status === 'closing_soon' ? 'closing' : t.status === 'canceled' ? 'canceled' : 'default'}>
              {getStatusLabel(t.status)}
            </Badge>
            {closing && <Badge variant="warning" className="flex items-center gap-1"><Clock size={10} />Encerra em breve</Badge>}
          </div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{t.name}</h1>
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <div className="flex items-center gap-2 text-gray-400 mb-1"><MapPin size={13} /><span className="text-xs font-medium uppercase tracking-wide">Local</span></div>
            <p className="text-sm font-semibold text-gray-800">{t.venueName ?? t.venueCity ?? '—'}</p>
            <p className="text-xs text-gray-400">{[t.venueCity, t.venueState].filter(Boolean).join(', ')}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-3">
            <div className="flex items-center gap-2 text-gray-400 mb-1"><Calendar size={13} /><span className="text-xs font-medium uppercase tracking-wide">Datas</span></div>
            <p className="text-sm font-semibold text-gray-800">{formatDate(t.startAt)} – {formatDate(t.endAt)}</p>
            {t.entryCloseAt && <p className="text-xs text-gray-400">Prazo: {formatDate(t.entryCloseAt, 'dd/MM HH:mm')}</p>}
          </div>
        </div>

        {/* CTA */}
        {regLink && (
          <a href={regLink.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors active:scale-[0.98]">
            <ExternalLink size={16} /> Abrir inscrição oficial
          </a>
        )}

        {/* Categorias */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Categorias</h2>
            <span className="text-xs text-gray-400">{categories.length} no total</span>
          </div>

          {/* Sumário de elegibilidade */}
          {eligibility && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {compatibles.length > 0 && (
                <div className="flex items-center gap-1.5 bg-brand-50 text-brand-700 text-xs font-medium px-2.5 py-1 rounded-full border border-brand-200">
                  <CheckCircle2 size={11} />{compatibles.length} compatível{compatibles.length > 1 ? 'is' : ''}
                </div>
              )}
              {incompatibles.length > 0 && (
                <div className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-medium px-2.5 py-1 rounded-full border border-red-200">
                  <XCircle size={11} />{incompatibles.length} incompatível{incompatibles.length > 1 ? 'is' : ''}
                </div>
              )}
              {unknowns.length > 0 && (
                <div className="flex items-center gap-1.5 bg-gray-50 text-gray-500 text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200">
                  <HelpCircle size={11} />{unknowns.length} indeterminado{unknowns.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {compatibles.length > 0 && (
              <><p className="text-xs font-medium text-brand-600 uppercase tracking-wide mb-1">✓ Você pode jogar</p>{compatibles.map((c: any) => <CategoryRow key={c.id} cat={c} />)}</>
            )}
            {unknowns.length > 0 && (
              <div className="pt-1"><p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">? Verificar no regulamento</p>{unknowns.map((c: any) => <CategoryRow key={c.id} cat={c} />)}</div>
            )}
            {incompatibles.length > 0 && (
              <div className="pt-1"><p className="text-xs font-medium text-red-400 uppercase tracking-wide mb-1">✕ Incompatíveis com seu perfil</p>{incompatibles.map((c: any) => <CategoryRow key={c.id} cat={c} />)}</div>
            )}
          </div>
        </section>

        {/* Links */}
        {t.links?.length > 0 && (
          <section>
            <h2 className="font-semibold text-gray-900 mb-3">Documentos oficiais</h2>
            <div className="space-y-2">
              {t.links.map((link: any) => (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 hover:border-brand-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center"><FileText size={15} className="text-gray-400" /></div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-brand-700 transition-colors">{link.label ?? link.linkType}</span>
                  </div>
                  <ExternalLink size={14} className="text-gray-300 group-hover:text-brand-400 transition-colors" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Histórico de mudanças */}
        {t.changeEvents?.length > 0 && (
          <section className="bg-amber-50 rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-amber-500" />
              <h2 className="font-semibold text-amber-800 text-sm">Mudanças recentes detectadas</h2>
            </div>
            {t.changeEvents.slice(0, 3).map((ev: any) => (
              <div key={ev.id} className="text-xs text-amber-700 mb-1">
                {ev.eventType} · {formatRelative(ev.detectedAt)}
              </div>
            ))}
          </section>
        )}

        {/* Proveniência */}
        <section className="bg-gray-50 rounded-xl p-4 border border-gray-100">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-gray-400 mt-0.5 shrink-0" />
            <div className="text-xs text-gray-400 space-y-1">
              <p><span className="font-medium text-gray-500">Fonte:</span>{' '}{t.sourceName}{' '}
                {t.officialSourceUrl && <a href={t.officialSourceUrl} target="_blank" rel="noopener noreferrer" className="text-brand-500 underline">ver original</a>}
              </p>
              <p><span className="font-medium text-gray-500">Atualizado:</span> {formatRelative(t.fetchedAt)}</p>
              <p><span className="font-medium text-gray-500">Confiança:</span> {t.dataConfidence === 'high' ? 'Alta' : t.dataConfidence === 'med' ? 'Média' : 'Baixa'}</p>
              <p className="pt-1">Informações extraídas automaticamente. Confirme sempre no site oficial antes de inscrever-se.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
