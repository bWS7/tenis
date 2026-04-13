import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const source = await prisma.dataSource.findUnique({ where: { id: params.id } })
  if (!source)         return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  if (!source.enabled) return NextResponse.json({ error: 'Fonte está pausada — ative antes de executar' }, { status: 400 })

  // Cria o registro de run para rastreio
  const run = await prisma.ingestionRun.create({
    data: {
      dataSourceId: params.id,
      startedAt:    new Date(),
      status:       'running',
    },
  })

  // Atualiza lastFetchedAt da fonte
  await prisma.dataSource.update({
    where: { id: params.id },
    data:  { lastFetchedAt: new Date() },
  })

  return NextResponse.json({
    ok:      true,
    runId:   run.id,
    message: `Run ${run.id} criado para "${source.sourceName}". Execute o scraper com RUN_ID=${run.id}.`,
  })
}
