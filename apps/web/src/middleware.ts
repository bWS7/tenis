import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // Admin: apenas role=admin
    if (pathname.startsWith('/admin') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/home', req.url))
    }

    // Onboarding: redireciona quem não tem perfil
    if (
      token &&
      !(token as any).hasProfile &&
      !pathname.startsWith('/onboarding') &&
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/login')
    ) {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        // Rotas públicas
        if (pathname.startsWith('/login') || pathname.startsWith('/register')) return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|api/auth).*)',
  ],
}
