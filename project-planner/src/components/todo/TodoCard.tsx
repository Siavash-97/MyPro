import type { DragEvent, KeyboardEvent } from 'react';
import type { Person, Task, TaskStatus, WorkPackage } from '../../types';
import { formatShort, today } from '../../utils/date';

interface TodoCardProps {
  task: Task;
  status: TaskStatus;
  people: Person[];
  workPackage?: WorkPackage;
  readOnly: boolean;
  onOpen: () => void;
  onToggleCompleted: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function TodoCard({
  task,
  status,
  people,
  workPackage,
  readOnly,
  onOpen,
  onToggleCompleted,
  onDragStart,
  onDragEnd,
}: TodoCardProps) {
  const assignees = task.assigneeIds
    .map((id) => people.find((person) => person.id === id))
    .filter((person): person is Person => Boolean(person));
  const completed = status === 'completed';
  const overdue = !completed && task.end < today();

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  }

  return (
    <article
      data-testid={`todo-card-${task.id}`}
      draggable={!readOnly}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-white shadow-sm transition
        ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}
        ${completed ? 'border-emerald-200/80 opacity-85' : 'border-slate-200 hover:-translate-y-0.5 hover:shadow-md'}
        focus:outline-none focus:ring-2 focus:ring-blue-500/40`}
    >
      <div className="p-3.5 pb-3">
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            disabled={readOnly}
            aria-label={completed ? 'Aufgabe wieder öffnen' : 'Definition of Done prüfen'}
            onClick={(event) => {
              event.stopPropagation();
              onToggleCompleted();
            }}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition
              ${completed
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 bg-white text-transparent hover:border-blue-500'}
              disabled:cursor-default disabled:opacity-60`}
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="m5 10 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h3 className={`text-sm font-semibold leading-5 text-slate-800 ${completed ? 'line-through text-slate-500' : ''}`}>
              {task.title}
            </h3>
            {workPackage && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: workPackage.color }} />
                <span className="truncate">{workPackage.name}</span>
              </div>
            )}
          </div>
          {!readOnly && (
            <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100" aria-hidden="true">
              <circle cx="7" cy="5" r="1.25" fill="currentColor" />
              <circle cx="13" cy="5" r="1.25" fill="currentColor" />
              <circle cx="7" cy="10" r="1.25" fill="currentColor" />
              <circle cx="13" cy="10" r="1.25" fill="currentColor" />
              <circle cx="7" cy="15" r="1.25" fill="currentColor" />
              <circle cx="13" cy="15" r="1.25" fill="currentColor" />
            </svg>
          )}
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3 border-t border-slate-100 pt-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Fällig am</div>
            <div className={`mt-0.5 text-xs font-medium ${overdue ? 'text-red-600' : 'text-slate-600'}`}>
              {formatShort(task.end)}
              {overdue && <span className="ml-1">· überfällig</span>}
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Verantwortlich</div>
            {assignees.length ? (
              <div className="mt-1 flex justify-end -space-x-1.5" title={assignees.map((person) => person.name).join(', ')}>
                {assignees.slice(0, 3).map((person) => (
                  <span
                    key={person.id}
                    className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[9px] font-bold text-white"
                    style={{ backgroundColor: person.color }}
                  >
                    {initials(person.name)}
                  </span>
                ))}
                {assignees.length > 3 && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-500 text-[9px] font-bold text-white">
                    +{assignees.length - 3}
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-0.5 text-xs text-slate-400">Nicht zugewiesen</div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${task.progress}%`, backgroundColor: completed ? '#10b981' : task.color }}
            />
          </div>
          <span className="w-8 text-right text-[10px] font-medium text-slate-400">{task.progress}%</span>
        </div>
      </div>
      <div className="h-1" style={{ backgroundColor: completed ? '#10b981' : task.color }} />
    </article>
  );
}
