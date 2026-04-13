import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// DELETE /api/player-profiles/delete
// Exclui conta e dados do usuário conforme LGPD (RF-027)
// Exige confirmação de senha por segurança
export async function DELETE(request: NextRequest) {
  const session = await getSession()
  if (!session?.user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const userId = (session.user as any).id
  const { password } = await request.json()

  if (!password) {
    return NextResponse.json({ error: 'Confirmação de senha obrigatória para excluir conta' }, { status: 400 })
  }

  // Verificar senha antes de excluir
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return NextResponse.json({ error: 'Senha incorreta' }, { status: 403 })

  // Cascata de exclusão via Prisma (onDelete: Cascade está no schema)
  // A ordem garante que FK constraints sejam respeitadas
  await prisma.$transaction([
    // Notificações → via watchlistItems → via playerProfiles → via users
    prisma.notification.deleteMany({ where: { watchlistItem: { playerProfile: { userId } } } }),
    prisma.watchlistItem.deleteMany({ where: { playerProfile: { userId } } }),
    prisma.playerProfileCategory.deleteMany({ where: { playerProfile: { userId } } }),
    prisma.playerProfile.deleteMany({ where: { userId } }),
    prisma.auditLog.deleteMany({ where: { actorId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ])

  return NextResponse.json({
    ok:      true,
    message: 'Conta e todos os dados associados foram excluídos permanentemente.',
  })
}
