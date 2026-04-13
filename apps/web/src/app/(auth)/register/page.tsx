'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2, Shield } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [consent, setConsent]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) { setError('Você precisa aceitar os termos para continuar.'); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, consentVersion: '1.0' }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Erro ao criar conta.')
      setLoading(false)
      return
    }

    // Login automático após registro
    await signIn('credentials', { email, password, redirect: false })
    router.push('/onboarding')
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Criar conta</h1>
        <p className="text-sm text-gray-400 mt-0.5">Grátis. Sem cartão de crédito.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">Senha (mín. 8 caracteres)</label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="w-full h-11 px-3 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Consentimento LGPD */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="mt-0.5 accent-brand-500"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              Li e aceito a{' '}
              <a href="/privacy" target="_blank" className="text-brand-600 underline">Política de Privacidade</a>
              {' '}e os{' '}
              <a href="/terms" target="_blank" className="text-brand-600 underline">Termos de Uso</a>.
              Sei que posso solicitar exclusão dos meus dados a qualquer momento.
            </span>
          </label>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
            <Shield size={11} />
            <span>Dados tratados conforme a LGPD (Lei 13.709/2018)</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-xl border border-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !consent}
          className="w-full h-11 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p className="text-sm text-center text-gray-400">
        Já tem conta?{' '}
        <Link href="/login" className="text-brand-600 font-medium hover:underline">Entrar</Link>
      </p>
    </div>
  )
}
