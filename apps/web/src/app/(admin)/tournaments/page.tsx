import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ExternalLink, Clock, Filter } from 'lucide-react'
import { formatDate } from '@/lib/utils'

type FilterType = 'all' | 'low_confidence' | 'no_link' | 'changed' | 'manual_override'

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams: { filter?: string; page?: string }
}) {
  await requireAdmin()

  const filter = (searchParams.filter ?? 'all') as FilterType
  const page   = Number(searchParams.page ?? 1)
  const limit  = 30

  const where: any = {}
  if (filter === 'low_confidence')    where.dataConfidence    = 'low'
  if (filter === 'no_link')           where.officialSourceUrl  = null
  if (filter === 'manual_override')   where.isManualOverride   = true
  if (filter === 'changed') {
    where.changeEvents = { some: { detectedAt: { gte: new Date(Date.now() - 7 * 86400000) } } }
  }

  const [total, editions] = await Promise.all([
    prisma.tournamentEdition.count({ where }),
    prisma.tournamentEdition.findMany({
      where,
      include: {
        tournament: { include: { organization: { select: { shortName: true, name: true } } } },
        categories: { select: { id: true } },
        changeEvents: { orderBy: { detectedAt: 'desc' }, take: 1 },
        _count: { select: { watchlistItems: true } },
      },
      orderBy: [{ dataConfidence: 'asc' }, { fetchedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all',             label: 'Todos' },
    { value: 'low_confidence',  label: 'Baixa confiança' },
    { value: 'no_link',         label: 'Sem link oficial' },
    { value: 'changed',         label: 'Mudaram (7 dias)' },
    { value: 'manual_override', label: 'Override manual' },
  ]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Torneios</h1>
          <p className="text-sm text-gray-400">{total} resultados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {filters.map(f => (
          <Link key={f.value} href={`/admin/tournaments?filter=${f.value}`}
            className={`px-3 h-8 rounded-full text-xs font-medium border transition-colors ${
              filter === f.value
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Torneio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Prazo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Confiança</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Watchlist</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {editions.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{e.tournament.canonicalName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {e.tournament.organization.shortName} · {e.venueCity}, {e.venueState}
                        {e.isManualOverride && <span className="ml-2 text-blue-500 font-medium">Override</span>}
                        {e.changeEvents[0] && <span className="ml-2 text-amber-500 font-medium">Mudou</span>}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      e.status === 'open' ? 'bg-brand-50 text-brand-700' :
                      e.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                      e.status === 'canceled' ? 'bg-red-50 text-red-600' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {e.entryCloseAt ? formatDate(e.entryCloseAt) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {e.dataConfidence === 'high' ? (
                        <CheckCircle2 size={13} className="text-brand-500" />
                      ) : e.dataConfidence === 'med' ? (
                        <Clock size={13} className="text-amber-500" />
                      ) : (
                        <AlertTriangle size={13} className="text-red-400" />
                      )}
                      <span className={`text-xs font-medium ${
                        e.dataConfidence === 'high' ? 'text-brand-600' :
                        e.dataConfidence === 'med'  ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {e.dataConfidence === 'high' ? 'Alta' : e.dataConfidence === 'med' ? 'Média' : 'Baixa'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {e._count.watchlistItems > 0 ? (
                      <span className="font-medium text-gray-700">{e._count.watchlistItems}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/tournaments/${e.id}`}
                        className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors">
                        Revisar
                      </Link>
                      {e.officialSourceUrl && (
                        <a href={e.officialSourceUrl} target="_blank" rel="noopener noreferrer"
                          className="text-gray-300 hover:text-gray-500 transition-colors">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {total > limit && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/admin/tournaments?filter=${filter}&page=${page - 1}`}
                  className="px-3 h-7 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center">
                  Anterior
                </Link>
              )}
              {page * limit < total && (
                <Link href={`/admin/tournaments?filter=${filter}&page=${page + 1}`}
                  className="px-3 h-7 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center">
                  Próximo
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
