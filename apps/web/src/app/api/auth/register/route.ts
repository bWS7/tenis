import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const RegisterSchema = z.object({
  email:          z.string().email('E-mail inválido'),
  password:       z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
  consentVersion: z.string().default('1.0'),
})

export async function POST(request: NextRequest) {
  try {
    const body = RegisterSchema.parse(await request.json())

    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase().trim() },
    })
    if (existing) {
      return NextResponse.json({ error: 'E-mail já cadastrado.' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(body.password, 12)

    const user = await prisma.user.create({
      data: {
        email:          body.email.toLowerCase().trim(),
        passwordHash,
        role:           'player',
        status:         'active',
        consentVersion: body.consentVersion,
        consentedAt:    new Date(),
      },
      select: { id: true, email: true },
    })

    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('[POST /api/auth/register]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
