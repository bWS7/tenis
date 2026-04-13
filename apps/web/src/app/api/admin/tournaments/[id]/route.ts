import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// GET /api/admin/tournaments/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const edition = await prisma.tournamentEdition.findUnique({
    where: { id: params.id },
    include: {
      tournament: { include: { organization: true } },
      categories: { orderBy: { visibilityOrder: 'asc' } },
      changeEvents: { orderBy: { detectedAt: 'desc' }, take: 20 },
    },
  })

  if (!edition) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  return NextResponse.json(edition)
}
