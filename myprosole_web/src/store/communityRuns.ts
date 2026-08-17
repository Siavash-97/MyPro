import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { eigeneKennung } from '../lib/eigeneKennung'

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

/** Die Felder, die sich anlegen und aendern lassen. */
export interface LaufEingabe {
  city: string
  /** Genauer Treffpunkt – landet in der geschuetzten Tabelle, nicht hier. */
  meetingPoint: string
  starts_at: string
  distance_km: number | null
  pace: TempoArt
  note: string | null
}

interface CommunityRunsState {
  runs: CommunityRun[]
  loading: boolean
  /** Meldung der Datenbank, falls das Laden scheitert. */
  fehler: string | null
  fetchRuns: () => Promise<void>
  createRun: (daten: LaufEingabe) => Promise<string | null>
  /** Aendert eine eigene Verabredung samt Treffpunkt. */
  updateRun: (id: string, daten: LaufEingabe) => Promise<string | null>
  /** Holt den genauen Treffpunkt. Gibt null, wenn man ihn nicht sehen darf. */
  fetchMeetingPoint: (runId: string) => Promise<string | null>
  deleteRun: (id: string) => Promise<string | null>
}

export const useCommunityRuns = create<CommunityRunsState>((set, get) => ({
  runs: [],
  loading: false,
  fehler: null,

  fetchRuns: async () => {
    set({ loading: true })
    // Nur kuenftige Verabredungen. Vergangene bleiben in der Datenbank, aber
    // eine Liste voller abgelaufener Termine hilft niemandem.
    const { data, error } = await supabase
      .from('community_runs')
      .select('*, profiles(display_name)')
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })

    // Fehler nicht verschlucken: Sonst sieht eine gescheiterte Abfrage
    // genauso aus wie "es gibt keine Verabredungen".
    if (error) {
      set({ loading: false, fehler: error.message })
      return
    }

    set({ runs: (data ?? []) as CommunityRun[], loading: false, fehler: null })
  },

  createRun: async ({ meetingPoint, ...oeffentlich }) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const { data, error } = await supabase
      .from('community_runs')
      .insert({ ...oeffentlich, user_id: userId })
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

  updateRun: async (id, { meetingPoint, ...oeffentlich }) => {
    const { error } = await supabase
      .from('community_runs')
      .update(oeffentlich)
      .eq('id', id)
    if (error) return error.message

    // upsert statt update: Bei einer Verabredung aus der Zeit vor der
    // Trennung von Stadt und Treffpunkt gibt es die Zeile noch nicht.
    const { error: ortFehler } = await supabase
      .from('community_run_meeting_points')
      .upsert({ run_id: id, meeting_point: meetingPoint }, { onConflict: 'run_id' })
    if (ortFehler) return ortFehler.message

    await get().fetchRuns()
    return null
  },

  fetchMeetingPoint: async (runId) => {
    const { data } = await supabase
      .from('community_run_meeting_points')
      .select('meeting_point')
      .eq('run_id', runId)
      .maybeSingle()
    return (data as { meeting_point: string } | null)?.meeting_point ?? null
  },

  deleteRun: async (id) => {
    const { error } = await supabase.from('community_runs').delete().eq('id', id)
    if (error) return error.message
    set((s) => ({ runs: s.runs.filter((r) => r.id !== id) }))
    return null
  },
}))
