'use client'

import { useState, useEffect } from 'react'
import { Database, Plus, Play, Pause, ExternalLink, Loader2, Check, X } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function AdminSourcesPage() {
  const [sources,  setSources]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  async function loadSources() {
    const res  = await fetch('/api/admin/sources')
    const data = await res.json()
    setSources(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { loadSources() }, [])

  async function handleToggle(id: string) {
    await fetch(`/api/admin/sources/${id}/toggle`, { method: 'POST' })
    loadSources()
  }

  async function handleTrigger(id: string) {
    setFeedback(f => ({ ...f, [id]: 'running' }))
    const res = await fetch(`/api/admin/sources/${id}/trigger`, { method: 'POST' })
    setFeedback(f => ({ ...f, [id]: res.ok ? 'ok' : 'error' }))
    setTimeout(() => setFeedback(f => { const n = { ...f }; delete n[id]; return n }), 3000)
  }

  if (loading) return <div className="p-6 flex items-center gap-2 text-gray-400"><Loader2 size={18} className="animate-spin" /> Carregando...</div>

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fontes de dados</h1>
          <p className="text-sm text-gray-400">{sources.length} fontes cadastradas</p>
        </div>
      </div>

      <div className="space-y-3">
        {sources.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Database size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma fonte cadastrada</p>
            <p className="text-sm mt-1">Execute o seed para popular as fontes iniciais</p>
          </div>
        )}

        {sources.map(source => {
          const lastRun = source.ingestionRuns?.[0]
          const fb      = feedback[source.id]

          return (
            <div key={source.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${source.enabled ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-400'}`}>
                    <Database size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{source.sourceName}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${source.enabled ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                        {source.enabled ? 'Ativo' : 'Pausado'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100">{source.sourceType}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{source.organization?.name}</p>
                    <a href={source.baseUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-brand-500 hover:underline flex items-center gap-1 mt-1 truncate max-w-xs">
                      {source.baseUrl} <ExternalLink size={10} />
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right text-xs text-gray-400 mr-2">
                    <p>{source._count?.ingestionRuns ?? 0} runs</p>
                    {lastRun && (
                      <p className={lastRun.status === 'success' ? 'text-brand-500' : lastRun.status === 'failed' ? 'text-red-500' : 'text-amber-500'}>
                        {lastRun.status} · {formatDate(lastRun.startedAt, 'dd/MM HH:mm')}
                      </p>
                    )}
                    {source.fetchScheduleCron && <p className="text-gray-300">{source.fetchScheduleCron}</p>}
                  </div>

                  <button onClick={() => handleTrigger(source.id)} disabled={!source.enabled || fb === 'running'}
                    className="flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors disabled:opacity-40">
                    {fb === 'running' ? <Loader2 size={11} className="animate-spin" /> : fb === 'ok' ? <Check size={11} className="text-brand-500" /> : fb === 'error' ? <X size={11} className="text-red-500" /> : <Play size={11} />}
                    {fb === 'running' ? 'Iniciando...' : fb === 'ok' ? 'Criado!' : 'Executar'}
                  </button>

                  <button onClick={() => handleToggle(source.id)}
                    className="flex items-center gap-1 h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    {source.enabled ? <Pause size={11} /> : <Play size={11} />}
                    {source.enabled ? 'Pausar' : 'Ativar'}
                  </button>
                </div>
              </div>

              {source.legalNotes && (
                <div className="mt-3 pt-3 border-t border-gray-50 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  ⚠️ {source.legalNotes}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
