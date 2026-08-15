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
  /** Stadt oder Stadtteil – oeffentlich sichtbar. */
  city: string
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
    city: string
    /** Genauer Treffpunkt – landet in der geschuetzten Tabelle, nicht hier. */
    meetingPoint: string
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

  createRun: async ({ meetingPoint, ...oeffentlich }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    const { data, error } = await supabase
      .from('community_runs')
      .insert({ ...oeffentlich, user_id: user.id })
      .select('id')
      .single()

    if (error || !data) return error?.message ?? 'Verabredung konnte nicht angelegt werden'

    // Der genaue Treffpunkt kommt in die geschuetzte Tabelle. Scheitert das,
    // steht sonst eine Verabredung ohne Treffpunkt da – deshalb wird sie
    // wieder entfernt statt halb angelegt zu bleiben.
    const { error: ortFehler } = await supabase
      .from('community_run_meeting_points')
      .insert({ run_id: data.id, meeting_point: meetingPoint })

    if (ortFehler) {
      await supabase.from('community_runs').delete().eq('id', data.id)
      return ortFehler.message
    }

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
