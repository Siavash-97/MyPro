import type { DragEvent } from 'react';
import type { ChecklistTodoItem } from '../../utils/checklistTodos';
import type { Person } from '../../types';

interface ChecklistTodoCardProps {
  todo: ChecklistTodoItem;
  people: Person[];
  readOnly: boolean;
  onToggle: () => void;
  onOpen: () => void;
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

/** A checklist item mirrored onto the To-Do Kanban as its own lightweight
 * card, next to full task cards. Draggable between all four columns like a
 * task card -- dropping it on "Abgeschlossen" checks it off, dropping it
 * anywhere else un-checks it, same as clicking the round toggle here or the
 * checkbox in the task's checklist tab (all three write the same row). It
 * skips the Definition-of-Done gate task cards have: a checklist step has
 * no such gate to begin with. */
export function ChecklistTodoCard({ todo, people, readOnly, onToggle, onOpen, onDragStart, onDragEnd }: ChecklistTodoCardProps) {
  const assignees = todo.assigneeIds
    .map((id) => people.find((person) => person.id === id))
    .filter((person): person is Person => Boolean(person));
  const completed = todo.status === 'completed';

  return (
    <article
      data-testid={`checklist-todo-card-${todo.id}`}
      draggable={!readOnly}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`group relative overflow-hidden rounded-xl border border-dashed bg-white shadow-sm transition
        ${readOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
        ${completed ? 'border-emerald-200/80 opacity-85' : 'border-slate-300 hover:-translate-y-0.5 hover:shadow-md'}
        focus:outline-none focus:ring-2 focus:ring-blue-500/40`}
    >
      <div className="p-3.5 pb-3">
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            aria-label={completed ? 'Checklistenpunkt wieder öffnen' : 'Checklistenpunkt erledigt'}
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition
              ${completed
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-300 bg-white text-transparent hover:border-blue-500'}`}
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
              <path d="m5 10 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Checkliste</span>
            <h3 className={`text-sm font-semibold leading-5 text-slate-800 ${completed ? 'line-through text-slate-500' : ''}`}>
              {todo.text}
            </h3>
            <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{todo.taskTitle}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end border-t border-slate-100 pt-3">
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
      </div>
    </article>
  );
}
