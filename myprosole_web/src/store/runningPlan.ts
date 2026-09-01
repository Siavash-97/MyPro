import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { EMPTY_WEEK, PLAN_DAYS, type PlanDayKey, type WeekPlan } from '../lib/runningPlan'
import { speicherAnmelden } from '../lib/kontoZustand'

/**
 * Wochenplan aus der Datenbank (Migration 0013).
 *
 * Ein Plan pro Person, sieben Tageszeilen dazu. Der Speicher haelt den Plan
 * als dieselbe Form, die die Seiten schon verwenden (WeekPlan), damit
 * Laufplan, Uebungen-Tab, Startseite und Zusammenfassung unveraendert damit
 * weiterarbeiten koennen.
 */
interface RunningPlanState {
  plan: WeekPlan
  loaded: boolean
  loading: boolean
  saving: boolean

  fetchPlan: () => Promise<void>
  savePlan: (plan: WeekPlan) => Promise<string | null>
}

interface PlanDayRow {
  weekday: number
  distance_km: number | string
}

function rowsToWeek(rows: PlanDayRow[]): WeekPlan {
  const week: WeekPlan = { ...EMPTY_WEEK }
  for (const row of rows) {
    const day = PLAN_DAYS[row.weekday]
    if (!day) continue
    week[day.key] = String(Number(row.distance_km))
  }
  return week
}

export const useRunningPlan = create<RunningPlanState>((set) => ({
  plan: { ...EMPTY_WEEK },
  loaded: false,
  loading: false,
  saving: false,

  fetchPlan: async () => {
    set({ loading: true })

    const { data: planRow } = await supabase
      .from('running_plans')
      .select('id')
      .maybeSingle()

    if (!planRow) {
      set({ plan: { ...EMPTY_WEEK }, loaded: true, loading: false })
      return
    }

    const { data: dayRows } = await supabase
      .from('running_plan_days')
      .select('weekday, distance_km')
      .eq('plan_id', (planRow as { id: string }).id)
      .order('weekday')

    set({
      plan: rowsToWeek((dayRows ?? []) as PlanDayRow[]),
      loaded: true,
      loading: false,
    })
  },

  savePlan: async (plan) => {
    set({ saving: true })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      set({ saving: false })
      return 'Nicht angemeldet'
    }

    // Ein Plan pro Person: vorhandenen weiterverwenden statt einen zweiten
    // anzulegen – die Eindeutigkeit auf user_id wuerde das ohnehin abweisen.
    const { data: planRow, error: planError } = await supabase
      .from('running_plans')
      .upsert({ user_id: user.id }, { onConflict: 'user_id' })
      .select('id')
      .single()

    if (planError || !planRow) {
      set({ saving: false })
      return planError?.message ?? 'Plan konnte nicht gespeichert werden'
    }

    const planId = (planRow as { id: string }).id
    const { error: dayError } = await supabase
      .from('running_plan_days')
      .upsert(
        PLAN_DAYS.map((day, weekday) => ({
          plan_id: planId,
          weekday,
          distance_km: Number(plan[day.key as PlanDayKey]) || 0,
        })),
        { onConflict: 'plan_id,weekday' },
      )

    set({ saving: false })
    if (dayError) return dayError.message

    set({ plan, loaded: true })
    return null
  },
}))

// Beim Abmelden zuruecksetzen. Ohne das saehe der naechste Angemeldete auf
// demselben Geraet die Daten des vorigen, bis die erste Abfrage sie
// ueberschreibt. Siehe lib/kontoZustand.ts.
speicherAnmelden(useRunningPlan)
