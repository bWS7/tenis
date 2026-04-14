'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, ExternalLink, AlertTriangle, Shield, Clock, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { cn, formatDate } from '@/lib/utils'

interface TournamentEdition {
  id: string
  tournament: { canonicalName: string; canonicalSlug: string; organization: { name: string } }
  status: string
  venueCity: string | null
  venueState: string | null
  venueName: string | null
  startAt: string | null
  endAt: string | null
  entryCloseAt: string | null
  entryOpenAt: string | null
  officialSourceUrl: string | null
  sourceName: string | null
  fetchedAt: string | null
  dataConfidence: string
  dataOrigin: string
  isManualOverride: boolean
  reviewedAt: string | null
  reviewedBy: string | null
  notes: string | null
  categories: Array<{ id: string; sourceCategoryText: string; normalizedCode: string | null; priceBrl: number | null; priceRaw: string | null }>
  changeEvents: Array<{ id: string; eventType: string; fieldChangesJson: any; detectedAt: string }>
}

export default function AdminTournamentReviewPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [data, setData]       = useState<TournamentEdition | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  // Campos editáveis
  const [form, setForm] = useState({
    status:           '',
    venueCity:        '',
    venueState:       '',
    venueName:        '',
    entryCloseAt:     '',
    officialSourceUrl: '',
    dataConfidence:   '',
    notes:            '',
  })

  useEffect(() => {
    fetch(`/api/admin/tournaments/${params.id}`)
      .then(r => r.json())
      .then((d: TournamentEdition) => {
        setData(d)
        setForm({
          status:            d.status,
          venueCity:         d.venueCity ?? '',
          venueState:        d.venueState ?? '',
          venueName:         d.venueName ?? '',
          entryCloseAt:      d.entryCloseAt ? d.entryCloseAt.slice(0, 16) : '',
          officialSourceUrl: d.officialSourceUrl ?? '',
          dataConfidence:    d.dataConfidence,
          notes:             d.notes ?? '',
        })
        setLoading(false)
      })
  }, [params.id])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const res = await fetch(`/api/admin/tournaments/${params.id}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Carregando...</div>
  if (!data)   return <div className="p-6 text-red-500 text-sm">Torneio não encontrado</div>

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/tournaments"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft size={16} /> Voltar
          </Link>
          <h1 className="text-lg font-bold text-gray-900">{data.tournament.canonicalName}</h1>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <div className="flex items-center gap-1.5 text-sm text-brand-600 font-medium">
              <CheckCircle2 size={14} /> Salvo
            </div>
          )}
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 h-9 px-4 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60">
            <Save size={14} />
            {saving ? 'Salvando...' : 'Salvar override'}
          </button>
        </div>
      </div>

      {/* Badges de estado */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
          data.dataConfidence === 'high' ? 'bg-brand-50 text-brand-700 border border-brand-200' :
          data.dataConfidence === 'med'  ? 'bg-amber-50 text-amber-700 border border-amber-200' :
          'bg-red-50 text-red-600 border border-red-200'
        }`}>
          Confiança: {data.dataConfidence}
        </span>
        {data.isManualOverride && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Override manual ativo
          </span>
        )}
        {data.reviewedAt && (
          <span className="text-xs text-gray-400">
            Revisado em {formatDate(data.reviewedAt)}
          </span>
        )}
        {data.changeEvents.length > 0 && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <AlertTriangle size={11} /> {data.changeEvents.length} mudança{data.changeEvents.length > 1 ? 's' : ''} detectada{data.changeEvents.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fonte original */}
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
              <Shield size={14} className="text-gray-400" />
              Dados da fonte
            </h2>
            {data.officialSourceUrl && (
              <a href={data.officialSourceUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-brand-600 flex items-center gap-1 hover:underline">
                Ver original <ExternalLink size={11} />
              </a>
            )}
          </div>
          <dl className="space-y-2 text-xs">
            {[
              { label: 'Fonte', value: data.sourceName },
              { label: 'Capturado em', value: data.fetchedAt ? formatDate(data.fetchedAt) : '—' },
              { label: 'Origem', value: data.dataOrigin },
              { label: 'Status', value: data.status },
              { label: 'Local', value: [data.venueName, data.venueCity, data.venueState].filter(Boolean).join(', ') || '—' },
              { label: 'Prazo inscrição', value: data.entryCloseAt ? formatDate(data.entryCloseAt, 'dd/MM/yyyy HH:mm') : '—' },
            ].map(row => (
              <div key={row.label} className="flex gap-2">
                <dt className="text-gray-400 w-28 shrink-0">{row.label}</dt>
                <dd className="text-gray-700 font-medium break-all">{row.value || '—'}</dd>
              </div>
            ))}
          </dl>

          {/* Categorias da fonte */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Categorias ({data.categories.length})</p>
            <div className="space-y-1">
              {data.categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700">{cat.sourceCategoryText}</span>
                  <span className="text-gray-400">{cat.priceRaw ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Formulário de override */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-4">
          <h2 className="font-semibold text-gray-700 text-sm">Override manual</h2>
          <p className="text-xs text-gray-400">
            Campos editados aqui terão precedência e não serão sobrescritos pelo scraper.
          </p>

          {[
            { key: 'status', label: 'Status', type: 'select', options: ['unknown','announced','open','closing_soon','closed','draws_published','in_progress','finished','canceled'] },
            { key: 'dataConfidence', label: 'Confiança', type: 'select', options: ['low','med','high'] },
            { key: 'venueCity', label: 'Cidade', type: 'text' },
            { key: 'venueState', label: 'Estado (UF)', type: 'text' },
            { key: 'venueName', label: 'Local/Clube', type: 'text' },
            { key: 'entryCloseAt', label: 'Prazo de inscrição', type: 'datetime-local' },
            { key: 'officialSourceUrl', label: 'URL oficial', type: 'url' },
          ].map(field => (
            <div key={field.key} className="space-y-1">
              <label className="text-xs font-medium text-gray-500">{field.label}</label>
              {field.type === 'select' ? (
                <select
                  value={(form as any)[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  className="w-full h-9 px-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={(form as any)[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  className="w-full h-9 px-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              )}
            </div>
          ))}

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Notas internas</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Observações sobre este torneio..."
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Change events */}
      {data.changeEvents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <Clock size={14} className="text-gray-400" />
              Histórico de mudanças detectadas
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {data.changeEvents.map(ev => (
              <div key={ev.id} className="px-4 py-3 flex items-start gap-3">
                <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">{ev.eventType}</p>
                  <pre className="text-xs text-gray-400 mt-1 whitespace-pre-wrap break-all">
                    {JSON.stringify(ev.fieldChangesJson, null, 2)}
                  </pre>
                </div>
                <span className="text-xs text-gray-300 shrink-0">{formatDate(ev.detectedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
