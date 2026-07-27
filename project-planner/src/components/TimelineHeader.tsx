import { useMemo } from 'react';
import type { ZoomLevel } from '../types';
import { buildHeaderUnits } from '../utils/header';
import { useToday } from '../hooks/useToday';

interface Props {
  rangeStart: string;
  rangeEnd: string;
  zoom: ZoomLevel;
  pxPerDay: number;
  totalWidth: number;
}

export function TimelineHeader({ rangeStart, rangeEnd, zoom, pxPerDay, totalWidth }: Props) {
  const todayISO = useToday();
  const { topUnits, bottomUnits } = useMemo(
    () => buildHeaderUnits(rangeStart, rangeEnd, zoom, pxPerDay, todayISO),
    [rangeStart, rangeEnd, zoom, pxPerDay, todayISO],
  );

  return (
    <div style={{ width: totalWidth }} className="sticky top-0 z-20 bg-white border-b border-gray-200 select-none">
      <div className="flex h-7 border-b border-gray-100">
        {topUnits.map((u) => (
          <div
            key={u.key}
            style={{ width: u.width }}
            className="flex items-center justify-center text-xs font-semibold text-gray-600 border-r border-gray-100 shrink-0"
          >
            {u.label}
          </div>
        ))}
      </div>
      <div className="flex h-8">
        {bottomUnits.map((u) => (
          <div
            key={u.key}
            style={{ width: u.width }}
            className={`flex items-center justify-center text-[11px] border-r border-gray-100 shrink-0 ${
              u.isToday
                ? 'bg-blue-100 text-blue-700 font-semibold'
                : u.isPast
                  ? 'bg-gray-100 text-gray-300'
                  : u.isWeekend
                    ? 'bg-gray-50 text-gray-400'
                    : 'text-gray-500'
            }`}
          >
            {u.label}
          </div>
        ))}
      </div>
    </div>
  );
}
