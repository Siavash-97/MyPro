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

  let x = 0;
  return (
    <div className="absolute inset-0" style={{ height }}>
      {bottomUnits.map((u) => {
        const left = x;
        x += u.width;
        return (
          <div
            key={u.key}
            className={`absolute top-0 border-r border-gray-100 ${
              u.isToday ? 'bg-blue-50/60' : u.isPast ? 'bg-gray-100/70' : u.isWeekend ? 'bg-gray-50/70' : ''
            }`}
            style={{ left, width: u.width, height }}
          />
        );
      })}
    </div>
  );
}
