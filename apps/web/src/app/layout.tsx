import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Tennis Hub — Torneios de Tênis no Brasil',
    template: '%s | Tennis Hub',
  },
  description:
    'Descubra torneios compatíveis com seu perfil, entenda sua elegibilidade e não perca nenhum prazo de inscrição.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    title: 'Tennis Hub',
    description: 'Seu hub de torneios de tênis no Brasil',
  },
}

export const viewport: Viewport = {
  themeColor: '#25976A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-[#f8faf9] antialiased">
        {children}
      </body>
    </html>
  )
}
