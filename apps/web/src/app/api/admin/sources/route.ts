import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET /api/admin/sources
export async function GET() {
  const session = await getSession()
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sources = await prisma.dataSource.findMany({
    include: {
      organization:  { select: { name: true, shortName: true } },
      ingestionRuns: { orderBy: { startedAt: 'desc' }, take: 1 },
      _count:         { select: { ingestionRuns: true } },
    },
    orderBy: [{ enabled: 'desc' }, { priority: 'asc' }],
  })

  return NextResponse.json(sources)
}

// POST /api/admin/sources — criar nova fonte
export async function POST(request: NextRequest) {
  const session = await getSession()
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  const source = await prisma.dataSource.create({
    data: {
      organizationId:   body.organizationId,
      sourceName:       body.sourceName,
      sourceType:       body.sourceType ?? 'html',
      baseUrl:          body.baseUrl,
      enabled:          body.enabled ?? true,
      fetchScheduleCron: body.fetchScheduleCron,
      priority:         body.priority ?? 1,
      legalNotes:       body.legalNotes,
    },
  })

  return NextResponse.json({ ok: true, source }, { status: 201 })
}
