import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  ExerciseWithRelations,
  Equipment,
  MuscleGroup,
  ExerciseCategory,
  ExerciseDifficulty,
  ExerciseModality,
  ExerciseGroup,
} from '../types'

interface ExerciseFilters {
  category: ExerciseCategory | null
  difficulty: ExerciseDifficulty | null
  modality: ExerciseModality | null
  muscleGroupId: string | null
  search: string
}

interface ExerciseState {
  exercises: ExerciseWithRelations[]
  /** Die Gruppen der Trainingsseite, in ihrer Reihenfolge. */
  groups: ExerciseGroup[]
  equipment: Equipment[]
  muscleGroups: MuscleGroup[]
  filters: ExerciseFilters
  loading: boolean
  loaded: boolean
  /**
   * Wie oft jede Uebung schon gemacht wurde, nach Uebungskennung.
   * Fehlt ein Eintrag, heisst das null Mal – nicht "unbekannt".
   */
  zaehlungen: Record<string, number>

  fetchReferenceData: () => Promise<void>
  /** Holt die Zaehlungen aus den abgeschlossenen Trainingseinheiten. */
  fetchZaehlungen: () => Promise<void>
  setFilter: <K extends keyof ExerciseFilters>(key: K, value: ExerciseFilters[K]) => void
  resetFilters: () => void
  filtered: () => ExerciseWithRelations[]
  getExercise: (slug: string) => ExerciseWithRelations | undefined
  /** Die Übungen einer Gruppe, in der Reihenfolge ihrer Namen. */
  uebungenDerGruppe: (groupId: string) => ExerciseWithRelations[]
}

const INITIAL_FILTERS: ExerciseFilters = {
  category: null,
  difficulty: null,
  modality: null,
  muscleGroupId: null,
  search: '',
}

export const useExercises = create<ExerciseState>((set, get) => ({
  exercises: [],
  groups: [],
  zaehlungen: {},
  equipment: [],
  muscleGroups: [],
  filters: { ...INITIAL_FILTERS },
  loading: false,
  loaded: false,

  fetchZaehlungen: async () => {
    // Nur abgeschlossene Einheiten zaehlen. Eine abgebrochene sagt nichts
    // darueber aus, ob die Uebung wirklich gemacht wurde.
    //
    // !inner ist noetig, damit der Filter auf den Status wirkt: Ohne ihn
    // waere der Verweis freiwillig, und Zeilen ohne passende Einheit kaemen
    // trotzdem mit – mit workout_logs auf null.
    //
    // Welche Zeilen ueberhaupt sichtbar sind, entscheidet die Zeilenregel
    // aus 0005: nur Einheiten der eigenen Kennung. Ein Filter auf user_id
    // waere hier also nicht nur ueberfluessig, sondern irrefuehrend – er
    // taeuschte vor, die Absicherung liege in der Abfrage.
    const { data, error } = await supabase
      .from('workout_log_exercises')
      .select('exercise_id, workout_logs!inner(status)')
      .eq('workout_logs.status', 'completed')

    if (error) return

    const zaehlungen: Record<string, number> = {}
    for (const zeile of data ?? []) {
      const id = (zeile as { exercise_id: string }).exercise_id
      zaehlungen[id] = (zaehlungen[id] ?? 0) + 1
    }
    set({ zaehlungen })
  },

  fetchReferenceData: async () => {
    if (get().loaded || get().loading) return
    set({ loading: true })

    const [exercisesRes, equipmentRes, muscleGroupsRes, groupsRes] = await Promise.all([
      supabase
        .from('exercises')
        .select(`
          *,
          exercise_muscles(*, muscle_groups(*)),
          exercise_equipment(*, equipment(*))
        `)
        .eq('is_active', true)
        .order('name_de'),
      supabase.from('equipment').select('*').order('name_de'),
      supabase.from('muscle_groups').select('*').order('name_de'),
      supabase
        .from('exercise_groups')
        .select('*')
        .eq('is_active', true)
        .order('position'),
    ])

    set({
      exercises: (exercisesRes.data ?? []) as ExerciseWithRelations[],
      equipment: (equipmentRes.data ?? []) as Equipment[],
      muscleGroups: (muscleGroupsRes.data ?? []) as MuscleGroup[],
      groups: (groupsRes.data ?? []) as ExerciseGroup[],
      loading: false,
      loaded: true,
    })
  },

  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),

  resetFilters: () => set({ filters: { ...INITIAL_FILTERS } }),

  filtered: () => {
    const { exercises, filters } = get()
    return exercises.filter((e) => {
      if (filters.category && e.category !== filters.category) return false
      if (filters.difficulty && e.difficulty !== filters.difficulty) return false
      if (filters.modality && e.modality !== filters.modality) return false
      if (
        filters.muscleGroupId &&
        !e.exercise_muscles.some(
          (em) => em.muscle_group_id === filters.muscleGroupId,
        )
      )
        return false
      if (
        filters.search &&
        !e.name_de.toLowerCase().includes(filters.search.toLowerCase()) &&
        !(e.name_en ?? '').toLowerCase().includes(filters.search.toLowerCase())
      )
        return false
      return true
    })
  },

  getExercise: (slug) => get().exercises.find((e) => e.slug === slug),

  // Die Uebungen kommen schon nach Namen sortiert aus der Datenbank; hier
  // wird nur nach Gruppe getrennt.
  uebungenDerGruppe: (groupId) => get().exercises.filter((e) => e.group_id === groupId),
}))
