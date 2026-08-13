import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  WorkoutLog,
  WorkoutLogWithExercises,
  WorkoutLogExercise,
} from '../types'

interface WorkoutState {
  recentWorkouts: WorkoutLog[]
  activeWorkout: WorkoutLogWithExercises | null
  loading: boolean

  fetchRecent: (limit?: number) => Promise<void>
  fetchWorkout: (id: string) => Promise<void>
  startWorkout: (gymPlanId?: string) => Promise<string | null>
  completeWorkout: (id: string, notes?: string) => Promise<string | null>
  abandonWorkout: (id: string) => Promise<string | null>
  logExercise: (
    workoutId: string,
    exerciseId: string,
    data: {
      position: number
      actual_sets?: number
      actual_reps?: number
      weight_kg?: number
      duration_seconds?: number
      notes?: string
    },
  ) => Promise<string | null>
  updateLogExercise: (
    id: string,
    data: Partial<Pick<WorkoutLogExercise, 'actual_sets' | 'actual_reps' | 'weight_kg' | 'duration_seconds' | 'notes'>>,
  ) => Promise<string | null>
}

export const useWorkout = create<WorkoutState>((set, get) => ({
  recentWorkouts: [],
  activeWorkout: null,
  loading: false,

  fetchRecent: async (limit = 20) => {
    set({ loading: true })
    const { data } = await supabase
      .from('workout_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    set({ recentWorkouts: (data ?? []) as WorkoutLog[], loading: false })
  },

  fetchWorkout: async (id) => {
    set({ loading: true })
    const { data } = await supabase
      .from('workout_logs')
      .select(`
        *,
        gym_plans(*),
        workout_log_exercises(*, exercises(*))
      `)
      .eq('id', id)
      .single()

    set({ activeWorkout: (data as WorkoutLogWithExercises) ?? null, loading: false })
  },

  startWorkout: async (gymPlanId) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    const { data, error } = await supabase
      .from('workout_logs')
      .insert({
        user_id: user.id,
        gym_plan_id: gymPlanId ?? null,
        status: 'in_progress' as const,
      })
      .select()
      .single()

    if (error) return error.message
    await get().fetchWorkout((data as WorkoutLog).id)
    return null
  },

  completeWorkout: async (id, notes) => {
    const { error } = await supabase
      .from('workout_logs')
      .update({
        status: 'completed' as const,
        ended_at: new Date().toISOString(),
        notes: notes ?? null,
      })
      .eq('id', id)

    if (error) return error.message
    set({ activeWorkout: null })
    return null
  },

  abandonWorkout: async (id) => {
    const { error } = await supabase
      .from('workout_logs')
      .update({
        status: 'abandoned' as const,
        ended_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) return error.message
    set({ activeWorkout: null })
    return null
  },

  logExercise: async (workoutId, exerciseId, data) => {
    const { error } = await supabase.from('workout_log_exercises').insert({
      workout_log_id: workoutId,
      exercise_id: exerciseId,
      position: data.position,
      actual_sets: data.actual_sets ?? null,
      actual_reps: data.actual_reps ?? null,
      weight_kg: data.weight_kg ?? null,
      duration_seconds: data.duration_seconds ?? null,
      notes: data.notes ?? null,
    })

    if (error) return error.message
    await get().fetchWorkout(workoutId)
    return null
  },

  updateLogExercise: async (id, data) => {
    const { error } = await supabase
      .from('workout_log_exercises')
      .update(data)
      .eq('id', id)

    if (error) return error.message
    const workout = get().activeWorkout
    if (workout) await get().fetchWorkout(workout.id)
    return null
  },
}))
