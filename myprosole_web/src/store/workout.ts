import { eigeneKennung } from '../lib/eigeneKennung'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type {
  WorkoutLog,
  WorkoutLogWithExercises,
  WorkoutLogExercise,
} from '../types'

/**
 * Zählregel der Mikroroutine (Migration 0030): Ein Abbruch zählt voll, wenn
 * mindestens die Hälfte der Übungen gemacht wurde. Übersprungene zählen
 * nicht mit – sonst wäre "durchgeklickt" dasselbe wie "gemacht".
 */
export function mikroroutineZaehlt(erledigt: number, gesamt: number): boolean {
  return gesamt > 0 && erledigt > 0 && erledigt * 2 >= gesamt
}

interface WorkoutState {
  recentWorkouts: WorkoutLog[]
  activeWorkout: WorkoutLogWithExercises | null
  loading: boolean
  /** Gezählte Mikroroutinen der laufenden Woche. */
  mikroroutinenDieseWoche: number

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

  /**
   * Eine beendete Mikroroutine festhalten – auch eine abgebrochene.
   *
   * `erledigt` sind die Übungen, die wirklich gemacht wurden, in der
   * Reihenfolge der Routine; `gesamt` ist deren Gesamtzahl. Wurde nichts
   * gemacht, entsteht keine Zeile.
   */
  mikroroutineFesthalten: (
    erledigt: { exerciseId: string; sets: number; reps: number }[],
    gesamt: number,
    begonnenAm: string,
  ) => Promise<string | null>

  /** Zählt die Mikroroutinen ab dem übergebenen Tag (einschließlich). */
  fetchMikroroutinenAb: (ab: Date) => Promise<void>
}

export const useWorkout = create<WorkoutState>((set, get) => ({
  recentWorkouts: [],
  activeWorkout: null,
  loading: false,
  mikroroutinenDieseWoche: 0,

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
    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    const { data, error } = await supabase
      .from('workout_logs')
      .insert({
        user_id: userId,
        gym_plan_id: gymPlanId ?? null,
        status: 'in_progress' as const,
      })
      .select()
      .single()

    if (error || !data) return error?.message ?? 'Workout konnte nicht gestartet werden'
    const workoutId = (data as WorkoutLog).id

    // Die Uebungen des Plans in das Protokoll uebernehmen. Ohne diesen
    // Schritt startete die Sitzung mit einer leeren Liste und galt sofort als
    // beendet - der Knopf "Workout starten" wirkte kaputt.
    //
    // Die Vorgaben aus dem Plan werden als Ausgangswerte uebernommen. Was
    // tatsaechlich geschafft wurde, traegt die Sitzung danach ein.
    if (gymPlanId) {
      const { data: planUebungen } = await supabase
        .from('gym_plan_exercises')
        .select('exercise_id, position, sets, reps, weight_kg, duration_seconds')
        .eq('gym_plan_id', gymPlanId)
        .order('position', { ascending: true })

      if (planUebungen?.length) {
        const { error: kopierFehler } = await supabase
          .from('workout_log_exercises')
          .insert(
            planUebungen.map((u, i) => ({
              workout_log_id: workoutId,
              exercise_id: u.exercise_id,
              // Neu durchnummeriert: Im Plan koennen nach dem Loeschen
              // einzelner Uebungen Luecken stehen, und die Position muss hier
              // fortlaufend und eindeutig sein.
              position: i + 1,
              actual_sets: u.sets,
              actual_reps: u.reps,
              weight_kg: u.weight_kg,
              duration_seconds: u.duration_seconds,
            })),
          )

        // Ein Protokoll ohne Uebungen ist wertlos - dann lieber gar keins.
        if (kopierFehler) {
          await supabase.from('workout_logs').delete().eq('id', workoutId)
          return kopierFehler.message
        }
      }
    }

    await get().fetchWorkout(workoutId)
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

  mikroroutineFesthalten: async (erledigt, gesamt, begonnenAm) => {
    // Gar nichts gemacht heisst: nichts festzuhalten. Eine leere Einheit im
    // Protokoll wuerde spaeter nur die Frage aufwerfen, was das war.
    if (erledigt.length === 0) return null

    const userId = eigeneKennung()
    if (!userId) return 'Nicht angemeldet'

    // Beide Zeitpunkte aus derselben Uhr. Wuerde started_at der Vorgabewert
    // der Datenbank sein und ended_at aus dem Browser kommen, koennte eine
    // leicht nachgehende Geraeteuhr die Bedingung "ended_at >= started_at"
    // verletzen.
    const { data, error } = await supabase
      .from('workout_logs')
      .insert({
        user_id: userId,
        source: 'mikroroutine' as const,
        status: mikroroutineZaehlt(erledigt.length, gesamt)
          ? ('completed' as const)
          : ('abandoned' as const),
        started_at: begonnenAm,
        ended_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !data) return error?.message ?? 'Einheit konnte nicht gespeichert werden'

    // Die einzelnen Uebungen dazu, damit der vorhandene Uebungszaehler die
    // Mikroroutine mitzaehlt - er liest ueber workout_log_exercises.
    const { error: uebungFehler } = await supabase.from('workout_log_exercises').insert(
      erledigt.map((u, i) => ({
        workout_log_id: (data as WorkoutLog).id,
        exercise_id: u.exerciseId,
        position: i + 1,
        actual_sets: u.sets,
        actual_reps: u.reps,
      })),
    )

    // Die Einheit steht auch ohne die Einzelheiten - nur der Uebungszaehler
    // bliebe stehen. Das ist kein Grund, die Einheit wieder zu verwerfen.
    return uebungFehler ? uebungFehler.message : null
  },

  fetchMikroroutinenAb: async (ab) => {
    // Nur die gezaehlten: abgebrochene Routinen unter der Schwelle stehen als
    // 'abandoned' in der Tabelle und bleiben dort, zaehlen aber nicht.
    const { count } = await supabase
      .from('workout_logs')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'mikroroutine')
      .eq('status', 'completed')
      .gte('started_at', ab.toISOString())

    set({ mikroroutinenDieseWoche: count ?? 0 })
  },
}))
