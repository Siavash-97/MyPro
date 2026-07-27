import { xForDate } from '../utils/layout';
import { useToday } from '../hooks/useToday';

interface Props {
  rangeStart: string;
  pxPerDay: number;
  height: number;
}

export function TodayLine({ rangeStart, pxPerDay, height }: Props) {
  const todayISO = useToday();
  const x = xForDate(rangeStart, todayISO, pxPerDay) + pxPerDay / 2;
  return (
    <div
      className="absolute top-0 w-0 border-l-2 border-red-400 pointer-events-none z-10"
      style={{ left: x, height }}
      title="Heute"
    />
  );
}
