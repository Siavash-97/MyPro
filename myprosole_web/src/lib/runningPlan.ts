/**
 * Der manuell eingetragene Wochenplan (laufplan.html).
 *
 * Liegt vorerst nur auf dem Geraet. Eine eigene Tabelle mit Migration kommt,
 * wenn die Funktionen angeschlossen werden – bis dahin teilen sich Laufplan,
 * Uebungen-Tab und Startseite diese eine Quelle, statt jede Seite ihre eigene
 * Fassung zu lesen.
 */
export const RUNNING_PLAN_STORAGE_KEY = 'myprosole_laufplan'

export const PLAN_DAYS = [
  { key: 'mo', label: 'Mo' },
  { key: 'di', label: 'Di' },
  { key: 'mi', label: 'Mi' },
  { key: 'do', label: 'Do' },
  { key: 'fr', label: 'Fr' },
  { key: 'sa', label: 'Sa' },
  { key: 'so', label: 'So' },
] as const

export type PlanDayKey = (typeof PLAN_DAYS)[number]['key']
export type WeekPlan = Record<PlanDayKey, string>

export const EMPTY_WEEK: WeekPlan = {
  mo: '0', di: '0', mi: '0', do: '0', fr: '0', sa: '0', so: '0',
}

export function readWeekPlan(): WeekPlan {
  try {
    const raw = localStorage.getItem(RUNNING_PLAN_STORAGE_KEY)
    if (!raw) return EMPTY_WEEK
    return { ...EMPTY_WEEK, ...(JSON.parse(raw) as Partial<WeekPlan>) }
  } catch {
    return EMPTY_WEEK
  }
}

export function saveWeekPlan(plan: WeekPlan): void {
  localStorage.setItem(RUNNING_PLAN_STORAGE_KEY, JSON.stringify(plan))
}

/** Ein Plan gilt als vorhanden, sobald an mindestens einem Tag Kilometer stehen. */
export function hasPlan(plan: WeekPlan): boolean {
  return PLAN_DAYS.some((d) => (Number(plan[d.key]) || 0) > 0)
}

export function planTotalKm(plan: WeekPlan): number {
  return PLAN_DAYS.reduce((acc, d) => acc + (Number(plan[d.key]) || 0), 0)
}

/** Montag = 0 … Sonntag = 6, passend zur Reihenfolge in PLAN_DAYS. */
export function planIndexForDate(date: Date): number {
  return (date.getDay() + 6) % 7
}

export function kmForDate(plan: WeekPlan, date: Date): number {
  return Number(plan[PLAN_DAYS[planIndexForDate(date)].key]) || 0
}

/** Die naechsten Tage ab morgen, wie in der Karte "Naechste Tage". */
export function upcomingDays(plan: WeekPlan, count = 7): { label: string; km: number; when: string }[] {
  const out: { label: string; km: number; when: string }[] = []
  for (let offset = 1; offset <= count; offset++) {
    const date = new Date()
    date.setDate(date.getDate() + offset)
    const day = PLAN_DAYS[planIndexForDate(date)]
    out.push({
      label: day.label,
      km: Number(plan[day.key]) || 0,
      when: offset === 1 ? 'Morgen' : offset === 2 ? 'Übermorgen' : '',
    })
  }
  return out
}
