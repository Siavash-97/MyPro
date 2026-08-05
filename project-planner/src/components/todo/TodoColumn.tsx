import type { DragEvent, ReactNode } from 'react';
import type { TaskStatus } from '../../types';

interface TodoColumnProps {
  status: TaskStatus;
  title: string;
  count: number;
  accent: string;
  active: boolean;
  readOnly: boolean;
  children: ReactNode;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
}

export function TodoColumn({
  status,
  title,
  count,
  accent,
  active,
  readOnly,
  children,
  onDragOver,
  onDragLeave,
  onDrop,
}: TodoColumnProps) {
  return (
    <section
      data-testid={`todo-column-${status}`}
      onDragOver={readOnly ? undefined : onDragOver}
      onDragLeave={readOnly ? undefined : onDragLeave}
      onDrop={readOnly ? undefined : onDrop}
      className={`flex min-h-[32rem] flex-col rounded-2xl border p-3 transition-colors
        ${active ? 'border-blue-400 bg-blue-50/70 ring-2 ring-blue-200' : 'border-slate-200 bg-slate-50/80'}`}
    >
      <header className="mb-3 flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
          <h2 className="text-sm font-bold text-slate-700">{title}</h2>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200">
          {count}
        </span>
      </header>
      <div className="mb-3 h-0.5 rounded-full" style={{ backgroundColor: accent }} />
      <div className="flex flex-1 flex-col gap-3">
        {children}
        {count === 0 && (
          <div className={`flex min-h-28 flex-1 items-center justify-center rounded-xl border border-dashed text-center text-xs
            ${active ? 'border-blue-400 bg-white/70 text-blue-600' : 'border-slate-300 text-slate-400'}`}>
            {active ? 'Hier ablegen' : 'Keine Aufgaben'}
          </div>
        )}
      </div>
    </section>
  );
}
