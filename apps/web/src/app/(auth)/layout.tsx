export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-white">
            <span className="text-3xl">🎾</span>
            <span className="text-2xl font-bold tracking-tight">Tennis Hub</span>
          </div>
          <p className="text-brand-200 text-sm mt-1">Seu hub de torneios no Brasil</p>
        </div>
        {children}
      </div>
    </div>
  )
}
