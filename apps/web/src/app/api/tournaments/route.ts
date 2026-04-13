import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { addDays } from 'date-fns'

const QuerySchema = z.object({
  q:          z.string().optional(),
  state:      z.string().optional(),
  status:     z.string().optional(),
  org:        z.string().optional(),
  modalidade: z.string().optional(),
  from:       z.string().optional(),
  to:         z.string().optional(),
  closing:    z.string().optional(), // "14" = next 14 days
  page:       z.coerce.number().default(1),
  limit:      z.coerce.number().max(50).default(20),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const params = QuerySchema.parse(Object.fromEntries(searchParams))

    const where: any = {}

    if (params.q) {
      where.OR = [
        { tournament: { canonicalName: { contains: params.q, mode: 'insensitive' } } },
        { venueCity: { contains: params.q, mode: 'insensitive' } },
        { venueName: { contains: params.q, mode: 'insensitive' } },
      ]
    }

    if (params.state) {
      where.venueState = params.state.toUpperCase()
    }

    if (params.status && params.status !== 'compatible') {
      where.status = params.status
    }

    if (params.org) {
      where.tournament = { organization: { shortName: { equals: params.org.toUpperCase(), mode: 'insensitive' } } }
    }

    if (params.modalidade) {
      where.tournament = { ...where.tournament, modalidade: params.modalidade }
    }

    if (params.from) {
      where.startAt = { gte: new Date(params.from) }
    }

    if (params.to) {
      where.endAt = { lte: new Date(params.to) }
    }

    if (params.closing) {
      const days = parseInt(params.closing)
      const now = new Date()
      where.entryCloseAt = {
        gte: now,
        lte: addDays(now, days),
      }
    }

    const [total, editions] = await Promise.all([
      prisma.tournamentEdition.count({ where }),
      prisma.tournamentEdition.findMany({
        where,
        include: {
          tournament: {
            include: { organization: { select: { name: true, shortName: true } } },
          },
          categories: { select: { id: true, normalizedCode: true, genderScope: true, classCode: true, minAge: true, maxAge: true, ageType: true } },
          links: { where: { linkType: 'registration', isOfficial: true }, take: 1 },
        },
        orderBy: [{ entryCloseAt: 'asc' }, { startAt: 'asc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ])

    const items = editions.map(e => ({
      id:                    e.id,
      slug:                  e.tournament.canonicalSlug,
      name:                  e.tournament.canonicalName,
      organizationName:      e.tournament.organization.name,
      organizationShortName: e.tournament.organization.shortName,
      venueCity:             e.venueCity,
      venueState:            e.venueState,
      startAt:               e.startAt,
      endAt:                 e.endAt,
      entryCloseAt:          e.entryCloseAt,
      status:                e.status,
      categoriesCount:       e.categories.length,
      compatibleCount:       0, // calculado no frontend com perfil do jogador
      officialRegUrl:        e.links[0]?.url ?? null,
      dataConfidence:        e.dataConfidence,
      fetchedAt:             e.fetchedAt,
      // Incluir campos necessários para cálculo de elegibilidade no cliente
      categories:            e.categories,
    }))

    return NextResponse.json({
      items,
      total,
      page:       params.page,
      totalPages: Math.ceil(total / params.limit),
    })
  } catch (err) {
    console.error('[GET /api/tournaments]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
