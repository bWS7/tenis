import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { slugify } from '@/lib/utils'
import crypto from 'crypto'

// Valida o token interno do scraper
function validateInternalToken(request: NextRequest): boolean {
  const token = request.headers.get('X-Internal-Token')
  return token === process.env.INTERNAL_SECRET
}

const CategorySchema = z.object({
  sourceCategoryText: z.string(),
  normalizedCode:     z.string().optional().nullable(),
  genderScope:        z.string().optional().nullable(),
  classCode:          z.string().optional().nullable(),
  minAge:             z.number().optional().nullable(),
  maxAge:             z.number().optional().nullable(),
  ageType:            z.string().optional().nullable(),
  priceBrl:           z.number().optional().nullable(),
  priceRaw:           z.string().optional().nullable(),
})

const TournamentPayloadSchema = z.object({
  name:             z.string(),
  organizationName: z.string(),
  venueCity:        z.string().optional().nullable(),
  venueState:       z.string().optional().nullable(),
  venueName:        z.string().optional().nullable(),
  startAt:          z.string().optional().nullable(),
  endAt:            z.string().optional().nullable(),
  entryOpenAt:      z.string().optional().nullable(),
  entryCloseAt:     z.string().optional().nullable(),
  status:           z.string().default('unknown'),
  officialSourceUrl: z.string().optional().nullable(),
  rawHtml:          z.string().optional().nullable(),
  dataConfidence:   z.enum(['low', 'med', 'high']).default('med'),
  categories:       z.array(CategorySchema).default([]),
  registrationUrl:  z.string().optional().nullable(),
  regulationUrl:    z.string().optional().nullable(),
})

const IngestPayloadSchema = z.object({
  source:      z.string(),
  runId:       z.string().optional(),
  tournaments: z.array(TournamentPayloadSchema),
})

export async function POST(request: NextRequest) {
  if (!validateInternalToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: z.infer<typeof IngestPayloadSchema>
  try {
    body = IngestPayloadSchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: 'Payload inválido', details: err }, { status: 400 })
  }

  const results = { inserted: 0, updated: 0, errors: 0 }
  const year = new Date().getFullYear()

  for (const t of body.tournaments) {
    try {
      // Encontrar ou criar organização
      let org = await prisma.organization.findFirst({
        where: { name: { contains: t.organizationName, mode: 'insensitive' } },
      })

      if (!org) {
        org = await prisma.organization.create({
          data: {
            name:      t.organizationName,
            shortName: t.organizationName.match(/\b[A-Z]{2,5}\b/)?.[0] ?? null,
            type:      'federation',
            isActive:  true,
          },
        })
      }

      // Encontrar ou criar torneio canônico
      const slug = slugify(t.name)
      let tournament = await prisma.tournament.findUnique({ where: { canonicalSlug: slug } })

      if (!tournament) {
        tournament = await prisma.tournament.create({
          data: {
            canonicalName:  t.name,
            canonicalSlug:  slug,
            organizationId: org.id,
            modalidade:     'tenis',
          },
        })
      }

      // Calcular hash do conteúdo para detectar mudanças
      const contentHash = t.rawHtml
        ? crypto.createHash('sha256').update(t.rawHtml.slice(0, 10000)).digest('hex')
        : null

      // Verificar edição existente
      const existing = await prisma.tournamentEdition.findUnique({
        where: { tournamentId_seasonYear: { tournamentId: tournament.id, seasonYear: year } },
      })

      // Se dados idênticos, pular
      if (existing?.rawHtmlHash && existing.rawHtmlHash === contentHash) {
        continue
      }

      // Detectar mudanças para emitir events
      const changes: any[] = []
      if (existing) {
        if (existing.entryCloseAt?.toISOString() !== (t.entryCloseAt ? new Date(t.entryCloseAt).toISOString() : null)) {
          changes.push({ field: 'entryCloseAt', from: existing.entryCloseAt, to: t.entryCloseAt })
        }
        if (existing.status !== t.status) {
          changes.push({ field: 'status', from: existing.status, to: t.status })
        }
      }

      // Dados da edição
      const editionData = {
        seasonYear:        year,
        startAt:           t.startAt ? new Date(t.startAt) : null,
        endAt:             t.endAt ? new Date(t.endAt) : null,
        entryOpenAt:       t.entryOpenAt ? new Date(t.entryOpenAt) : null,
        entryCloseAt:      t.entryCloseAt ? new Date(t.entryCloseAt) : null,
        status:            t.status,
        venueCity:         t.venueCity,
        venueState:        t.venueState,
        venueName:         t.venueName,
        officialSourceUrl: t.officialSourceUrl,
        sourceName:        body.source,
        fetchedAt:         new Date(),
        rawHtmlHash:       contentHash,
        dataConfidence:    t.dataConfidence,
        dataOrigin:        'scraped' as const,
        // Não sobrescreve override manual
        ...(existing?.isManualOverride ? {} : { isManualOverride: false }),
      }

      const edition = await prisma.tournamentEdition.upsert({
        where: { tournamentId_seasonYear: { tournamentId: tournament.id, seasonYear: year } },
        create: { tournamentId: tournament.id, ...editionData },
        update: existing?.isManualOverride ? { fetchedAt: new Date() } : editionData,
      })

      // Inserir change events
      if (changes.length > 0 && existing) {
        await prisma.tournamentChangeEvent.createMany({
          data: changes.map(c => ({
            tournamentEditionId: edition.id,
            eventType:           c.field === 'status' ? 'status_changed' : 'deadline_changed',
            fieldChangesJson:    c,
            sourceRunId:         body.runId ?? null,
          })),
        })
      }

      // Upsert categorias (apenas se não for override manual)
      if (!existing?.isManualOverride && t.categories.length > 0) {
        // Deleta categorias antigas e recria
        await prisma.tournamentCategory.deleteMany({ where: { tournamentEditionId: edition.id } })
        await prisma.tournamentCategory.createMany({
          data: t.categories.map((cat, i) => ({
            tournamentEditionId: edition.id,
            sourceCategoryText:  cat.sourceCategoryText,
            normalizedCode:      cat.normalizedCode,
            genderScope:         cat.genderScope,
            classCode:           cat.classCode,
            minAge:              cat.minAge,
            maxAge:              cat.maxAge,
            ageType:             cat.ageType,
            priceBrl:            cat.priceBrl,
            priceRaw:            cat.priceRaw,
            visibilityOrder:     i,
          })),
        })
      }

      // Upsert links
      if (t.registrationUrl) {
        await prisma.tournamentLink.upsert({
          where: {
            id: `${edition.id}_reg`,
          },
          create: {
            id:                  `${edition.id}_reg`,
            tournamentEditionId: edition.id,
            linkType:            'registration',
            url:                 t.registrationUrl,
            isOfficial:          true,
            sourceName:          body.source,
            fetchedAt:           new Date(),
          },
          update: { url: t.registrationUrl, fetchedAt: new Date() },
        })
      }

      existing ? results.updated++ : results.inserted++
    } catch (err) {
      console.error(`[ingest] Erro ao processar "${t.name}":`, err)
      results.errors++
    }
  }

  console.log(`[ingest:${body.source}] inserted=${results.inserted} updated=${results.updated} errors=${results.errors}`)

  return NextResponse.json({
    ok: true,
    source: body.source,
    ...results,
  })
}
