import type { ZoomLevel } from '../types';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function diffDays(isoA: string, isoB: string): number {
  const a = parseISO(isoA);
  const b = parseISO(isoB);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function today(): string {
  return toISO(new Date());
}

/** Every zoom level uses the same continuous project range. Only the scale
 * changes: detailed day/week views are wide, while month/quarter/year
 * compress the same timeline into progressively smaller units. */
export const PX_PER_DAY: Record<ZoomLevel, number> = {
  day: 44,
  week: 16,
  month: 5,
  quarter: 2,
  year: 0.6,
};

export const ZOOM_LABELS: Record<ZoomLevel, string> = {
  day: 'Tage',
  week: 'Wochen',
  month: 'Monate',
  quarter: 'Quartale',
  year: 'Jahre',
};

export function formatHeaderDay(d: Date): string {
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export function formatShort(iso: string): string {
  return parseISO(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function startOfMonth(iso: string): string {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(iso: string): string {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function addMonths(iso: string, n: number): string {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

/** Like addMonths, but keeps the original day-of-month instead of resetting
 * to the 1st -- e.g. a subscription started on the 31st still recurs near
 * the end of each month. Clamps to the target month's last day when it has
 * fewer days (31 Jan + 1 month -> 28/29 Feb, not a rollover into March). */
export function addMonthsKeepDay(iso: string, n: number): string {
  const d = parseISO(iso);
  const targetMonth = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDayOfTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  targetMonth.setDate(Math.min(d.getDate(), lastDayOfTargetMonth));
  return toISO(targetMonth);
}

export function startOfQuarter(iso: string): string {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1));
}

export function endOfQuarter(iso: string): string {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0));
}

export function addQuarters(iso: string, n: number): string {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + n * 3, 1));
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = (copy.getDay() + 6) % 7; // Monday = 0
  copy.setDate(copy.getDate() - day);
  return copy;
}

export function weekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * DAY_MS));
}
