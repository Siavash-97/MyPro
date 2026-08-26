import { eigeneKennung } from '../lib/eigeneKennung'
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { WorkoutLog } from '../types'
import { speicherAnmelden } from '../lib/kontoZustand'

/*
 * Das Protokoll der Mikroroutine.
 *
 * Die Tabelle heisst workout_logs, weil sie urspruenglich fuer den
 * Gym-Trainingsplan gebaut wurde. Der ist mit Migration 0038 weggefallen;
 * die Tabelle blieb, weil die Mikroroutine schon immer mit hineinschrieb.
 *
 * Was dieser Speicher deshalb nicht mehr kann – und bewusst nicht mehr
 * koennen soll: eine Einheit starten, laufen lassen und Satz fuer Satz
 * eintragen. Das war der Gym-Ablauf. Die Mikroroutine haelt am Ende in
 * einem Zug fest, was gemacht wurde; ein Zwischenstand entsteht nie.
 */

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
  loading: boolean
  /** Gezählte Mikroroutinen der laufenden Woche. */
  mikroroutinenDieseWoche: number

  fetchRecent: (limit?: number) => Promise<void>

  /**
   * Eine beendete Mikroroutine festhalten – auch eine abgebrochene.
   *
   * `erledigt` sind die Übungen, die wirklich gemacht wurden, in der
   * Reihenfolge der Routine; `gesamt` ist deren Gesamtzahl. Wurde nichts
   * gemacht, entsteht keine Zeile.
   */
  mikroroutineFesthalten: (
    // reps ist null bei gehaltenen Uebungen – dort gibt es keine
    // Wiederholungen, und eine erfundene Zahl waere schlechter als nichts.
    erledigt: { exerciseId: string; sets: number; reps: number | null }[],
    gesamt: number,
    begonnenAm: string,
  ) => Promise<string | null>

  /** Zählt die Mikroroutinen ab dem übergebenen Tag (einschließlich). */
  fetchMikroroutinenAb: (ab: Date) => Promise<void>
}

export const useWorkout = create<WorkoutState>((set) => ({
  recentWorkouts: [],
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
        actual_reps: u.reps ?? null,
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

// Beim Abmelden zuruecksetzen. Ohne das saehe der naechste Angemeldete auf
// demselben Geraet die Daten des vorigen, bis die erste Abfrage sie
// ueberschreibt. Siehe lib/kontoZustand.ts.
speicherAnmelden(useWorkout)
