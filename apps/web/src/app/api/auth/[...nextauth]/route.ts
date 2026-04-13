import NextAuth, { type NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    newUser: '/onboarding',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'E-mail',  type: 'email' },
        password: { label: 'Senha',   type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: {
            playerProfiles: {
              where: { isDefault: true },
              take: 1,
            },
          },
        })

        if (!user) return null
        if (user.status === 'locked') throw new Error('Conta bloqueada. Entre em contato com o suporte.')

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return {
          id:            user.id,
          email:         user.email,
          role:          user.role,
          profileId:     user.playerProfiles[0]?.id ?? null,
          hasProfile:    user.playerProfiles.length > 0,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id        = user.id
        token.role      = (user as any).role
        token.profileId = (user as any).profileId
        token.hasProfile = (user as any).hasProfile
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id         = token.id
        ;(session.user as any).role      = token.role
        ;(session.user as any).profileId = token.profileId
        ;(session.user as any).hasProfile = token.hasProfile
      }
      return session
    },
  },
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
