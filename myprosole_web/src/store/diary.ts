import { eigeneKennung } from '../lib/eigeneKennung'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  TrainingDiaryEntry,
  TrainingDiaryPainLocation,
  DiaryFeeling,
  BodyLocation,
} from '../types'

interface DiaryEntryWithPain extends TrainingDiaryEntry {
  training_diary_pain_locations: TrainingDiaryPainLocation[]
}

interface DiaryState {
  entries: DiaryEntryWithPain[]
  loading: boolean

  fetchEntries: (limit?: number) => Promise<void>
  createEntry: (data: {
    date: string
    distance_km?: number
    duration_minutes?: number
    pace_min_per_km?: number
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
      .order('date', { ascending: false })
      .limit(limit)

    set({ entries: (data ?? []) as DiaryEntryWithPain[], loading: false })
  },

  createEntry: async (data) => {
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const { data: entry, error } = await supabase
      .from('training_diary_entries')
      .insert({
        user_id: userId,
        date: data.date,
        distance_km: data.distance_km ?? null,
        duration_minutes: data.duration_minutes ?? null,
        pace_min_per_km: data.pace_min_per_km ?? null,
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
