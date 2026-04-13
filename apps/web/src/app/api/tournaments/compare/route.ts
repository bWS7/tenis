import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { evaluateEligibility, type PlayerContext, type CategoryRule } from '@tennis-hub/core/eligibility'

// GET /api/tournaments/compare?slugs=slug1,slug2,slug3
// Retorna até 3 torneios com elegibilidade calculada para comparação lado a lado
export async function GET(request: NextRequest) {
  const session = await getSession()
  const userId  = (session?.user as any)?.id

  const rawSlugs = request.nextUrl.searchParams.get('slugs') ?? ''
  const slugs    = rawSlugs.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)

  if (slugs.length < 2) {
    return NextResponse.json({ error: 'Informe ao menos 2 slugs para comparar' }, { status: 400 })
  }

  // Carregar perfil do usuário logado
  let player: PlayerContext | null = null
  if (userId) {
    const profile = await prisma.playerProfile.findFirst({
      where: { userId, isDefault: true },
      include: { categories: true },
    })
    if (profile) {
      const classCategory = profile.categories.find(c => c.taxonomy === 'FPT_CLASS')
      player = {
        birthYear:       profile.birthYear,
        gender:          profile.gender ?? undefined,
        classCode:       classCategory?.code ?? undefined,
        hasFederationId: profile.competitiveLevel === 'federated',
        hasCPF:          true,
      }
    }
  }

  const year = new Date().getFullYear()

  // Buscar edições de todos os slugs em paralelo
  const editions = await Promise.all(
    slugs.map(slug =>
      prisma.tournamentEdition.findFirst({
        where:   { tournament: { canonicalSlug: slug } },
        include: {
          tournament: { include: { organization: true } },
          categories: { orderBy: { visibilityOrder: 'asc' } },
          links:       { where: { linkType: 'registration', isOfficial: true }, take: 1 },
        },
        orderBy: { seasonYear: 'desc' },
      })
    )
  )

  const results = editions.map((edition, idx) => {
    if (!edition) return { slug: slugs[idx], error: 'Não encontrado' }

    const categoriesWithElig = edition.categories.map(cat => {
      const rule: CategoryRule = {
        genderScope:   cat.genderScope ?? undefined,
        classCode:     cat.classCode   ?? undefined,
        minAge:        cat.minAge      ?? undefined,
        maxAge:        cat.maxAge      ?? undefined,
        ageType:       (cat.ageType as any) ?? undefined,
        allowClassUp:  true,
      }
      const eligibility = player
        ? evaluateEligibility(player, rule, year)
        : { status: 'unknown' as const, reasons: ['Faça login para ver elegibilidade'] }

      return {
        id:                cat.id,
        sourceCategoryText: cat.sourceCategoryText,
        normalizedCode:    cat.normalizedCode,
        priceBrl:          cat.priceBrl,
        priceRaw:          cat.priceRaw,
        eligibility,
      }
    })

    const order = { compatible: 0, unknown: 1, incompatible: 2 }
    categoriesWithElig.sort((a, b) => order[a.eligibility.status] - order[b.eligibility.status])

    return {
      id:                    edition.id,
      slug:                  edition.tournament.canonicalSlug,
      name:                  edition.tournament.canonicalName,
      organizationName:      edition.tournament.organization.name,
      organizationShortName: edition.tournament.organization.shortName,
      venueCity:             edition.venueCity,
      venueState:            edition.venueState,
      venueName:             edition.venueName,
      startAt:               edition.startAt,
      endAt:                 edition.endAt,
      entryCloseAt:          edition.entryCloseAt,
      status:                edition.status,
      officialRegUrl:        edition.links[0]?.url ?? null,
      dataConfidence:        edition.dataConfidence,
      categories:            categoriesWithElig,
      totalCompatible:       categoriesWithElig.filter(c => c.eligibility.status === 'compatible').length,
      totalCategories:       categoriesWithElig.length,
    }
  })

  // Detectar conflitos de datas entre os torneios comparados
  const dateConflicts: Array<{ a: string; b: string; reason: string }> = []
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const a = results[i] as any
      const b = results[j] as any
      if (!a.startAt || !b.startAt) continue
      const aStart = new Date(a.startAt), aEnd = new Date(a.endAt ?? a.startAt)
      const bStart = new Date(b.startAt), bEnd = new Date(b.endAt ?? b.startAt)
      if (aStart <= bEnd && bStart <= aEnd) {
        dateConflicts.push({ a: a.slug, b: b.slug, reason: 'Datas sobrepostas — impossível participar dos dois' })
      }
    }
  }

  return NextResponse.json({ tournaments: results, dateConflicts })
}
