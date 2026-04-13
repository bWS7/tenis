import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const edition = await prisma.tournamentEdition.findFirst({
    where:   { tournament: { canonicalSlug: params.slug } },
    include: {
      tournament:  { include: { organization: true } },
      categories:  { orderBy: { visibilityOrder: 'asc' } },
      links:       { orderBy: { isOfficial: 'desc' } },
      changeEvents:{ orderBy: { detectedAt: 'desc' }, take: 10 },
    },
    orderBy: { seasonYear: 'desc' },
  })

  if (!edition) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  return NextResponse.json({
    id:                edition.id,
    slug:              edition.tournament.canonicalSlug,
    name:              edition.tournament.canonicalName,
    organization: {
      id:        edition.tournament.organization.id,
      name:      edition.tournament.organization.name,
      shortName: edition.tournament.organization.shortName,
      websiteUrl: edition.tournament.organization.websiteUrl,
    },
    seasonYear:        edition.seasonYear,
    startAt:           edition.startAt,
    endAt:             edition.endAt,
    entryOpenAt:       edition.entryOpenAt,
    entryCloseAt:      edition.entryCloseAt,
    status:            edition.status,
    venueName:         edition.venueName,
    venueCity:         edition.venueCity,
    venueState:        edition.venueState,
    officialSourceUrl: edition.officialSourceUrl,
    sourceName:        edition.sourceName,
    fetchedAt:         edition.fetchedAt,
    dataConfidence:    edition.dataConfidence,
    notes:             edition.notes,
    categories:        edition.categories.map(c => ({
      id:                 c.id,
      sourceCategoryText: c.sourceCategoryText,
      normalizedCode:     c.normalizedCode,
      genderScope:        c.genderScope,
      classCode:          c.classCode,
      minAge:             c.minAge,
      maxAge:             c.maxAge,
      ageType:            c.ageType,
      priceBrl:           c.priceBrl,
      priceRaw:           c.priceRaw,
    })),
    links:        edition.links,
    changeEvents: edition.changeEvents,
  })
}
