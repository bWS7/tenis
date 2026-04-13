import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

async function getProfileId(session: any): Promise<string | null> {
  const userId = session?.user?.id
  if (!userId) return null
  const profile = await prisma.playerProfile.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  })
  return profile?.id ?? null
}

// GET /api/watchlist — lista watchlist do usuário logado
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const profileId = await getProfileId(session)
  if (!profileId) return NextResponse.json({ items: [] })

  const items = await prisma.watchlistItem.findMany({
    where: { playerProfileId: profileId },
    include: {
      tournamentEdition: {
        include: {
          tournament: { include: { organization: { select: { name: true, shortName: true } } } },
          categories: { select: { id: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    items: items.map(item => ({
      id:             item.id,
      userStatus:     item.userStatus,
      createdAt:      item.createdAt,
      alertPrefsJson: item.alertPrefsJson,
      tournament: {
        id:                  item.tournamentEdition.id,
        slug:                item.tournamentEdition.tournament.canonicalSlug,
        name:                item.tournamentEdition.tournament.canonicalName,
        organizationName:    item.tournamentEdition.tournament.organization.name,
        organizationShortName: item.tournamentEdition.tournament.organization.shortName,
        venueCity:           item.tournamentEdition.venueCity,
        venueState:          item.tournamentEdition.venueState,
        startAt:             item.tournamentEdition.startAt,
        endAt:               item.tournamentEdition.endAt,
        entryCloseAt:        item.tournamentEdition.entryCloseAt,
        status:              item.tournamentEdition.status,
        categoriesCount:     item.tournamentEdition.categories.length,
        compatibleCount:     0, // calculado no frontend com perfil
      },
    })),
  })
}

// POST /api/watchlist — adicionar torneio
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { tournamentEditionId, alertPrefs } = await request.json()
  if (!tournamentEditionId) return NextResponse.json({ error: 'tournamentEditionId obrigatório' }, { status: 400 })

  const profileId = await getProfileId(session)
  if (!profileId) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const existing = await prisma.watchlistItem.findUnique({
    where: { playerProfileId_tournamentEditionId: { playerProfileId: profileId, tournamentEditionId } },
  })
  if (existing) return NextResponse.json({ ok: true, id: existing.id, alreadyExists: true })

  const item = await prisma.watchlistItem.create({
    data: {
      playerProfileId:     profileId,
      tournamentEditionId,
      userStatus:          'pretendo',
      alertPrefsJson:      alertPrefs ?? { emailD7: true, emailD2: true, emailD0: true, onStatusChange: true },
    },
  })

  return NextResponse.json({ ok: true, id: item.id }, { status: 201 })
}

// DELETE /api/watchlist?editionId=xxx — remover
export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const editionId = request.nextUrl.searchParams.get('editionId')
  if (!editionId) return NextResponse.json({ error: 'editionId obrigatório' }, { status: 400 })

  const profileId = await getProfileId(session)
  if (!profileId) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  await prisma.watchlistItem.deleteMany({
    where: { playerProfileId: profileId, tournamentEditionId: editionId },
  })

  return NextResponse.json({ ok: true })
}

// PATCH /api/watchlist — atualizar status
export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id, userStatus, alertPrefsJson } = await request.json()
  const profileId = await getProfileId(session)
  if (!profileId) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const item = await prisma.watchlistItem.findFirst({
    where: { id, playerProfileId: profileId },
  })
  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

  const updated = await prisma.watchlistItem.update({
    where: { id },
    data:  {
      ...(userStatus    ? { userStatus }    : {}),
      ...(alertPrefsJson ? { alertPrefsJson } : {}),
    },
  })

  return NextResponse.json({ ok: true, item: updated })
}
