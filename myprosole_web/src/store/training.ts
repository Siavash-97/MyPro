import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  GymPlan,
  GymPlanWithExercises,
} from '../types'

interface TrainingState {
  plans: GymPlan[]
  activePlan: GymPlanWithExercises | null
  loading: boolean

  fetchPlans: () => Promise<void>
  fetchPlan: (id: string) => Promise<void>
  createPlan: (name: string, description?: string) => Promise<string | null>
  deletePlan: (id: string) => Promise<string | null>
  addExerciseToPlan: (
    planId: string,
    exerciseId: string,
    opts: { sets?: number; reps?: number; duration_seconds?: number; notes?: string },
  ) => Promise<string | null>
  removeExerciseFromPlan: (planExerciseId: string) => Promise<string | null>
  updatePlanEquipment: (planId: string, equipmentIds: string[]) => Promise<string | null>
}

export const useTraining = create<TrainingState>((set, get) => ({
  plans: [],
  activePlan: null,
  loading: false,

  fetchPlans: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('gym_plans')
      .select('*')
      .order('created_at', { ascending: false })

    set({ plans: (data ?? []) as GymPlan[], loading: false })
  },

  fetchPlan: async (id) => {
    set({ loading: true })
    const { data } = await supabase
      .from('gym_plans')
      .select(`
        *,
        gym_plan_exercises(*, exercises(*)),
        gym_plan_equipment(*, equipment(*))
      `)
      .eq('id', id)
      .single()

    set({ activePlan: (data as GymPlanWithExercises) ?? null, loading: false })
  },

  createPlan: async (name, description) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'Nicht angemeldet'

    const { data, error } = await supabase
      .from('gym_plans')
      .insert({ user_id: user.id, name, description: description ?? null })
      .select()
      .single()

    if (error) return error.message
    set((s) => ({ plans: [data as GymPlan, ...s.plans] }))
    return null
  },

  deletePlan: async (id) => {
    const { error } = await supabase.from('gym_plans').delete().eq('id', id)
    if (error) return error.message
    set((s) => ({
      plans: s.plans.filter((p) => p.id !== id),
      activePlan: s.activePlan?.id === id ? null : s.activePlan,
    }))
    return null
  },

  addExerciseToPlan: async (planId, exerciseId, opts) => {
    const plan = get().activePlan
    const nextPosition = plan
      ? Math.max(0, ...plan.gym_plan_exercises.map((e) => e.position)) + 1
      : 1

    const { error } = await supabase.from('gym_plan_exercises').insert({
      gym_plan_id: planId,
      exercise_id: exerciseId,
      position: nextPosition,
      sets: opts.sets ?? null,
      reps: opts.reps ?? null,
      duration_seconds: opts.duration_seconds ?? null,
      notes: opts.notes ?? null,
    })

    if (error) return error.message
    await get().fetchPlan(planId)
    return null
  },

  removeExerciseFromPlan: async (planExerciseId) => {
    const plan = get().activePlan
    const { error } = await supabase
      .from('gym_plan_exercises')
      .delete()
      .eq('id', planExerciseId)

    if (error) return error.message
    if (plan) await get().fetchPlan(plan.id)
    return null
  },

  updatePlanEquipment: async (planId, equipmentIds) => {
    await supabase
      .from('gym_plan_equipment')
      .delete()
      .eq('gym_plan_id', planId)

    if (equipmentIds.length > 0) {
      const rows = equipmentIds.map((eid) => ({
        gym_plan_id: planId,
        equipment_id: eid,
      }))
      const { error } = await supabase
        .from('gym_plan_equipment')
        .insert(rows)
      if (error) return error.message
    }

    await get().fetchPlan(planId)
    return null
  },
}))
