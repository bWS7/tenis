import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: 'player' | 'admin'
      profileId: string | null
      hasProfile: boolean
    } & DefaultSession['user']
  }

  interface User {
    id: string
    role: 'player' | 'admin'
    profileId: string | null
    hasProfile: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'player' | 'admin'
    profileId: string | null
    hasProfile: boolean
  }
}
