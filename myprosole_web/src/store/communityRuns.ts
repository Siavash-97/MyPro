import { create } from 'zustand'
import { supabase } from '../lib/supabase'

/** Tempoarten mit ihren Beschriftungen und einer kurzen Erklaerung. */
export const TEMPO_ARTEN = [
  { wert: 'easy', label: 'Lockerer Lauf', hinweis: 'Unterhaltung möglich' },
  { wert: 'medium', label: 'Mittel', hinweis: 'zügig, aber nicht hart' },
  { wert: 'intense', label: 'Intensiv', hinweis: 'fordernd' },
  { wert: 'tempo', label: 'Tempolauf', hinweis: 'schnelle Abschnitte' },
  { wert: 'long_run', label: 'Langer Lauf', hinweis: 'Ausdauer, ruhiges Tempo' },
  { wert: 'trail', label: 'Trail', hinweis: 'Gelände, Höhenmeter' },
] as const

export type TempoArt = (typeof TEMPO_ARTEN)[number]['wert']

export const TEMPO_LABEL: Record<TempoArt, string> = Object.fromEntries(
  TEMPO_ARTEN.map((t) => [t.wert, t.label]),
) as Record<TempoArt, string>

export interface CommunityRun {
  id: string
  user_id: string
  location: string
  starts_at: string
  distance_km: number | null
  pace: TempoArt
  note: string | null
  created_at: string
  /** Kommt ueber den Verweis mit; nie die E-Mail-Adresse. */
  profiles: { display_name: string | null } | null
}

interface CommunityRunsState {
  runs: CommunityRun[]
  loading: boolean
  fetchRuns: () => Promise<void>
  createRun: (daten: {
    location: string
    starts_at: string
    distance_km: number | null
    pace: TempoArt
    note: string | null
  }) => Promise<string | null>
  deleteRun: (id: string) => Promise<string | null>
}

export const useCommunityRuns = create<CommunityRunsState>((set, get) => ({
  runs: [],
  loading: false,

  fetchRuns: async () => {
    set({ loading: true })
    // Nur kuenftige Verabredungen. Vergangene bleiben in der Datenbank, aber
    // eine Liste voller abgelaufener Termine hilft niemandem.
    const { data } = await supabase
      .from('community_runs')
      .select('*, profiles(display_name)')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })

    set({ runs: (data ?? []) as CommunityRun[], loading: false })
  },

  createRun: async (daten) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    const { error } = await supabase
      .from('community_runs')
      .insert({ ...daten, user_id: user.id })

    if (error) return error.message
    await get().fetchRuns()
    return null
  },

  deleteRun: async (id) => {
    const { error } = await supabase.from('community_runs').delete().eq('id', id)
    if (error) return error.message
    set((s) => ({ runs: s.runs.filter((r) => r.id !== id) }))
    return null
  },
}))
