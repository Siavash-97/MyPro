import { eigeneKennung } from '../lib/eigeneKennung'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  TrainingDiaryEntry,
  TrainingDiaryPainLocation,
  DiaryFeeling,
  BodyLocation,
} from '../types'
import { speicherAnmelden } from '../lib/kontoZustand'

interface DiaryEntryWithPain extends TrainingDiaryEntry {
  training_diary_pain_locations: TrainingDiaryPainLocation[]
}

interface DiaryState {
  entries: DiaryEntryWithPain[]
  loading: boolean

  fetchEntries: (limit?: number) => Promise<void>
  createEntry: (data: {
    entry_date: string
    /** Der Lauf, zu dem der Eintrag gehört – wenn er aus einem Lauf kommt. */
    run_id?: string | null
    distance_km?: number
    duration_minutes?: number
    feeling?: DiaryFeeling
    has_pain: boolean
    pain_locations?: BodyLocation[]
    notes?: string
  }) => Promise<string | null>
}

export const useDiary = create<DiaryState>((set, get) => ({
  entries: [],
  loading: false,

  fetchEntries: async (limit = 30) => {
    set({ loading: true })
    const { data } = await supabase
      .from('training_diary_entries')
      .select('*, training_diary_pain_locations(*)')
      .order('entry_date', { ascending: false })
      .limit(limit)

    set({ entries: (data ?? []) as DiaryEntryWithPain[], loading: false })
  },

  createEntry: async (data) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const { data: entry, error } = await supabase
      .from('training_diary_entries')
      // Die Spaltennamen stammen aus Migration 0006. Vorher stand hier
      // `date` und `pace_min_per_km` – beides gibt es in der Tabelle nicht,
      // und jedes Speichern scheiterte daran.
      .insert({
        user_id: userId,
        run_id: data.run_id ?? null,
        entry_date: data.entry_date,
        distance_km: data.distance_km ?? null,
        duration_minutes: data.duration_minutes ?? null,
        feeling: data.feeling ?? null,
        has_pain: data.has_pain,
        notes: data.notes ?? null,
      })
      .select()
      .single()

    if (error) return error.message

    if (data.has_pain && data.pain_locations && data.pain_locations.length > 0) {
      const rows = data.pain_locations.map((loc) => ({
        diary_entry_id: (entry as TrainingDiaryEntry).id,
        location: loc,
      }))
      const { error: painError } = await supabase
        .from('training_diary_pain_locations')
        .insert(rows)
      if (painError) return painError.message
    }

    await get().fetchEntries()
    return null
  },
}))

// Beim Abmelden zuruecksetzen. Ohne das saehe der naechste Angemeldete auf
// demselben Geraet die Daten des vorigen, bis die erste Abfrage sie
// ueberschreibt. Siehe lib/kontoZustand.ts.
speicherAnmelden(useDiary)
