import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const ProfileSchema = z.object({
  displayName:      z.string().min(2).max(60),
  birthYear:        z.number().int().min(1940).max(new Date().getFullYear()),
  gender:           z.enum(['M', 'F']).optional(),
  homeState:        z.string().length(2).optional(),
  travelRadiusKm:   z.number().int().min(25).max(1000).default(100),
  competitiveLevel: z.enum(['amateur', 'federated', 'youth', 'pro']).default('amateur'),
  hasFederationId:  z.boolean().default(false),
  categories: z.array(z.object({
    taxonomy:  z.string(),
    code:      z.string(),
    isPrimary: z.boolean().default(false),
  })).default([]),
})

// GET /api/player-profiles — retorna perfil padrão do usuário logado
export async function GET() {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const profile = await prisma.playerProfile.findFirst({
    where:   { userId: (session.user as any).id, isDefault: true },
    include: { categories: true },
  })

  if (!profile) return NextResponse.json(null)
  return NextResponse.json(profile)
}

// POST /api/player-profiles — cria perfil inicial (onboarding)
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const userId = (session.user as any).id

  try {
    const body = ProfileSchema.parse(await request.json())

    // Verifica se já tem perfil default
    const existing = await prisma.playerProfile.findFirst({
      where: { userId, isDefault: true },
    })

    const profile = existing
      ? await prisma.playerProfile.update({
          where: { id: existing.id },
          data: {
            displayName:      body.displayName,
            birthYear:        body.birthYear,
            gender:           body.gender,
            homeState:        body.homeState,
            travelRadiusKm:   body.travelRadiusKm,
            competitiveLevel: body.competitiveLevel,
          },
        })
      : await prisma.playerProfile.create({
          data: {
            userId,
            displayName:      body.displayName,
            birthYear:        body.birthYear,
            gender:           body.gender,
            homeState:        body.homeState,
            travelRadiusKm:   body.travelRadiusKm,
            competitiveLevel: body.competitiveLevel,
            isDefault:        true,
          },
        })

    // Upsert categorias
    if (body.categories.length > 0) {
      await prisma.playerProfileCategory.deleteMany({ where: { playerProfileId: profile.id } })
      await prisma.playerProfileCategory.createMany({
        data: body.categories.map(c => ({
          playerProfileId: profile.id,
          taxonomy:        c.taxonomy,
          code:            c.code,
          isPrimary:       c.isPrimary,
        })),
      })
    }

    return NextResponse.json({ ok: true, profileId: profile.id }, { status: existing ? 200 : 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('[POST /api/player-profiles]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
