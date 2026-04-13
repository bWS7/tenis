import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? 50)

  const runs = await prisma.ingestionRun.findMany({
    include: {
      dataSource: { include: { organization: { select: { shortName: true } } } },
      artifacts:  { select: { id: true } },
    },
    orderBy: { startedAt: 'desc' },
    take:    limit,
  })

  return NextResponse.json(runs)
}

// POST /api/admin/ingestion-runs — trigger manual de um source
export async function POST(request: NextRequest) {
  const session = await getSession()
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { sourceId } = await request.json()
  if (!sourceId) return NextResponse.json({ error: 'sourceId obrigatório' }, { status: 400 })

  const source = await prisma.dataSource.findUnique({ where: { id: sourceId } })
  if (!source) return NextResponse.json({ error: 'Fonte não encontrada' }, { status: 404 })
  if (!source.enabled) return NextResponse.json({ error: 'Fonte está pausada' }, { status: 400 })

  // Cria registro de run
  const run = await prisma.ingestionRun.create({
    data: {
      dataSourceId: sourceId,
      startedAt:    new Date(),
      status:       'running',
    },
  })

  // Em produção: disparar worker via queue (Redis/BullMQ)
  // Por ora retorna o run criado para o frontend acompanhar
  return NextResponse.json({
    ok:    true,
    runId: run.id,
    message: `Job iniciado para fonte "${source.sourceName}". Em produção seria disparado via fila.`,
  })
}
