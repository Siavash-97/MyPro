import { useMemo } from 'react';
import type { Person, Task } from '../types';
import { computeMonthBuckets, utilizationCount, tasksForCell } from '../utils/resourceUtilization';
import { parseISO, formatMonthYear } from '../utils/date';

interface Props {
  tasks: Task[];
  people: Person[];
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ResourceUtilization({ tasks, people }: Props) {
  const months = useMemo(() => computeMonthBuckets(tasks), [tasks]);

  if (months.length === 0 || people.length === 0) {
    return <p className="text-xs text-gray-400">Noch keine Daten für eine Auslastungsübersicht.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left font-medium text-gray-500 pr-3 pb-2 sticky left-0 bg-white">Person</th>
            {months.map((m) => (
              <th key={m} className="font-medium text-gray-500 px-2 pb-2 whitespace-nowrap text-center">
                {formatMonthYear(parseISO(m))}
              </th>
            ))}
            <th className="font-medium text-gray-500 pl-3 pb-2 text-right">Summe</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const counts = months.map((m) => utilizationCount(tasks, person.id, m));
            const total = counts.reduce((a, b) => a + b, 0);
            return (
              <tr key={person.id}>
                <td className="pr-3 py-1 font-medium text-gray-700 whitespace-nowrap sticky left-0 bg-white">
                  <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: person.color }} />
                  {person.name}
                </td>
                {months.map((m, i) => {
                  const count = counts[i];
                  const cellTasks = count > 0 ? tasksForCell(tasks, person.id, m) : [];
                  return (
                    <td key={m} className="px-2 py-1 text-center">
                      <div
                        className="mx-auto w-9 h-6 rounded flex items-center justify-center text-[11px] font-medium text-gray-700"
                        style={{ background: count > 0 ? hexToRgba(person.color, Math.min(0.15 + count * 0.22, 1)) : '#f3f4f6' }}
                        title={cellTasks.length ? cellTasks.map((t) => t.title).join(', ') : undefined}
                      >
                        {count > 0 ? count : ''}
                      </div>
                    </td>
                  );
                })}
                <td className="pl-3 py-1 text-right font-medium text-gray-600">{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
