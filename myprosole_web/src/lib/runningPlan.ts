/**
 * Form und Rechenregeln des Wochenplans (laufplan.html).
 *
 * Gespeichert wird in der Datenbank (Migration 0013, store/runningPlan.ts).
 * Hier stehen nur die gemeinsamen Typen und die Auswertung, damit Laufplan,
 * Uebungen-Tab, Startseite und Zusammenfassung dieselbe Rechnung verwenden.
 */
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

/**
 * Mikroroutine des Tages. Das Angebot nach dem Lauf soll nicht nach jedem Lauf
 * kommen (Trainingskonzept v5, D.2) – wer sie heute schon gemacht hat, wird
 * nicht erneut gefragt.
 */
const ROUTINE_DONE_KEY = 'myprosole_routine_erledigt'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function markRoutineDone(): void {
  localStorage.setItem(ROUTINE_DONE_KEY, todayKey())
}

export function isRoutineDoneToday(): boolean {
  return localStorage.getItem(ROUTINE_DONE_KEY) === todayKey()
}

/**
 * Zuordnung eines gelaufenen Laufs zur geplanten Einheit des Tages.
 * Regeln siehe docs/trainingsplan-kopplung.md, Abschnitt 3.3.
 */
export type PlanMatch =
  | { kind: 'done'; plannedKm: number; dayLabel: string }
  | { kind: 'shorter'; plannedKm: number; actualKm: number; dayLabel: string }
  | { kind: 'partial'; plannedKm: number; actualKm: number; dayLabel: string }
  | { kind: 'longer'; plannedKm: number; actualKm: number; dayLabel: string }
  | { kind: 'extra' }

export function matchRunToPlan(plan: WeekPlan, actualKm: number, date = new Date()): PlanMatch {
  const plannedKm = kmForDate(plan, date)
  if (!hasPlan(plan) || plannedKm <= 0) return { kind: 'extra' }

  const dayLabel = PLAN_DAYS[planIndexForDate(date)].label
  const share = (actualKm / plannedKm) * 100

  if (share < 40) return { kind: 'partial', plannedKm, actualKm, dayLabel }
  if (share < 80) return { kind: 'shorter', plannedKm, actualKm, dayLabel }
  if (share > 140) return { kind: 'longer', plannedKm, actualKm, dayLabel }
  return { kind: 'done', plannedKm, dayLabel }
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
