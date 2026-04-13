import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET /api/alerts — notificações do usuário logado
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const userId = (session.user as any).id

  const profile = await prisma.playerProfile.findFirst({
    where: { userId, isDefault: true },
    select: { id: true },
  })
  if (!profile) return NextResponse.json({ items: [] })

  const notifications = await prisma.notification.findMany({
    where: {
      watchlistItem: { playerProfileId: profile.id },
    },
    include: {
      watchlistItem: {
        include: {
          tournamentEdition: {
            include: { tournament: { select: { canonicalName: true, canonicalSlug: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take:    50,
  })

  return NextResponse.json({
    items: notifications.map(n => ({
      id:          n.id,
      type:        n.type,
      channel:     n.channel,
      subject:     n.subject,
      bodyJson:    n.bodyJson,
      sentAt:      n.sentAt,
      readAt:      n.readAt,
      createdAt:   n.createdAt,
      tournament: {
        name: n.watchlistItem.tournamentEdition.tournament.canonicalName,
        slug: n.watchlistItem.tournamentEdition.tournament.canonicalSlug,
      },
    })),
    unreadCount: notifications.filter(n => !n.readAt).length,
  })
}

// PATCH /api/alerts — marcar como lida
export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { id, markAllRead } = await request.json()

  if (markAllRead) {
    const userId = (session.user as any).id
    const profile = await prisma.playerProfile.findFirst({ where: { userId, isDefault: true } })
    if (profile) {
      await prisma.notification.updateMany({
        where: { watchlistItem: { playerProfileId: profile.id }, readAt: null },
        data:  { readAt: new Date() },
      })
    }
    return NextResponse.json({ ok: true })
  }

  if (id) {
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
}
