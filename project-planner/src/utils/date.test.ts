import { describe, expect, it } from 'vitest';
import { addDays, diffDays, endOfMonth, startOfMonth } from './date';
import { buildHeaderUnits } from './header';

describe('calendar date helpers', () => {
  it('handles leap days without timezone drift', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(diffDays('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('returns complete month boundaries', () => {
    expect(startOfMonth('2027-08-19')).toBe('2027-08-01');
    expect(endOfMonth('2027-02-19')).toBe('2027-02-28');
    expect(endOfMonth('2028-02-19')).toBe('2028-02-29');
  });
});

describe('year timeline header', () => {
  it('always builds exactly twelve month units for a full year', () => {
    const pxPerDay = 1200 / 365;
    const units = buildHeaderUnits('2027-01-01', '2027-12-31', 'year', pxPerDay, '2026-08-05');

    expect(units.topUnits).toHaveLength(1);
    expect(units.topUnits[0].label).toBe('2027');
    expect(units.bottomUnits).toHaveLength(12);
    expect(units.bottomUnits.map((unit) => unit.label)).toEqual([
      'Jan',
      'Feb',
      'Mär',
      'Apr',
      'Mai',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Okt',
      'Nov',
      'Dez',
    ]);
    expect(units.bottomUnits.reduce((sum, unit) => sum + unit.width, 0)).toBeCloseTo(1200, 8);
  });
});
