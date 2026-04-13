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
  if (!source) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const updated = await prisma.dataSource.update({
    where: { id: params.id },
    data:  { enabled: !source.enabled },
  })

  return NextResponse.json({ ok: true, enabled: updated.enabled })
}
