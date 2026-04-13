import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

function validateToken(req: NextRequest) {
  return req.headers.get('X-Internal-Token') === process.env.INTERNAL_SECRET
}

const ClauseSchema = z.object({
  clauseType:   z.string(),
  logicJson:    z.record(z.any()),
  humanText:    z.string(),
  categoryCode: z.string().optional().nullable(),
})

const PayloadSchema = z.object({
  source:        z.string(),
  version:       z.string(),
  sourceUrl:     z.string(),
  effectiveFrom: z.string(),
  clauses:       z.array(ClauseSchema),
})

// POST /api/admin/ingest-rules
// Recebe cláusulas de regras extraídas de PDFs de regulamentos e popula RuleVersion + RuleClause
export async function POST(request: NextRequest) {
  if (!validateToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = PayloadSchema.parse(await request.json())

  // Encontrar ou criar RuleSet para esta fonte
  const ruleSet = await prisma.ruleSet.upsert({
    where:  { id: `rs_${body.source.toLowerCase()}_auto` },
    update: {},
    create: { id: `rs_${body.source.toLowerCase()}_auto`, scope: body.source, name: `${body.source} Regulamento (Auto)` },
  })

  // Criar nova versão de regra (deprecando a anterior se existir)
  await prisma.ruleVersion.updateMany({
    where: { ruleSetId: ruleSet.id, status: 'active' },
    data:  { status: 'deprecated', effectiveTo: new Date() },
  })

  const ruleVersion = await prisma.ruleVersion.create({
    data: {
      ruleSetId:     ruleSet.id,
      version:       body.version,
      effectiveFrom: new Date(body.effectiveFrom),
      sourceUrl:     body.sourceUrl,
      fetchedAt:     new Date(),
      status:        'active',
    },
  })

  // Inserir cláusulas
  await prisma.ruleClause.createMany({
    data: body.clauses.map(c => ({
      ruleVersionId: ruleVersion.id,
      clauseType:    c.clauseType,
      logicJson:     c.logicJson,
      humanText:     c.humanText,
      categoryCode:  c.categoryCode,
    })),
  })

  console.log(`[ingest-rules:${body.source}] version=${body.version} clauses=${body.clauses.length}`)

  return NextResponse.json({
    ok:             true,
    ruleVersionId:  ruleVersion.id,
    clausesCreated: body.clauses.length,
    source:         body.source,
    version:        body.version,
  }, { status: 201 })
}
