import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  ExerciseWithRelations,
  Equipment,
  MuscleGroup,
  ExerciseCategory,
  ExerciseDifficulty,
  ExerciseModality,
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
  equipment: Equipment[]
  muscleGroups: MuscleGroup[]
  filters: ExerciseFilters
  loading: boolean
  loaded: boolean

  fetchReferenceData: () => Promise<void>
  setFilter: <K extends keyof ExerciseFilters>(key: K, value: ExerciseFilters[K]) => void
  resetFilters: () => void
  filtered: () => ExerciseWithRelations[]
  getExercise: (slug: string) => ExerciseWithRelations | undefined
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
  equipment: [],
  muscleGroups: [],
  filters: { ...INITIAL_FILTERS },
  loading: false,
  loaded: false,

  fetchReferenceData: async () => {
    if (get().loaded || get().loading) return
    set({ loading: true })

    const [exercisesRes, equipmentRes, muscleGroupsRes] = await Promise.all([
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
    ])

    set({
      exercises: (exercisesRes.data ?? []) as ExerciseWithRelations[],
      equipment: (equipmentRes.data ?? []) as Equipment[],
      muscleGroups: (muscleGroupsRes.data ?? []) as MuscleGroup[],
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
}))
