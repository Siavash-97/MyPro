import type { ZoomLevel } from '../types';
import { formatMonthYear, isWeekend, parseISO, toISO, weekNumber } from './date';

export interface HeaderUnit {
  key: string;
  label: string;
  width: number;
  isWeekend?: boolean;
  isToday?: boolean;
  isPast?: boolean;
}

export function buildHeaderUnits(
  rangeStart: string,
  rangeEnd: string,
  zoom: ZoomLevel,
  pxPerDay: number,
  todayISO: string,
): { topUnits: HeaderUnit[]; bottomUnits: HeaderUnit[] } {
  const start = parseISO(rangeStart);
  const end = parseISO(rangeEnd);

  const topUnits: HeaderUnit[] = [];
  const bottomUnits: HeaderUnit[] = [];

  if (zoom === 'day') {
    let cur = new Date(start);
    let curMonthKey = '';
    let curMonthWidth = 0;
    let curMonthDate = new Date(cur);
    while (cur <= end) {
      const monthKey = `${cur.getFullYear()}-${cur.getMonth()}`;
      if (monthKey !== curMonthKey) {
        if (curMonthKey) topUnits.push({ key: curMonthKey, label: formatMonthYear(curMonthDate), width: curMonthWidth });
        curMonthKey = monthKey;
        curMonthWidth = 0;
        curMonthDate = new Date(cur);
      }
      curMonthWidth += pxPerDay;
      const iso = toISO(cur);
      bottomUnits.push({
        key: iso,
        label: cur.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }),
        width: pxPerDay,
        isWeekend: isWeekend(cur),
        isToday: iso === todayISO,
        isPast: iso < todayISO,
      });
      cur.setDate(cur.getDate() + 1);
    }
    if (curMonthKey) topUnits.push({ key: curMonthKey, label: formatMonthYear(curMonthDate), width: curMonthWidth });
    return { topUnits, bottomUnits };
  }

  if (zoom === 'week') {
    let cur = new Date(start);
    cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7));
    let curMonthKey = '';
    let curMonthWidth = 0;
    while (cur <= end) {
      const weekStart = new Date(cur);
      let daysInRange = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        if (d >= start && d <= end) daysInRange++;
        const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
        if (d >= start && d <= end) {
          if (monthKey !== curMonthKey) {
            if (curMonthKey) topUnits.push({ key: curMonthKey + Math.random(), label: formatMonthYear(d), width: curMonthWidth });
            curMonthKey = monthKey;
            curMonthWidth = 0;
          }
          curMonthWidth += pxPerDay;
        }
      }
      if (daysInRange > 0) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        bottomUnits.push({
          key: toISO(weekStart),
          label: `KW${weekNumber(weekStart)}`,
          width: daysInRange * pxPerDay,
          isPast: toISO(weekEnd) < todayISO,
        });
      }
      cur.setDate(cur.getDate() + 7);
    }
    if (curMonthKey) topUnits.push({ key: curMonthKey + '-last', label: topUnits.length ? topUnits[topUnits.length - 1].label : '', width: curMonthWidth });
    return { topUnits, bottomUnits };
  }

  if (zoom === 'month') {
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    let curYearKey = '';
    let curYearWidth = 0;
    while (cur <= end) {
      const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const clampedStart = monthStart < start ? start : monthStart;
      const clampedEnd = monthEnd > end ? end : monthEnd;
      const days = Math.round((clampedEnd.getTime() - clampedStart.getTime()) / 86400000) + 1;
      const yearKey = String(cur.getFullYear());
      if (yearKey !== curYearKey) {
        if (curYearKey) topUnits.push({ key: curYearKey, label: curYearKey, width: curYearWidth });
        curYearKey = yearKey;
        curYearWidth = 0;
      }
      curYearWidth += days * pxPerDay;
      bottomUnits.push({
        key: toISO(monthStart),
        label: monthStart.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        width: days * pxPerDay,
        isPast: toISO(monthEnd) < todayISO,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    if (curYearKey) topUnits.push({ key: curYearKey, label: curYearKey, width: curYearWidth });
    return { topUnits, bottomUnits };
  }

  if (zoom === 'quarter') {
    // Rolling-wave overview: the near term stays readable in days/weeks/
    // months, while quarters (and years, below) let a multi-year plan fit
    // on screen without endless scrolling -- the same "collapse the far
    // future" idea as an outline level, just applied to the time axis.
    const startQuarterMonth = Math.floor(start.getMonth() / 3) * 3;
    let cur = new Date(start.getFullYear(), startQuarterMonth, 1);
    let curYearKey = '';
    let curYearWidth = 0;
    while (cur <= end) {
      const qStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const qEnd = new Date(cur.getFullYear(), cur.getMonth() + 3, 0);
      const clampedStart = qStart < start ? start : qStart;
      const clampedEnd = qEnd > end ? end : qEnd;
      const days = Math.round((clampedEnd.getTime() - clampedStart.getTime()) / 86400000) + 1;
      const yearKey = String(cur.getFullYear());
      if (yearKey !== curYearKey) {
        if (curYearKey) topUnits.push({ key: curYearKey, label: curYearKey, width: curYearWidth });
        curYearKey = yearKey;
        curYearWidth = 0;
      }
      curYearWidth += days * pxPerDay;
      const quarterNum = Math.floor(cur.getMonth() / 3) + 1;
      bottomUnits.push({
        key: toISO(qStart),
        label: `Q${quarterNum} ${String(cur.getFullYear()).slice(2)}`,
        width: days * pxPerDay,
        isPast: toISO(qEnd) < todayISO,
      });
      cur.setMonth(cur.getMonth() + 3);
    }
    if (curYearKey) topUnits.push({ key: curYearKey, label: curYearKey, width: curYearWidth });
    return { topUnits, bottomUnits };
  }

  // year zoom: top row is one unit per year, bottom row is one unit per
  // month (Jan-Dez) -- a multi-year roadmap you scroll through calendar
  // style, like Google Calendar's year view, instead of collapsing each
  // year down to a single unreadable block.
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  let curYearKey = '';
  let curYearWidth = 0;
  while (cur <= end) {
    const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const clampedStart = monthStart < start ? start : monthStart;
    const clampedEnd = monthEnd > end ? end : monthEnd;
    const days = Math.round((clampedEnd.getTime() - clampedStart.getTime()) / 86400000) + 1;
    const yearKey = String(cur.getFullYear());
    if (yearKey !== curYearKey) {
      if (curYearKey) topUnits.push({ key: curYearKey, label: curYearKey, width: curYearWidth });
      curYearKey = yearKey;
      curYearWidth = 0;
    }
    curYearWidth += days * pxPerDay;
    bottomUnits.push({
      key: toISO(monthStart),
      label: monthStart.toLocaleDateString('de-DE', { month: 'short' }),
      width: days * pxPerDay,
      isPast: toISO(monthEnd) < todayISO,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  if (curYearKey) topUnits.push({ key: curYearKey, label: curYearKey, width: curYearWidth });

  return { topUnits, bottomUnits };
}
