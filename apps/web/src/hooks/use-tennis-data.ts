'use client'

import { useState, useEffect, useCallback } from 'react'

export interface PlayerProfile {
  id: string
  displayName: string
  birthYear: number
  gender: string | null
  homeState: string | null
  travelRadiusKm: number
  competitiveLevel: string
  categories: Array<{ taxonomy: string; code: string; isPrimary: boolean }>
}

export interface CategoryItem {
  id: string
  normalizedCode: string | null
  genderScope: string | null
  classCode: string | null
  minAge: number | null
  maxAge: number | null
  ageType: string | null
}

export interface TournamentItem {
  id: string
  slug: string
  name: string
  organizationName: string
  organizationShortName: string | null
  venueCity: string | null
  venueState: string | null
  startAt: string | null
  endAt: string | null
  entryCloseAt: string | null
  status: string
  categoriesCount: number
  compatibleCount: number
  officialRegUrl: string | null
  dataConfidence: string
  fetchedAt: string | null
  categories?: CategoryItem[]
}

export interface WatchlistItem {
  id: string
  userStatus: string
  createdAt: string
  tournament: TournamentItem & { isWatched: boolean }
}

export interface Notification {
  id: string
  type: string
  subject: string
  readAt: string | null
  createdAt: string
  tournament: { name: string; slug: string }
}

// ─── Player Profile ──────────────────────────────────────────────────────────

export function usePlayerProfile() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/player-profiles')
      .then(r => r.ok ? r.json() : null)
      .then(data => { setProfile(data); setLoading(false) })
      .catch(() => { setError('Erro ao carregar perfil'); setLoading(false) })
  }, [])

  const update = useCallback(async (data: Partial<PlayerProfile>) => {
    const res = await fetch('/api/player-profiles', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setProfile(p => p ? { ...p, ...data } : p)
      return updated
    }
    throw new Error('Falha ao salvar perfil')
  }, [])

  return { profile, loading, error, update }
}

// ─── Tournaments ─────────────────────────────────────────────────────────────

export function useTournaments(params: Record<string, string> = {}) {
  const [tournaments, setTournaments] = useState<TournamentItem[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(true)

  const qs = new URLSearchParams(params).toString()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/tournaments${qs ? `?${qs}` : ''}`)
      .then(r => r.json())
      .then(data => {
        setTournaments(data.items ?? [])
        setTotal(data.total ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [qs])

  return { tournaments, total, loading }
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

export function useEligibility(slug: string) {
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/tournaments/${slug}/eligibility`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [slug])

  return { data, loading }
}

// ─── Tournament Detail ────────────────────────────────────────────────────────

export function useTournament(slug: string) {
  const [tournament, setTournament] = useState<any>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/tournaments/${slug}`)
      .then(r => r.ok ? r.json() : Promise.reject('not found'))
      .then(d => { setTournament(d); setLoading(false) })
      .catch(() => { setError('Torneio não encontrado'); setLoading(false) })
  }, [slug])

  return { tournament, loading, error }
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

export function useWatchlist() {
  const [items, setItems]   = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set())

  const refresh = useCallback(() => {
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(data => {
        const list = data.items ?? []
        setItems(list)
        setWatchedIds(new Set(list.map((i: WatchlistItem) => i.tournament.id)))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const toggle = useCallback(async (tournamentEditionId: string) => {
    const isWatched = watchedIds.has(tournamentEditionId)

    if (isWatched) {
      await fetch(`/api/watchlist?editionId=${tournamentEditionId}`, { method: 'DELETE' })
      setWatchedIds(prev => { const s = new Set(prev); s.delete(tournamentEditionId); return s })
      setItems(prev => prev.filter(i => i.tournament.id !== tournamentEditionId))
    } else {
      await fetch('/api/watchlist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tournamentEditionId }),
      })
      setWatchedIds(prev => new Set([...prev, tournamentEditionId]))
      refresh()
    }
  }, [watchedIds, refresh])

  const updateStatus = useCallback(async (id: string, userStatus: string) => {
    await fetch('/api/watchlist', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, userStatus }),
    })
    setItems(prev => prev.map(i => i.id === id ? { ...i, userStatus } : i))
  }, [])

  return { items, loading, watchedIds, toggle, updateStatus, refresh }
}

// ─── Alerts / Notifications ───────────────────────────────────────────────────

export function useAlerts() {
  const [items, setItems]         = useState<Notification[]>([])
  const [unreadCount, setUnread]  = useState(0)
  const [loading, setLoading]     = useState(true)

  const refresh = useCallback(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(data => {
        setItems(data.items ?? [])
        setUnread(data.unreadCount ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const markRead = useCallback(async (id?: string) => {
    await fetch('/api/alerts', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(id ? { id } : { markAllRead: true }),
    })
    refresh()
  }, [refresh])

  return { items, unreadCount, loading, markRead }
}
