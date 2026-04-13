import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { z } from 'zod'

const OverrideSchema = z.object({
  status:            z.string().optional(),
  venueCity:         z.string().optional(),
  venueState:        z.string().optional(),
  venueName:         z.string().optional(),
  entryCloseAt:      z.string().optional().nullable(),
  officialSourceUrl: z.string().url().optional().nullable(),
  dataConfidence:    z.enum(['low', 'med', 'high']).optional(),
  notes:             z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if ((session?.user as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminId = (session!.user as any).id

  const body = OverrideSchema.parse(await request.json())

  // Busca estado atual para diff
  const before = await prisma.tournamentEdition.findUnique({ where: { id: params.id } })
  if (!before) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const updateData: any = {
    isManualOverride: true,
    reviewedAt:       new Date(),
    reviewedBy:       adminId,
  }

  if (body.status)            updateData.status            = body.status
  if (body.venueCity !== undefined)  updateData.venueCity  = body.venueCity
  if (body.venueState !== undefined) updateData.venueState = body.venueState
  if (body.venueName !== undefined)  updateData.venueName  = body.venueName
  if (body.entryCloseAt !== undefined) {
    updateData.entryCloseAt = body.entryCloseAt ? new Date(body.entryCloseAt) : null
  }
  if (body.officialSourceUrl !== undefined) updateData.officialSourceUrl = body.officialSourceUrl
  if (body.dataConfidence)    updateData.dataConfidence    = body.dataConfidence
  if (body.notes !== undefined)      updateData.notes      = body.notes

  const updated = await prisma.tournamentEdition.update({
    where: { id: params.id },
    data:  updateData,
  })

  // Registra auditoria
  await prisma.auditLog.create({
    data: {
      actorId:    adminId,
      action:     'override',
      entityType: 'TournamentEdition',
      entityId:   params.id,
      diffJson:   {
        before: {
          status:            before.status,
          venueCity:         before.venueCity,
          entryCloseAt:      before.entryCloseAt,
          dataConfidence:    before.dataConfidence,
          officialSourceUrl: before.officialSourceUrl,
        },
        after: updateData,
      },
      reason: body.notes ?? 'Override manual via admin',
    },
  })

  return NextResponse.json({ ok: true, edition: updated })
}
