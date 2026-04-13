import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { evaluateEligibility, type PlayerContext, type CategoryRule } from '@tennis-hub/core/eligibility'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getSession()
  const userId  = session?.user ? (session.user as any).id : null

  // Busca edição do torneio pelo slug
  const edition = await prisma.tournamentEdition.findFirst({
    where: { tournament: { canonicalSlug: params.slug } },
    include: {
      categories: true,
      ruleBindings: { include: { ruleVersion: { include: { clauses: true } } } },
    },
    orderBy: { seasonYear: 'desc' },
  })

  if (!edition) return NextResponse.json({ error: 'Torneio não encontrado' }, { status: 404 })

  // Carrega perfil do usuário (se logado)
  let player: PlayerContext | null = null
  if (userId) {
    const profile = await prisma.playerProfile.findFirst({
      where:   { userId, isDefault: true },
      include: { categories: true },
    })
    if (profile) {
      const classCategory = profile.categories.find(c => c.taxonomy === 'FPT_CLASS')
      player = {
        birthYear:       profile.birthYear,
        gender:          profile.gender ?? undefined,
        classCode:       classCategory?.code ?? undefined,
        hasFederationId: profile.competitiveLevel === 'federated',
        hasCPF:          true, // assumido; futuramente checar campo explícito
        stateCode:       profile.homeState ?? undefined,
      }
    }
  }

  const year = new Date().getFullYear()

  const results = edition.categories.map(cat => {
    const rule: CategoryRule = {
      categoryCode:        cat.normalizedCode ?? undefined,
      sourceCategoryText:  cat.sourceCategoryText,
      genderScope:         cat.genderScope ?? undefined,
      classCode:           cat.classCode ?? undefined,
      minAge:              cat.minAge ?? undefined,
      maxAge:              cat.maxAge ?? undefined,
      ageType:             (cat.ageType as any) ?? undefined,
      ruleSource:          edition.ruleBindings[0]?.ruleVersion?.ruleSet ?? 'Fonte oficial',
      ruleVersion:         edition.ruleBindings[0]?.ruleVersion?.version ?? undefined,
      allowClassUp:        true, // padrão FPT
    }

    const eligibility = player
      ? evaluateEligibility(player, rule, year)
      : { status: 'unknown' as const, reasons: ['Faça login para ver sua elegibilidade'] }

    return {
      id:                cat.id,
      sourceCategoryText: cat.sourceCategoryText,
      normalizedCode:    cat.normalizedCode,
      genderScope:       cat.genderScope,
      classCode:         cat.classCode,
      minAge:            cat.minAge,
      maxAge:            cat.maxAge,
      ageType:           cat.ageType,
      priceBrl:          cat.priceBrl,
      priceRaw:          cat.priceRaw,
      eligibility,
    }
  })

  // Ordena: compatible → unknown → incompatible
  const order = { compatible: 0, unknown: 1, incompatible: 2 }
  results.sort((a, b) => order[a.eligibility.status] - order[b.eligibility.status])

  return NextResponse.json({
    tournamentEditionId: edition.id,
    playerProfile:       player ? { birthYear: player.birthYear, gender: player.gender, classCode: player.classCode } : null,
    categories:          results,
    totalCompatible:     results.filter(r => r.eligibility.status === 'compatible').length,
    totalIncompatible:   results.filter(r => r.eligibility.status === 'incompatible').length,
    totalUnknown:        results.filter(r => r.eligibility.status === 'unknown').length,
  })
}
