import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TopBar } from '@/components/navigation'
import { TournamentCard } from '@/components/tournament-card'
import { Badge } from '@/components/ui/badge'
import { Clock, TrendingUp, MapPin, ChevronRight, Zap, Star } from 'lucide-react'
import Link from 'next/link'
import { addDays } from 'date-fns'
import { getSportAge } from '@/lib/utils'

async function getHomeData(userId: string) {
  const profile = await prisma.playerProfile.findFirst({
    where: { userId, isDefault: true },
    include: { categories: true },
  })
  if (!profile) return { profile: null, closing: [], compatible: [], nearby: [], circuitCounts: { fpt: 0, cbt: 0 } }

  const now      = new Date()
  const in14days = addDays(now, 14)
  const sportAge = getSportAge(profile.birthYear)
  const classCode = profile.categories.find(c => c.taxonomy === 'FPT_CLASS')?.code
  const profileGender = profile.gender

  const baseWhere = {
    status: { in: ['open', 'closing_soon', 'announced'] as string[] },
    ...(profile.homeState ? { venueState: profile.homeState } : {}),
  }

  const include = {
    tournament: { include: { organization: { select: { name: true, shortName: true } } } },
    categories: { select: { id: true, normalizedCode: true, genderScope: true, classCode: true, minAge: true, maxAge: true, ageType: true } },
    watchlistItems: { where: { playerProfileId: profile.id }, select: { id: true } },
  }

  const [closingEditions, nearbyEditions, fptCount, cbtCount] = await Promise.all([
    prisma.tournamentEdition.findMany({
      where: { ...baseWhere, entryCloseAt: { gte: now, lte: in14days } },
      include, orderBy: { entryCloseAt: 'asc' }, take: 5,
    }),
    prisma.tournamentEdition.findMany({
      where: baseWhere, include, orderBy: { startAt: 'asc' }, take: 10,
    }),
    prisma.tournamentEdition.count({ where: { tournament: { organization: { shortName: 'FPT' } } } }),
    prisma.tournamentEdition.count({ where: { tournament: { organization: { shortName: 'CBT' } } } }),
  ])

  function countCompatible(categories: any[]): number {
    return categories.filter(cat => {
      if (profileGender && cat.genderScope && cat.genderScope !== 'Mixed' && cat.genderScope !== profileGender) return false
      if (cat.classCode && classCode) {
        const pNum = parseInt(classCode), cNum = parseInt(cat.classCode)
        if (!isNaN(pNum) && !isNaN(cNum)) {
          if (pNum > cNum + 1 || pNum < cNum) return false
        }
      }
      if (cat.minAge && cat.ageType === 'exact' && (sportAge < cat.minAge)) return false
      if (cat.maxAge && cat.ageType === 'exact' && (sportAge > cat.maxAge)) return false
      if (cat.minAge && cat.ageType === 'minimum' && sportAge < cat.minAge) return false
      return true
    }).length
  }

  function toCard(e: any) {
    return {
      id: e.id, slug: e.tournament.canonicalSlug, name: e.tournament.canonicalName,
      organizationName: e.tournament.organization.name,
      organizationShortName: e.tournament.organization.shortName,
      venueCity: e.venueCity, venueState: e.venueState,
      startAt: e.startAt?.toISOString() ?? null, endAt: e.endAt?.toISOString() ?? null,
      entryCloseAt: e.entryCloseAt?.toISOString() ?? null, status: e.status,
      categoriesCount: e.categories.length, compatibleCount: countCompatible(e.categories),
      isWatched: e.watchlistItems.length > 0,
    }
  }

  const allCards  = nearbyEditions.map(toCard)
  const closing   = closingEditions.map(toCard)
  const compatible = allCards.filter(t => t.compatibleCount > 0)

  return {
    profile: { displayName: profile.displayName, birthYear: profile.birthYear, gender: profile.gender, homeState: profile.homeState, classCode, sportAge },
    closing, compatible, nearby: allCards, circuitCounts: { fpt: fptCount, cbt: cbtCount },
  }
}

export default async function HomePage() {
  const session = await getSession()
  const userId  = (session?.user as any)?.id
  if (!userId) return null

  const { profile, closing, compatible, nearby, circuitCounts } = await getHomeData(userId)

  if (!profile) {
    return (
      <div className="px-4 pt-16 text-center">
        <p className="text-gray-500 mb-4">Complete seu perfil para ver torneios compatíveis.</p>
        <Link href="/onboarding" className="inline-flex items-center h-11 px-6 bg-brand-500 text-white rounded-xl font-medium text-sm">Configurar perfil</Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Tennis Hub"
        subtitle={`${profile.homeState ?? ''} · ${profile.sportAge} anos${profile.classCode ? ` · ${profile.classCode}ª classe` : ''}`}
        action={
          <Link href="/profile" className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white font-semibold text-sm">
            {profile.displayName[0].toUpperCase()}
          </Link>
        }
      />
      <div className="px-4 pt-4 space-y-6">
        {/* Hero */}
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-5 text-white">
          <p className="text-brand-200 text-sm font-medium mb-1">Olá, {profile.displayName} 👋</p>
          <h2 className="text-xl font-semibold mb-3">
            {compatible.length > 0 ? `${compatible.length} torneio${compatible.length > 1 ? 's compatíveis' : ' compatível'} com você` : 'Bem-vindo ao Tennis Hub'}
          </h2>
          <div className="flex gap-2 flex-wrap">
            {profile.classCode && <Badge className="bg-white/20 text-white border-white/30 text-xs">{profile.classCode}ª Classe</Badge>}
            {profile.gender    && <Badge className="bg-white/20 text-white border-white/30 text-xs">{profile.gender === 'M' ? 'Masculino' : 'Feminino'}</Badge>}
            {profile.homeState && <Badge className="bg-white/20 text-white border-white/30 text-xs">{profile.homeState}</Badge>}
          </div>
        </div>

        {/* Fechando em breve */}
        {closing.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Clock size={16} className="text-amber-500" /><h2 className="font-semibold text-gray-800 text-sm">Inscrições fechando em breve</h2></div>
              <Link href="/tournaments?closing=14" className="text-xs text-brand-600 font-medium flex items-center gap-1">Ver todos <ChevronRight size={12} /></Link>
            </div>
            <div className="space-y-3">{closing.slice(0, 3).map(t => <TournamentCard key={t.id} tournament={t} showEligibility />)}</div>
          </section>
        )}

        {/* Compatíveis */}
        {compatible.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Zap size={16} className="text-brand-500" /><h2 className="font-semibold text-gray-800 text-sm">Compatíveis com você</h2></div>
              <Link href="/tournaments?filter=compatible" className="text-xs text-brand-600 font-medium flex items-center gap-1">Ver todos <ChevronRight size={12} /></Link>
            </div>
            <div className="space-y-3">{compatible.slice(0, 4).map(t => <TournamentCard key={t.id} tournament={t} showEligibility />)}</div>
          </section>
        )}

        {/* Circuitos */}
        <section>
          <div className="flex items-center gap-2 mb-3"><TrendingUp size={16} className="text-gray-400" /><h2 className="font-semibold text-gray-800 text-sm">Explorar por circuito</h2></div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'FPT — São Paulo', count: circuitCounts.fpt, href: '/tournaments?org=fpt' },
              { label: 'CBT — Nacional',  count: circuitCounts.cbt, href: '/tournaments?org=cbt' },
            ].map(item => (
              <Link key={item.href} href={item.href} className="flex flex-col gap-1 bg-white rounded-xl p-4 border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all">
                <span className="font-semibold text-gray-800 text-sm">{item.label}</span>
                <span className="text-xs text-gray-400">{item.count} torneios</span>
              </Link>
            ))}
            <Link href="/tournaments?mod=beach_tennis" className="flex flex-col gap-1 bg-white rounded-xl p-4 border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all">
              <span className="font-semibold text-gray-800 text-sm">Beach Tennis</span>
              <span className="text-xs text-gray-400">Modalidade</span>
            </Link>
            <Link href="/watchlist" className="flex flex-col gap-1 bg-brand-50 rounded-xl p-4 border border-brand-100 hover:border-brand-200 transition-all">
              <span className="flex items-center gap-1.5 font-semibold text-brand-700 text-sm"><Star size={13} className="fill-current" />Minha agenda</span>
              <span className="text-xs text-brand-400">Ver watchlist</span>
            </Link>
          </div>
        </section>

        {/* Próximos */}
        {nearby.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><MapPin size={16} className="text-gray-400" /><h2 className="font-semibold text-gray-800 text-sm">Próximos{profile.homeState ? ` em ${profile.homeState}` : ''}</h2></div>
              <Link href="/tournaments" className="text-xs text-brand-600 font-medium flex items-center gap-1">Ver todos <ChevronRight size={12} /></Link>
            </div>
            <div className="space-y-3">{nearby.slice(0, 5).map(t => <TournamentCard key={t.id} tournament={t} showEligibility />)}</div>
          </section>
        )}

        {nearby.length === 0 && compatible.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="font-medium">Nenhum torneio encontrado no momento</p>
            <p className="text-sm mt-1">Novos torneios são adicionados conforme as federações publicam</p>
            <Link href="/tournaments" className="inline-flex mt-4 text-sm text-brand-600 font-medium underline">Explorar todos os torneios</Link>
          </div>
        )}
      </div>
    </div>
  )
}
