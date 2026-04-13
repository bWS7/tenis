import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Testar conexão com banco
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status:    'ok',
      timestamp: new Date().toISOString(),
      version:   process.env.npm_package_version ?? '0.1.0',
      database:  'connected',
    })
  } catch (err) {
    return NextResponse.json({
      status:   'error',
      database: 'disconnected',
      error:    err instanceof Error ? err.message : 'unknown',
    }, { status: 503 })
  }
}
