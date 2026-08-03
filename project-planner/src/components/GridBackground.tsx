import { useMemo } from 'react';
import type { ZoomLevel } from '../types';
import { buildHeaderUnits } from '../utils/header';
import { useToday } from '../hooks/useToday';

interface Props {
  rangeStart: string;
  rangeEnd: string;
  zoom: ZoomLevel;
  pxPerDay: number;
  height: number;
}

export function GridBackground({ rangeStart, rangeEnd, zoom, pxPerDay, height }: Props) {
  const todayISO = useToday();
  const { bottomUnits } = useMemo(
    () => buildHeaderUnits(rangeStart, rangeEnd, zoom, pxPerDay, todayISO),
    [rangeStart, rangeEnd, zoom, pxPerDay, todayISO],
  );

  // Plain rgba() instead of Tailwind's bg-*/NN opacity-modifier classes --
  // Tailwind v4 compiles those to color-mix(), which html2canvas-pro (used
  // for chart PNG/PDF export) doesn't reliably composite, rendering fully
  // opaque instead of tinted. See TaskBar.tsx for the same fix.
  function tint(u: (typeof bottomUnits)[number]): string | undefined {
    if (u.isToday) return 'rgba(239, 246, 255, 0.6)'; // blue-50
    if (u.isPast) return 'rgba(243, 244, 246, 0.7)'; // gray-100
    if (u.isWeekend) return 'rgba(249, 250, 251, 0.7)'; // gray-50
    return undefined;
  }

  let x = 0;
  return (
    <div className="absolute inset-0" style={{ height }}>
      {bottomUnits.map((u) => {
        const left = x;
        x += u.width;
        return (
          <div
            key={u.key}
            className="absolute top-0 border-r border-gray-100"
            style={{ left, width: u.width, height, background: tint(u) }}
          />
        );
      })}
    </div>
  );
}
