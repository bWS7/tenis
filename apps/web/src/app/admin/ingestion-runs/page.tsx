import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { Activity, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react'
import { formatDate, formatRelative } from '@/lib/utils'

export default async function AdminIngestionRunsPage() {
  await requireAdmin()

  const runs = await prisma.ingestionRun.findMany({
    include: {
      dataSource: { include: { organization: { select: { shortName: true } } } },
      artifacts:  { select: { id: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: 100,
  })

  const statusIcon = {
    success: <CheckCircle2 size={14} className="text-brand-500" />,
    failed:  <XCircle     size={14} className="text-red-500" />,
    partial: <AlertTriangle size={14} className="text-amber-500" />,
    running: <Clock size={14} className="text-blue-500 animate-pulse" />,
  }

  const totalSuccess = runs.filter(r => r.status === 'success').length
  const totalFailed  = runs.filter(r => r.status === 'failed').length

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Jobs de ingestão</h1>
        <p className="text-sm text-gray-400">
          {runs.length} execuções · {totalSuccess} com sucesso · {totalFailed} com falha
        </p>
      </div>

      {/* Saúde geral */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Sucesso', value: totalSuccess, color: 'text-brand-600 bg-brand-50' },
          { label: 'Falhas',  value: totalFailed,  color: 'text-red-600 bg-red-50' },
          { label: 'Parciais', value: runs.filter(r => r.status === 'partial').length, color: 'text-amber-600 bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl p-4 ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabela de runs */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fonte</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Iniciado</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Duração</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Artefatos</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Métricas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {runs.map(run => {
              const duration = run.finishedAt
                ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
                : null
              const metrics = run.metricsJson as any

              return (
                <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 text-sm">
                      {run.dataSource.organization.shortName} — {run.dataSource.sourceName}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {statusIcon[run.status as keyof typeof statusIcon] ?? statusIcon.partial}
                      <span className={`text-xs font-medium ${
                        run.status === 'success' ? 'text-brand-600' :
                        run.status === 'failed'  ? 'text-red-600' :
                        run.status === 'running' ? 'text-blue-600' :
                        'text-amber-600'
                      }`}>
                        {run.status}
                      </span>
                    </div>
                    {run.errorSummary && (
                      <p className="text-xs text-red-400 mt-0.5 truncate max-w-[200px]">{run.errorSummary}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <p>{formatDate(run.startedAt, 'dd/MM HH:mm')}</p>
                    <p className="text-gray-300">{formatRelative(run.startedAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {duration !== null ? `${duration}s` : run.status === 'running' ? 'em andamento' : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {run.artifacts.length > 0 ? run.artifacts.length : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {metrics ? (
                      <span className="text-gray-600">
                        +{metrics.inserted ?? 0} ~{metrics.updated ?? 0} ✗{metrics.errors ?? 0}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
