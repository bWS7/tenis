import { BottomNav } from '@/components/navigation'

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8faf9]">
      <main className="max-w-lg mx-auto pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
