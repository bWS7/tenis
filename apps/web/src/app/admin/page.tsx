import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { Trophy, Database, Activity, Users, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

async function getStats() {
  const [
    totalTournaments,
    openTournaments,
    lowConfidence,
    totalSources,
    activeSources,
    recentRuns,
    totalUsers,
    pendingReview,
  ] = await Promise.all([
    prisma.tournamentEdition.count(),
    prisma.tournamentEdition.count({ where: { status: 'open' } }),
    prisma.tournamentEdition.count({ where: { dataConfidence: 'low' } }),
    prisma.dataSource.count(),
    prisma.dataSource.count({ where: { enabled: true } }),
    prisma.ingestionRun.findMany({ orderBy: { startedAt: 'desc' }, take: 5 }),
    prisma.user.count(),
    prisma.tournamentEdition.count({ where: { dataConfidence: 'low', reviewedAt: null } }),
  ])

  return { totalTournaments, openTournaments, lowConfidence, totalSources, activeSources, recentRuns, totalUsers, pendingReview }
}

export default async function AdminDashboard() {
  await requireAdmin()
  const stats = await getStats()

  const cards = [
    { label: 'Torneios cadastrados', value: stats.totalTournaments, sub: `${stats.openTournaments} com inscrições abertas`, icon: Trophy, color: 'text-brand-600 bg-brand-50' },
    { label: 'Fontes ativas', value: stats.activeSources, sub: `${stats.totalSources} fontes no total`, icon: Database, color: 'text-blue-600 bg-blue-50' },
    { label: 'Usuários', value: stats.totalUsers, sub: 'contas criadas', icon: Users, color: 'text-purple-600 bg-purple-50' },
    { label: 'Revisão pendente', value: stats.pendingReview, sub: 'dados de baixa confiança', icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Visão geral do Tennis Hub</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${card.color}`}>
              <card.icon size={18} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs font-medium text-gray-700 mt-0.5">{card.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Alertas de qualidade */}
      {stats.pendingReview > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              {stats.pendingReview} torneio{stats.pendingReview > 1 ? 's' : ''} com dados de baixa confiança aguardam revisão
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Acesse <a href="/admin/tournaments?filter=low_confidence" className="underline font-medium">Torneios → Baixa confiança</a> para revisar
            </p>
          </div>
        </div>
      )}

      {/* Jobs recentes */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800 text-sm">Jobs de ingestão recentes</h2>
          </div>
          <a href="/admin/ingestion-runs" className="text-xs text-brand-600 font-medium">Ver todos</a>
        </div>
        <div className="divide-y divide-gray-50">
          {stats.recentRuns.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhum job executado ainda</p>
          ) : stats.recentRuns.map(run => (
            <div key={run.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${run.status === 'success' ? 'bg-brand-500' : run.status === 'failed' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div>
                  <p className="text-sm font-medium text-gray-700">{run.dataSourceId}</p>
                  <p className="text-xs text-gray-400">{new Date(run.startedAt).toLocaleString('pt-BR')}</p>
                </div>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                run.status === 'success' ? 'bg-brand-50 text-brand-700' :
                run.status === 'failed'  ? 'bg-red-50 text-red-600' :
                'bg-amber-50 text-amber-700'
              }`}>
                {run.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
