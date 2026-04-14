import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redirect } from 'next/navigation'

export async function getSession() {
  return getServerSession(authOptions)
}

export async function requireAuth() {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  if ((session.user as any).role !== 'admin') redirect('/home')
  return session
}

export function getProfileId(session: any): string | null {
  return session?.user?.profileId ?? null
}
