import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET /api/player-profiles/export
// Exporta todos os dados do usuário conforme exigido pela LGPD (RF-026)
export async function GET() {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const userId = (session.user as any).id

  const [user, profiles, watchlist, notifications] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, email: true, createdAt: true, consentVersion: true, consentedAt: true, status: true },
    }),
    prisma.playerProfile.findMany({
      where:   { userId },
      include: { categories: true },
    }),
    prisma.watchlistItem.findMany({
      where: { playerProfile: { userId } },
      include: {
        tournamentEdition: {
          include: { tournament: { select: { canonicalName: true, canonicalSlug: true } } },
        },
      },
    }),
    prisma.notification.findMany({
      where: { watchlistItem: { playerProfile: { userId } } },
      select: { id: true, type: true, subject: true, sentAt: true, readAt: true, createdAt: true },
    }),
  ])

  const exportData = {
    exportedAt:  new Date().toISOString(),
    legalBasis:  'LGPD Art. 18, II — Direito de acesso e portabilidade',
    user: {
      id:             user?.id,
      email:          user?.email,
      createdAt:      user?.createdAt,
      consentVersion: user?.consentVersion,
      consentedAt:    user?.consentedAt,
      status:         user?.status,
    },
    playerProfiles: profiles.map(p => ({
      id:               p.id,
      displayName:      p.displayName,
      birthYear:        p.birthYear,
      gender:           p.gender,
      homeState:        p.homeState,
      travelRadiusKm:   p.travelRadiusKm,
      competitiveLevel: p.competitiveLevel,
      isDefault:        p.isDefault,
      categories:       p.categories,
      createdAt:        p.createdAt,
    })),
    watchlist: watchlist.map(w => ({
      tournamentName: w.tournamentEdition.tournament.canonicalName,
      tournamentSlug: w.tournamentEdition.tournament.canonicalSlug,
      userStatus:     w.userStatus,
      createdAt:      w.createdAt,
    })),
    notifications: notifications,
  }

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type':        'application/json',
      'Content-Disposition': 'attachment; filename="meus-dados-tennishub.json"',
    },
  })
}
