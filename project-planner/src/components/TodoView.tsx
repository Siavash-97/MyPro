import { useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useRoleStore } from '../store/useRoleStore';
import { applyTodoOrder, useTodoOrderStore } from '../store/useTodoOrderStore';
import { hasChildren } from '../utils/hierarchy';
import { diffDays, formatShort, today } from '../utils/date';
import { normalizeTaskStatus, TASK_STATUSES, TASK_STATUS_LABELS } from '../utils/taskStatus';
import { buildChecklistTodos, filterChecklistTodosByPerson } from '../utils/checklistTodos';
import { useAllChecklistItems } from '../hooks/useAllChecklistItems';
import { toggleChecklistItem, setChecklistItemStatus } from '../lib/checklist';
import type { TaskStatus } from '../types';
import { TodoCard } from './todo/TodoCard';
import { ChecklistTodoCard } from './todo/ChecklistTodoCard';
import { TodoColumn } from './todo/TodoColumn';

const COLUMN_ACCENTS: Record<TaskStatus, string> = {
  not_started: '#94a3b8',
  in_progress: '#3b82f6',
  waiting: '#f59e0b',
  completed: '#10b981',
};

export function TodoView() {
  const tasks = useProjectStore((state) => state.tasks);
  const people = useProjectStore((state) => state.people);
  const workPackages = useProjectStore((state) => state.workPackages);
  const personFilter = useProjectStore((state) => state.personFilter);
  const setPersonFilter = useProjectStore((state) => state.setPersonFilter);
  const startNewTask = useProjectStore((state) => state.startNewTask);
  const setEditingTask = useProjectStore((state) => state.setEditingTask);
  const setTaskStatus = useProjectStore((state) => state.setTaskStatus);
  const isViewer = useRoleStore((state) => state.role === 'viewer');
  const checklistItems = useAllChecklistItems('todo-view');
  const checklistTodos = useMemo(
    () => filterChecklistTodosByPerson(buildChecklistTodos(checklistItems, tasks), personFilter),
    [checklistItems, tasks, personFilter],
  );
  const todoOrder = useTodoOrderStore((state) => state.order);
  const reorderTodos = useTodoOrderStore((state) => state.reorder);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedChecklistItemId, setDraggedChecklistItemId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const t0 = today();

  const naturalTodos = useMemo(
    () => tasks
      .filter((task) => task.type === 'task' && !hasChildren(tasks, task.id))
      .filter((task) => !personFilter || task.assigneeIds.includes(personFilter))
      .sort((a, b) => a.end.localeCompare(b.end) || a.title.localeCompare(b.title)),
    [tasks, personFilter],
  );
  // A manual drag-to-reorder preference layered on top of the natural
  // (due-date) sort -- purely a per-device display order, see
  // useTodoOrderStore. Never changes task.start/end/status/progress.
  const todos = useMemo(() => applyTodoOrder(naturalTodos, todoOrder), [naturalTodos, todoOrder]);

  const milestones = useMemo(
    () => tasks
      .filter((task) => task.type === 'milestone')
      .sort((a, b) => a.start.localeCompare(b.start)),
    [tasks],
  );

  function handleDragStart(event: DragEvent<HTMLElement>, taskId: string) {
    setDraggedTaskId(taskId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-myprosole-task', taskId);
    event.dataTransfer.setData('text/plain', taskId);
  }

  function handleChecklistDragStart(event: DragEvent<HTMLElement>, itemId: string) {
    setDraggedChecklistItemId(itemId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-myprosole-checklist-item', itemId);
    event.dataTransfer.setData('text/plain', itemId);
  }

  // A distinct MIME type (rather than reusing text/plain, which both drag
  // kinds also set) is what lets every drop target tell a checklist card
  // apart from a task card without guessing from the id shape.
  function getDraggedChecklistItemId(event: DragEvent<HTMLElement>): string | null {
    return event.dataTransfer.getData('application/x-myprosole-checklist-item') || draggedChecklistItemId || null;
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault();
    const checklistItemId = getDraggedChecklistItemId(event);
    if (checklistItemId) {
      setChecklistItemStatus(checklistItemId, status);
      setDraggedChecklistItemId(null);
      setDragOverStatus(null);
      return;
    }
    const taskId = event.dataTransfer.getData('application/x-myprosole-task')
      || event.dataTransfer.getData('text/plain')
      || draggedTaskId;
    if (taskId) {
      if (status === 'completed') setEditingTask(taskId);
      else setTaskStatus(taskId, status);
    }
    setDraggedTaskId(null);
    setDragOverStatus(null);
  }

  // Dropped directly onto another card: reorder next to it (and, if it's a
  // different column, change status the same way dropping on the column
  // background would) instead of just landing wherever the natural sort
  // puts it. Position only, via useTodoOrderStore -- see there for why that
  // never touches the task's own data. A dropped checklist card only ever
  // changes status -- it doesn't participate in the manual reorder, so it
  // returns before touching useTodoOrderStore at all.
  function handleDropOnCard(event: DragEvent<HTMLElement>, targetTaskId: string, columnStatus: TaskStatus, placeAfter: boolean) {
    event.preventDefault();
    const checklistItemId = getDraggedChecklistItemId(event);
    if (checklistItemId) {
      setChecklistItemStatus(checklistItemId, columnStatus);
      setDraggedChecklistItemId(null);
      setDragOverStatus(null);
      return;
    }
    const taskId = event.dataTransfer.getData('application/x-myprosole-task')
      || event.dataTransfer.getData('text/plain')
      || draggedTaskId;
    setDraggedTaskId(null);
    setDragOverStatus(null);
    if (!taskId || taskId === targetTaskId) return;
    const draggedTask = tasks.find((task) => task.id === taskId);
    if (draggedTask) {
      const draggedStatus = normalizeTaskStatus(draggedTask.status, draggedTask.progress);
      if (draggedStatus !== columnStatus) {
        // Completion keeps its one controlled entry point (the Definition
        // of Done gate) -- dropping onto a card in that column opens the
        // dialog instead of silently marking it done, same as the
        // column-background drop already does.
        if (columnStatus === 'completed') {
          setEditingTask(taskId);
          return;
        }
        setTaskStatus(taskId, columnStatus);
      }
    }
    reorderTodos(todos.map((task) => task.id), taskId, targetTaskId, placeAfter);
  }

  function cancelDrag() {
    setDraggedTaskId(null);
    setDraggedChecklistItemId(null);
    setDragOverStatus(null);
  }

  return (
    <div className="flex-1 overflow-auto bg-white px-5 py-6 lg:px-7">
      <div className="mx-auto max-w-[1700px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-800">To-Do Kanban</h1>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {todos.filter((task) => normalizeTaskStatus(task.status, task.progress) !== 'completed').length
                  + checklistTodos.filter((todo) => todo.status !== 'completed').length} offen
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Aufgaben verschieben; Abschluss erfolgt nach vollständiger Definition of Done im Aufgabendialog.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
              <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" aria-hidden="true">
                <path d="M4 5h12M6.5 10h7M8.5 15h3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <span className="sr-only">Nach Person filtern</span>
              <select
                aria-label="Nach Person filtern"
                className="bg-transparent text-xs font-medium text-slate-600 outline-none"
                value={personFilter ?? ''}
                onChange={(event) => setPersonFilter(event.target.value || null)}
              >
                <option value="">Alle Personen</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </label>
            {!isViewer && (
              <button
                type="button"
                onClick={() => startNewTask({ status: 'not_started' })}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                + To-Do
              </button>
            )}
          </div>
        </div>

        {milestones.length > 0 && (
          <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-indigo-700">Meilensteine</span>
              {milestones.map((milestone) => {
                const days = diffDays(t0, milestone.start);
                return (
                  <button
                    key={milestone.id}
                    type="button"
                    onClick={() => setEditingTask(milestone.id)}
                    className="flex shrink-0 items-center gap-2 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-left shadow-sm hover:border-indigo-300"
                  >
                    <span className="text-indigo-500">◆</span>
                    <span className="max-w-52 truncate text-xs font-semibold text-slate-700">{milestone.title}</span>
                    <span className="text-[11px] text-slate-400">
                      {formatShort(milestone.start)}{days === 0 ? ' · heute' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <div className="overflow-x-auto pb-4">
          <div className="grid min-w-[1160px] grid-cols-4 gap-4">
            {TASK_STATUSES.map((status) => {
              const columnTasks = todos.filter(
                (task) => normalizeTaskStatus(task.status, task.progress) === status,
              );
              const columnChecklistTodos = checklistTodos.filter((todo) => todo.status === status);
              return (
                <TodoColumn
                  key={status}
                  status={status}
                  title={TASK_STATUS_LABELS[status]}
                  count={columnTasks.length + columnChecklistTodos.length}
                  accent={COLUMN_ACCENTS[status]}
                  active={dragOverStatus === status}
                  readOnly={isViewer}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOverStatus(status);
                  }}
                  onDragLeave={() => setDragOverStatus((current) => current === status ? null : current)}
                  onDrop={(event) => handleDrop(event, status)}
                >
                  {columnTasks.map((task) => (
                    <TodoCard
                      key={task.id}
                      task={task}
                      status={status}
                      people={people}
                      workPackage={workPackages.find((workPackage) => workPackage.id === task.workPackageId)}
                      readOnly={isViewer}
                      onOpen={() => setEditingTask(task.id)}
                      onToggleCompleted={() => {
                        if (status === 'completed') setTaskStatus(task.id, 'not_started');
                        else setEditingTask(task.id);
                      }}
                      onDragStart={(event) => handleDragStart(event, task.id)}
                      onDragEnd={cancelDrag}
                      onDropCard={(event, placeAfter) => handleDropOnCard(event, task.id, status, placeAfter)}
                    />
                  ))}
                  {columnChecklistTodos.map((todo) => (
                    <ChecklistTodoCard
                      key={todo.id}
                      todo={todo}
                      people={people}
                      readOnly={isViewer}
                      onOpen={() => setEditingTask(todo.taskId)}
                      onToggle={() => toggleChecklistItem(todo.id, todo.status !== 'completed')}
                      onDragStart={(event) => handleChecklistDragStart(event, todo.id)}
                      onDragEnd={cancelDrag}
                    />
                  ))}
                </TodoColumn>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
