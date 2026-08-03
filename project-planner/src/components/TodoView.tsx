import { useMemo, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useRoleStore } from '../store/useRoleStore';
import { hasChildren } from '../utils/hierarchy';
import { formatShort, diffDays, today } from '../utils/date';
import type { Task } from '../types';

const NO_WORK_PACKAGE = '__none';

export function TodoView() {
  const tasks = useProjectStore((s) => s.tasks);
  const people = useProjectStore((s) => s.people);
  const workPackages = useProjectStore((s) => s.workPackages);
  const personFilter = useProjectStore((s) => s.personFilter);
  const setPersonFilter = useProjectStore((s) => s.setPersonFilter);
  const addTask = useProjectStore((s) => s.addTask);
  const setEditingTask = useProjectStore((s) => s.setEditingTask);
  const markTaskDone = useProjectStore((s) => s.markTaskDone);
  const updateTask = useProjectStore((s) => s.updateTask);
  const isViewer = useRoleStore((s) => s.role === 'viewer');

  const [showDone, setShowDone] = useState(false);
  const t0 = today();

  const todos = useMemo(
    () => tasks.filter((t) => t.type === 'task' && !hasChildren(tasks, t.id)),
    [tasks],
  );

  const milestones = useMemo(
    () => [...tasks.filter((t) => t.type === 'milestone')].sort((a, b) => a.start.localeCompare(b.start)),
    [tasks],
  );

  const visibleTodos = todos.filter((t) => {
    if (!showDone && t.progress >= 100) return false;
    if (personFilter && !t.assigneeIds.includes(personFilter)) return false;
    return true;
  });

  const groups: { id: string; name: string; color: string; todos: Task[] }[] = [
    ...workPackages.map((wp) => ({
      id: wp.id,
      name: wp.name,
      color: wp.color,
      todos: visibleTodos
        .filter((t) => t.workPackageId === wp.id)
        .sort((a, b) => a.start.localeCompare(b.start)),
    })),
    {
      id: NO_WORK_PACKAGE,
      name: 'Ohne Arbeitspaket',
      color: '#9ca3af',
      todos: visibleTodos
        .filter((t) => !t.workPackageId || !workPackages.some((wp) => wp.id === t.workPackageId))
        .sort((a, b) => a.start.localeCompare(b.start)),
    },
  ].filter((g) => g.todos.length > 0);

  function handleToggleDone(task: Task) {
    if (isViewer) return;
    if (task.progress >= 100) updateTask(task.id, { progress: 0 });
    else markTaskDone(task.id);
  }

  function handleAddTodo(workPackageId: string | null) {
    const id = addTask({ workPackageId, assigneeIds: personFilter ? [personFilter] : [] });
    setEditingTask(id);
  }

  function assigneeNames(t: Task): string {
    if (t.assigneeIds.length === 0) return '';
    return t.assigneeIds.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean).join(', ');
  }

  return (
    <div className="flex-1 overflow-auto bg-white p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-lg font-bold text-gray-800">To-Dos</h1>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              value={personFilter ?? ''}
              onChange={(e) => setPersonFilter(e.target.value || null)}
            >
              <option value="">Alle Personen</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
              Erledigte anzeigen
            </label>
            {!isViewer && (
              <button
                onClick={() => handleAddTodo(null)}
                className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md"
              >
                + To-Do
              </button>
            )}
          </div>
        </div>

        {milestones.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Meilensteine</h2>
            <div className="flex gap-3 flex-wrap">
              {milestones.map((m) => {
                const days = diffDays(t0, m.start);
                const passed = days < 0;
                return (
                  <button
                    key={m.id}
                    onClick={() => setEditingTask(m.id)}
                    className={`text-left border rounded-md px-3 py-2 min-w-[10rem] hover:bg-gray-50 ${
                      passed ? 'border-gray-200 opacity-60' : 'border-indigo-200 bg-indigo-50/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-indigo-500">◆</span>
                      <span className="text-xs font-medium text-gray-800 truncate">{m.title}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {formatShort(m.start)} · {passed ? `vor ${-days} Tagen` : days === 0 ? 'heute' : `in ${days} Tagen`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {groups.length === 0 && (
            <p className="text-xs text-gray-400">
              {showDone ? 'Keine To-Dos vorhanden.' : 'Keine offenen To-Dos -- alles erledigt, oder noch keine angelegt.'}
            </p>
          )}
          {groups.map((g) => (
            <div key={g.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.color }} />
                  <h2 className="text-sm font-semibold text-gray-700">{g.name}</h2>
                  <span className="text-xs text-gray-400">
                    {g.todos.filter((t) => t.progress < 100).length} offen
                  </span>
                </div>
                {!isViewer && g.id !== NO_WORK_PACKAGE && (
                  <button
                    onClick={() => handleAddTodo(g.id)}
                    className="text-xs font-medium text-gray-500 border border-dashed border-gray-300 px-2.5 py-1 rounded-md hover:border-gray-400 hover:text-gray-700"
                  >
                    + To-Do
                  </button>
                )}
              </div>
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
                {g.todos.map((t) => {
                  const overdue = t.progress < 100 && t.end < t0;
                  const names = assigneeNames(t);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={t.progress >= 100}
                        disabled={isViewer}
                        onChange={() => handleToggleDone(t)}
                        className="shrink-0 w-4 h-4 disabled:opacity-50"
                      />
                      <button
                        onClick={() => setEditingTask(t.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className={`text-sm truncate ${t.progress >= 100 ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {t.title}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                          <span className={overdue ? 'text-red-600 font-medium' : ''}>
                            {formatShort(t.start)} – {formatShort(t.end)}
                          </span>
                          {names && <span className="truncate">· {names}</span>}
                          {!names && <span className="italic">· niemand zugewiesen</span>}
                          {t.notes.trim() && <span title={t.notes}>· 📝</span>}
                        </div>
                      </button>
                      <div className="w-16 shrink-0 h-1.5 rounded-full bg-gray-100 overflow-hidden" title={`${t.progress}%`}>
                        <div className="h-full rounded-full" style={{ width: `${t.progress}%`, background: t.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
