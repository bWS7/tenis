'use client'

import { useState } from 'react'
import { TopBar } from '@/components/navigation'
import { Badge } from '@/components/ui/badge'
import { usePlayerProfile } from '@/hooks/use-tennis-data'
import { User, MapPin, Calendar, Trophy, Bell, Shield, ChevronRight, LogOut, Edit3, Loader2, Check, Download, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from 'next-auth/react'

const CLASS_OPTIONS = ['1','2','3','4','5','Principiante']
const STATES = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const LEVEL_LABEL: Record<string, string> = { amateur: 'Amador', federated: 'Federado', youth: 'Juvenil', pro: 'Profissional' }

export default function ProfilePage() {
  const { profile, loading, update } = usePlayerProfile()
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [form,    setForm]    = useState<any>(null)

  function startEdit() {
    if (!profile) return
    const classCode = profile.categories?.find((c: any) => c.taxonomy === 'FPT_CLASS')?.code ?? ''
    setForm({
      displayName:      profile.displayName,
      birthYear:        profile.birthYear,
      gender:           profile.gender ?? '',
      homeState:        profile.homeState ?? '',
      travelRadiusKm:   profile.travelRadiusKm,
      competitiveLevel: profile.competitiveLevel,
      classCode,
    })
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await update({
        ...form,
        categories: form.classCode ? [{ taxonomy: 'FPT_CLASS', code: form.classCode, isPrimary: true }] : [],
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      setEditing(false)
    } catch { /* silently */ }
    setSaving(false)
  }

  async function handleExport() {
    window.location.href = '/api/player-profiles/export'
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={24} className="animate-spin text-brand-400" />
    </div>
  )

  if (!profile) return (
    <div className="px-4 pt-16 text-center">
      <p className="text-gray-400 mb-4">Perfil não encontrado.</p>
    </div>
  )

  const sportAge  = new Date().getFullYear() - profile.birthYear
  const classCode = profile.categories?.find((c: any) => c.taxonomy === 'FPT_CLASS')?.code

  return (
    <div className="animate-fade-in">
      <TopBar
        title="Perfil"
        action={
          <button onClick={editing ? () => setEditing(false) : startEdit}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-600">
            {saved ? <><Check size={14} />Salvo</> : <><Edit3 size={14} />{editing ? 'Cancelar' : 'Editar'}</>}
          </button>
        }
      />

      <div className="px-4 pt-5 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center text-white text-2xl font-bold">
            {profile.displayName[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{profile.displayName}</h2>
            <div className="flex gap-1.5 mt-1.5">
              <Badge variant="brand">{LEVEL_LABEL[profile.competitiveLevel] ?? profile.competitiveLevel}</Badge>
              {classCode && <Badge variant="default">{classCode}ª Classe</Badge>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Classe',    value: classCode ? `${classCode}ª` : '—' },
            { label: 'Idade esp.', value: `${sportAge}` },
            { label: 'Raio',      value: `${profile.travelRadiusKm}km` },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Edição */}
        {editing && form ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
            <h3 className="font-semibold text-gray-800">Editar perfil</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Nome</label>
              <input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Ano nasc.</label>
                <input type="number" min={1940} max={2020} value={form.birthYear}
                  onChange={e => setForm({...form, birthYear: Number(e.target.value)})}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Gênero</label>
                <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Não informar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Classe técnica</label>
                <select value={form.classCode} onChange={e => setForm({...form, classCode: e.target.value})}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Não informar</option>
                  {CLASS_OPTIONS.map(c => <option key={c} value={c}>{c === 'Principiante' ? c : `${c}ª Classe`}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500">Estado</label>
                <select value={form.homeState} onChange={e => setForm({...form, homeState: e.target.value})}
                  className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                  <option value="">Selecione</option>
                  {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500">Raio de viagem: {form.travelRadiusKm} km</label>
              <input type="range" min={25} max={500} step={25} value={form.travelRadiusKm}
                onChange={e => setForm({...form, travelRadiusKm: Number(e.target.value)})}
                className="w-full accent-brand-500" />
              <div className="flex justify-between text-xs text-gray-300"><span>25 km</span><span>500 km</span></div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditing(false)} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 h-10 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        ) : (
          /* Visualização */
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {[
              { icon: User,     label: 'Nível',          value: LEVEL_LABEL[profile.competitiveLevel] ?? profile.competitiveLevel },
              { icon: Trophy,   label: 'Classe técnica',  value: classCode ? `${classCode}ª Classe` : 'Não informada' },
              { icon: Calendar, label: 'Idade esportiva', value: `${sportAge} anos (nascido em ${profile.birthYear})` },
              { icon: MapPin,   label: 'Estado base',     value: profile.homeState ? `${profile.homeState} · até ${profile.travelRadiusKm} km` : 'Não informado' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 px-4 py-3">
                <item.icon size={16} className="text-gray-300 shrink-0" />
                <div><p className="text-xs text-gray-400">{item.label}</p><p className="text-sm font-medium text-gray-700">{item.value}</p></div>
              </div>
            ))}
          </div>
        )}

        {/* Ações LGPD + conta */}
        <div className="space-y-2 pb-4">
          <button onClick={handleExport}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-100 text-sm text-gray-600 hover:bg-gray-50">
            <span className="flex items-center gap-2"><Download size={15} />Exportar meus dados (LGPD)</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-100 text-sm text-gray-600 hover:bg-gray-50">
            <span className="flex items-center gap-2"><LogOut size={15} />Sair da conta</span>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
          <button
            onClick={async () => {
              const pwd = window.prompt('Digite sua senha para confirmar a exclusão permanente:')
              if (!pwd) return
              const res = await fetch('/api/player-profiles/delete', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: pwd }) })
              if (res.ok) { await signOut({ callbackUrl: '/register' }); alert('Conta excluída com sucesso.') }
              else { const d = await res.json(); alert(d.error ?? 'Erro ao excluir conta.') }
            }}
            className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-red-50 text-sm text-red-500 hover:bg-red-50">
            <span className="flex items-center gap-2"><Trash2 size={15} />Excluir minha conta (LGPD)</span>
            <ChevronRight size={16} className="text-red-300" />
          </button>
        </div>
      </div>
    </div>
  )
}
