/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@tennis-hub/core', '@tennis-hub/db'],
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  images: {
    domains: ['localhost'],
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // Ignorar erros de build em variáveis de ambiente ausentes
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:3000',
  },
}
module.exports = nextConfig
