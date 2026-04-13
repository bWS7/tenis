'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['Básico', 'Nível', 'Localização', 'Categorias']

const STATES = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
                'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']

const LEVELS = [
  { value: 'amateur',   label: 'Amador',      desc: 'Jogo por lazer e competição local' },
  { value: 'federated', label: 'Federado',     desc: 'Tenho registro em federação estadual' },
  { value: 'youth',     label: 'Juvenil',      desc: 'Jogo no circuito infantojuvenil (CBT)' },
  { value: 'pro',       label: 'Profissional', desc: 'Compito em circuitos nacionais/internacionais' },
]

const CLASSES = ['1','2','3','4','5','Principiante']

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]     = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const [form, setForm] = useState({
    displayName:      '',
    birthYear:        new Date().getFullYear() - 30,
    gender:           '' as 'M' | 'F' | '',
    competitiveLevel: '' as string,
    homeState:        '' as string,
    travelRadiusKm:   100,
    classCode:        '' as string,
    hasFederationId:  false,
  })

  function update(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }))
  }

  const canNext = [
    form.displayName.trim().length >= 2 && form.birthYear >= 1940 && form.gender !== '',
    form.competitiveLevel !== '',
    form.homeState !== '',
    true,
  ][step]

  async function handleFinish() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/player-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          categories: form.classCode
            ? [{ taxonomy: 'FPT_CLASS', code: form.classCode, isPrimary: true }]
            : [],
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      router.push('/home')
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? 'Erro ao salvar perfil.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8faf9] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-3xl">🎾</span>
          <h1 className="text-xl font-bold text-gray-900 mt-2">Configure seu perfil</h1>
          <p className="text-sm text-gray-400 mt-1">Assim encontramos os torneios certos para você</p>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className={cn(
              'flex-1 h-1.5 rounded-full transition-colors',
              i <= step ? 'bg-brand-500' : 'bg-gray-200'
            )} />
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center mb-6">
          Passo {step + 1} de {STEPS.length} — {STEPS[step]}
        </p>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">

          {/* Step 0: Dados básicos */}
          {step === 0 && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Como quer ser chamado?</label>
                <input
                  value={form.displayName}
                  onChange={e => update('displayName', e.target.value)}
                  placeholder="Seu nome ou apelido"
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Ano de nascimento</label>
                <input
                  type="number"
                  min={1940} max={new Date().getFullYear() - 5}
                  value={form.birthYear}
                  onChange={e => update('birthYear', Number(e.target.value))}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <p className="text-xs text-gray-400">
                  Idade esportiva: {new Date().getFullYear() - form.birthYear} anos
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Gênero</label>
                <div className="grid grid-cols-2 gap-3">
                  {[{ v: 'M', l: 'Masculino' }, { v: 'F', l: 'Feminino' }].map(g => (
                    <button key={g.v} type="button"
                      onClick={() => update('gender', g.v)}
                      className={cn(
                        'h-11 rounded-xl border text-sm font-medium transition-all',
                        form.gender === g.v
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
                      )}
                    >{g.l}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 1: Nível competitivo */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Qual é seu perfil de jogador?</p>
              {LEVELS.map(lv => (
                <button key={lv.value} type="button"
                  onClick={() => update('competitiveLevel', lv.value)}
                  className={cn(
                    'w-full text-left p-4 rounded-xl border transition-all',
                    form.competitiveLevel === lv.value
                      ? 'bg-brand-50 border-brand-400'
                      : 'bg-white border-gray-200 hover:border-brand-200'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{lv.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{lv.desc}</p>
                    </div>
                    {form.competitiveLevel === lv.value && (
                      <Check size={16} className="text-brand-500 shrink-0" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Localização */}
          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Seu estado</label>
                <select
                  value={form.homeState}
                  onChange={e => update('homeState', e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="">Selecione seu estado</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500">
                  Raio de viagem: <span className="text-brand-600 font-semibold">{form.travelRadiusKm} km</span>
                </label>
                <input
                  type="range" min={25} max={500} step={25}
                  value={form.travelRadiusKm}
                  onChange={e => update('travelRadiusKm', Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
                <div className="flex justify-between text-xs text-gray-300">
                  <span>25 km</span>
                  <span>500 km</span>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Categorias */}
          {step === 3 && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Qual sua classe técnica? <span className="text-gray-400 font-normal">(opcional)</span></p>
                <div className="grid grid-cols-3 gap-2">
                  {CLASSES.map(c => (
                    <button key={c} type="button"
                      onClick={() => update('classCode', form.classCode === c ? '' : c)}
                      className={cn(
                        'h-11 rounded-xl border text-sm font-medium transition-all',
                        form.classCode === c
                          ? 'bg-brand-500 text-white border-brand-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
                      )}
                    >{c === 'Principiante' ? 'Princ.' : `${c}ª`}</button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  Se não souber, pule — você pode atualizar depois no seu perfil.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasFederationId}
                    onChange={e => update('hasFederationId', e.target.checked)}
                    className="accent-brand-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Sou federado</p>
                    <p className="text-xs text-gray-400">Tenho registro em uma federação estadual</p>
                  </div>
                </label>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-xl border border-red-100">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Navegação */}
        <div className="flex gap-3 mt-4">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-1 h-12 px-4 rounded-xl border border-gray-200 bg-white text-gray-600 font-medium text-sm hover:bg-gray-50"
            >
              <ChevronLeft size={16} /> Voltar
            </button>
          )}

          <button
            onClick={step < STEPS.length - 1 ? () => setStep(s => s + 1) : handleFinish}
            disabled={!canNext || loading}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {step < STEPS.length - 1 ? (
              <><span>Próximo</span><ChevronRight size={16} /></>
            ) : (
              loading ? 'Salvando...' : 'Concluir e entrar'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
