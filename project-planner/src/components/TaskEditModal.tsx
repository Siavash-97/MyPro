import { useEffect, useMemo, useState } from 'react';
import { useProjectStore, NEW_TASK_ID } from '../store/useProjectStore';
import { useDismissGuard } from '../hooks/useDismissGuard';
import { PALETTE } from '../utils/colors';
import type { ItemType, DependencyType } from '../types';
import { DEP_TYPE_LABELS } from '../types';
import { cloudEnabled } from '../lib/supabase';
import { computeRollups, getDescendantIds, hasChildren } from '../utils/hierarchy';
import { formatShort, today } from '../utils/date';
import { useRoleStore } from '../store/useRoleStore';
import { listAttachments } from '../lib/attachments';
import { listExpensesForTask } from '../lib/expenses';
import { CommentsSection } from './taskEdit/CommentsSection';
import { AttachmentsSection } from './taskEdit/AttachmentsSection';
import { ExpensesSection } from './taskEdit/ExpensesSection';
import { TaskChecklistTab } from './taskEdit/TaskChecklistTab';
import { TaskEditTabs, type TaskEditTab } from './taskEdit/TaskEditTabs';
import { useTaskTabCounts } from '../hooks/useTaskTabCounts';
import {
  datesFromPredecessor,
  latestTaskEnd,
  validateTaskForm,
  type TaskFormErrors,
} from '../utils/taskFormValidation';

export function TaskEditModal() {
  const editingTaskId = useProjectStore((s) => s.editingTaskId);
  const canDismiss = useDismissGuard(editingTaskId);
  const tasks = useProjectStore((s) => s.tasks);
  const people = useProjectStore((s) => s.people);
  const workPackages = useProjectStore((s) => s.workPackages);
  const addTask = useProjectStore((s) => s.addTask);
  const updateTask = useProjectStore((s) => s.updateTask);
  const deleteTask = useProjectStore((s) => s.deleteTask);
  const setEditingTask = useProjectStore((s) => s.setEditingTask);
  const addPerson = useProjectStore((s) => s.addPerson);
  const addWorkPackage = useProjectStore((s) => s.addWorkPackage);
  const dependencies = useProjectStore((s) => s.dependencies);
  const addDependency = useProjectStore((s) => s.addDependency);
  const removeDependency = useProjectStore((s) => s.removeDependency);
  const updateDependency = useProjectStore((s) => s.updateDependency);
  const logActivity = useProjectStore((s) => s.logActivity);
  const isViewer = useRoleStore((s) => s.role === 'viewer');

  const isNew = editingTaskId === NEW_TASK_ID;
  const task = isNew ? null : (tasks.find((t) => t.id === editingTaskId) ?? null);
  const tabCounts = useTaskTabCounts(
    task?.id ?? null,
    cloudEnabled && Boolean(task),
  );

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ItemType>('task');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [workPackageId, setWorkPackageId] = useState<string | null>(null);
  const [color, setColor] = useState('#2563eb');
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [newPersonName, setNewPersonName] = useState('');
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [newWPName, setNewWPName] = useState('');
  const [showNewWP, setShowNewWP] = useState(false);
  const [newPredecessorId, setNewPredecessorId] = useState('');
  const [newSuccessorId, setNewSuccessorId] = useState('');
  const [draftPredecessorIds, setDraftPredecessorIds] = useState<string[]>([]);
  const [draftSuccessorIds, setDraftSuccessorIds] = useState<string[]>([]);
  const [predecessorUnknown, setPredecessorUnknown] = useState(false);
  const [successorUnknown, setSuccessorUnknown] = useState(false);
  const [formErrors, setFormErrors] = useState<TaskFormErrors>({});
  const [activeTab, setActiveTab] = useState<TaskEditTab>('details');

  useEffect(() => {
    const currentState = useProjectStore.getState();
    const currentDraft = currentState.newTaskDraft;
    const currentTask = editingTaskId === NEW_TASK_ID
      ? null
      : currentState.tasks.find((item) => item.id === editingTaskId) ?? null;
    if (editingTaskId === NEW_TASK_ID) {
      const start = currentDraft?.start ?? today();
      setTitle(currentDraft?.title ?? '');
      setType(currentDraft?.type ?? 'task');
      setStart(start);
      setEnd(currentDraft?.end ?? start);
      setAssigneeIds(currentDraft?.assigneeIds ?? []);
      setWorkPackageId(currentDraft?.workPackageId ?? currentState.workPackages[0]?.id ?? null);
      setColor(currentDraft?.color ?? PALETTE[0]);
      setProgress(currentDraft?.progress ?? 0);
      setNotes(currentDraft?.notes ?? '');
      setParentId(currentDraft?.parentId ?? null);
    } else if (currentTask) {
      setTitle(currentTask.title);
      setType(currentTask.type);
      setStart(currentTask.start);
      setEnd(currentTask.end);
      setAssigneeIds(currentTask.assigneeIds);
      setWorkPackageId(currentTask.workPackageId);
      setColor(currentTask.color);
      setProgress(currentTask.progress);
      setNotes(currentTask.notes);
      setParentId(currentTask.parentId);
    } else {
      return;
    }
    setShowNewPerson(false);
    setNewPersonName('');
    setShowNewWP(false);
    setNewWPName('');
    setNewPredecessorId('');
    setNewSuccessorId('');
    setDraftPredecessorIds([]);
    setDraftSuccessorIds([]);
    setPredecessorUnknown(currentTask ? !currentState.dependencies.some((dependency) => dependency.toId === currentTask.id) : false);
    setSuccessorUnknown(currentTask ? !currentState.dependencies.some((dependency) => dependency.fromId === currentTask.id) : false);
    setFormErrors({});
    setActiveTab('details');
  }, [editingTaskId]);

  const rollups = useMemo(() => computeRollups(tasks), [tasks]);

  if (!task && !isNew) return null;

  const isSummary = task ? hasChildren(tasks, task.id) : false;
  const rollup = isSummary && task ? rollups.get(task.id) : undefined;
  const descendantIds = task ? getDescendantIds(tasks, task.id) : new Set<string>();
  const parentCandidates = tasks.filter(
    (t) => t.id !== task?.id && t.type === 'task' && !descendantIds.has(t.id),
  );

  const predecessors = dependencies
    .filter((d) => d.toId === task?.id)
    .map((d) => ({ depId: d.id, dep: d, task: tasks.find((t) => t.id === d.fromId) }))
    .filter((p): p is { depId: string; dep: (typeof dependencies)[number]; task: (typeof tasks)[number] } => !!p.task);

  const successors = dependencies
    .filter((d) => d.fromId === task?.id)
    .map((d) => ({ depId: d.id, dep: d, task: tasks.find((t) => t.id === d.toId) }))
    .filter((p): p is { depId: string; dep: (typeof dependencies)[number]; task: (typeof tasks)[number] } => !!p.task);

  const predecessorCandidates = tasks.filter(
    (t) => t.id !== task?.id && !predecessors.some((p) => p.task.id === t.id) && !draftPredecessorIds.includes(t.id),
  );
  const successorCandidates = tasks.filter(
    (t) => t.id !== task?.id && !successors.some((s) => s.task.id === t.id) && !draftSuccessorIds.includes(t.id),
  );

  const draftPredecessors = draftPredecessorIds
    .map((id) => tasks.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is (typeof tasks)[number] => Boolean(candidate));
  const draftSuccessors = draftSuccessorIds
    .map((id) => tasks.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is (typeof tasks)[number] => Boolean(candidate));

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleCreatePerson() {
    const id = addPerson(newPersonName);
    if (id) {
      setAssigneeIds((prev) => [...prev, id]);
      setNewPersonName('');
      setShowNewPerson(false);
    }
  }

  function handleCreateWorkPackage() {
    const id = addWorkPackage(newWPName);
    if (id) {
      setWorkPackageId(id);
      setNewWPName('');
      setShowNewWP(false);
    }
  }

  function handlePickPredecessor(id: string) {
    if (!id) return;
    const predecessorTask = tasks.find((candidate) => candidate.id === id);
    if (!predecessorTask) return;
    const allPredecessorTasks = [
      ...predecessors.map((item) => item.task),
      ...draftPredecessors,
      predecessorTask,
    ];
    const latestEnd = latestTaskEnd(allPredecessorTasks);
    if (latestEnd && !isSummary) {
      const nextDates = datesFromPredecessor(start, end, latestEnd);
      setStart(nextDates.start);
      setEnd(nextDates.end);
      if (task) updateTask(task.id, nextDates);
    }
    if (task) addDependency(id, task.id);
    else setDraftPredecessorIds((current) => [...current, id]);
    setPredecessorUnknown(false);
    setFormErrors((current) => ({ ...current, start: undefined, end: undefined, predecessor: undefined }));
    setNewPredecessorId('');
  }

  function handlePickSuccessor(id: string) {
    if (!id) return;
    if (task) addDependency(task.id, id);
    else setDraftSuccessorIds((current) => [...current, id]);
    setSuccessorUnknown(false);
    setFormErrors((current) => ({ ...current, successor: undefined }));
    setNewSuccessorId('');
  }

  function handleSave() {
    const errors = validateTaskForm({
      type,
      start,
      end,
      isSummary,
      hasPredecessor: predecessors.length + draftPredecessorIds.length > 0,
      hasSuccessor: successors.length + draftSuccessorIds.length > 0,
      predecessorUnknown,
      successorUnknown,
    });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setActiveTab('details');
      return;
    }
    setFormErrors({});
    const effectiveEnd = type === 'milestone' ? start : end;
    const finalTitle = title.trim() || 'Ohne Titel';

    if (!task) {
      const newTaskId = addTask({
        title: finalTitle,
        type,
        start,
        end: effectiveEnd,
        assigneeIds,
        workPackageId,
        color,
        progress: Math.max(0, Math.min(100, progress)),
        notes,
        parentId,
      });
      draftPredecessorIds.forEach((predecessorId) => addDependency(predecessorId, newTaskId));
      draftSuccessorIds.forEach((successorId) => addDependency(newTaskId, successorId));
      setEditingTask(null);
      return;
    }

    const changes: string[] = [];
    if (task.title !== finalTitle) changes.push(`Titel: "${task.title}" → "${finalTitle}"`);
    if (!isSummary && (task.start !== start || task.end !== effectiveEnd)) {
      const oldLabel = task.type === 'milestone' ? task.start : `${task.start} – ${task.end}`;
      const newLabel = type === 'milestone' ? start : `${start} – ${effectiveEnd}`;
      changes.push(`Termin: ${oldLabel} → ${newLabel}`);
    }
    if (!isSummary && task.progress !== progress) changes.push(`Fortschritt: ${task.progress}% → ${progress}%`);
    const oldAssignees = [...task.assigneeIds].sort().join(',');
    const newAssignees = [...assigneeIds].sort().join(',');
    if (oldAssignees !== newAssignees) {
      const names = assigneeIds.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean);
      changes.push(`Zuweisung: ${names.length ? names.join(', ') : 'niemand'}`);
    }
    if (task.workPackageId !== workPackageId) {
      const wpName = workPackages.find((w) => w.id === workPackageId)?.name ?? '–';
      changes.push(`Arbeitspaket: ${wpName}`);
    }
    if (task.parentId !== parentId) {
      const parentName = tasks.find((t) => t.id === parentId)?.title ?? 'keine';
      changes.push(`Übergeordnete Aufgabe: ${parentName}`);
    }

    updateTask(task.id, {
      title: finalTitle,
      type,
      // A summary task's own start/end/progress are display-only derived
      // values (see computeRollups) -- keep whatever was last stored so
      // this save doesn't clobber them with stale form state.
      start: isSummary ? task.start : start,
      end: isSummary ? task.end : effectiveEnd,
      progress: isSummary ? task.progress : Math.max(0, Math.min(100, progress)),
      assigneeIds,
      workPackageId,
      color,
      notes,
      parentId,
    });
    if (changes.length) {
      logActivity(`Aufgabe "${finalTitle}" bearbeitet: ${changes.join('; ')}.`);
    }
    setEditingTask(null);
  }

  async function handleDelete() {
    if (!task) return;
    const [taskAttachments, taskExpenses] = await Promise.all([
      listAttachments(task.id),
      listExpensesForTask(task.id),
    ]);
    const invoiceCount = taskExpenses.filter((e) => e.invoiceStoragePath).length;
    const fileCount = taskAttachments.length + invoiceCount;
    const message =
      fileCount > 0
        ? `Diese Aufgabe hat ${taskAttachments.length} Anhang/Anhänge und ${invoiceCount} Rechnung(en). Beim Löschen werden diese Dateien unwiderruflich mitgelöscht und können danach nicht wiederhergestellt werden. Trotzdem endgültig löschen?`
        : `Aufgabe "${task.title}" wirklich endgültig löschen?`;
    if (!confirm(message)) return;
    deleteTask(task.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={() => canDismiss() && setEditingTask(null)}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            {isNew
              ? type === 'milestone'
                ? 'Meilenstein erstellen'
                : 'Aufgabe erstellen'
              : type === 'milestone'
                ? 'Meilenstein bearbeiten'
                : 'Aufgabe bearbeiten'}
          </h2>
          <button className="text-gray-400 hover:text-gray-600 text-lg leading-none" onClick={() => setEditingTask(null)}>
            &times;
          </button>
        </div>

        <TaskEditTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          cloudEnabled={cloudEnabled}
          taskSaved={!!task}
          counts={tabCounts}
        />

        {activeTab === 'details' && (
        <div className="p-5 space-y-4">
          {isViewer && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5">
              👁 Nur Ansicht -- du hast keine Bearbeitungsrechte für diesen Projektplan.
            </p>
          )}
          <fieldset disabled={isViewer} className="contents">
          <div className="flex gap-2">
            <button
              className={`flex-1 text-xs font-medium py-1.5 rounded-md border ${type === 'task' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
              onClick={() => setType('task')}
            >
              Aufgabe
            </button>
            <button
              className={`flex-1 text-xs font-medium py-1.5 rounded-md border ${type === 'milestone' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
              onClick={() => setType('milestone')}
            >
              Meilenstein
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Titel</label>
            <input
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {isSummary && rollup && (
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5">
              Sammelaufgabe: Termin ({formatShort(rollup.start)} – {formatShort(rollup.end)}) und Fortschritt (
              {rollup.progress}%) ergeben sich automatisch aus den Unteraufgaben.
            </p>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {type === 'milestone' ? 'Datum' : 'Startdatum'}
              </label>
              <input
                type="date"
                aria-label={type === 'milestone' ? 'Datum' : 'Startdatum'}
                required={!isSummary}
                disabled={isSummary}
                className={`w-full border rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400 ${
                  formErrors.start ? 'border-red-400' : 'border-gray-200'
                }`}
                value={isSummary ? (rollup?.start ?? start) : start}
                onChange={(e) => {
                  setStart(e.target.value);
                  setFormErrors((current) => ({ ...current, start: undefined }));
                }}
              />
              {formErrors.start && <p className="mt-1 text-[11px] text-red-600">{formErrors.start}</p>}
            </div>
            {type === 'task' && (
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Enddatum</label>
                <input
                  type="date"
                  aria-label="Enddatum"
                  required={!isSummary}
                  disabled={isSummary}
                  className={`w-full border rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400 ${
                    formErrors.end ? 'border-red-400' : 'border-gray-200'
                  }`}
                  value={isSummary ? (rollup?.end ?? end) : end}
                  min={start}
                  onChange={(e) => {
                    setEnd(e.target.value);
                    setFormErrors((current) => ({ ...current, end: undefined }));
                  }}
                />
                {formErrors.end && <p className="mt-1 text-[11px] text-red-600">{formErrors.end}</p>}
              </div>
            )}
          </div>

          {type === 'task' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Übergeordnete Aufgabe</label>
              <select
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white"
                value={parentId ?? ''}
                onChange={(e) => setParentId(e.target.value || null)}
              >
                <option value="">– Keine –</option>
                {parentCandidates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Abhängigkeiten</label>
            <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
              <div className="p-2.5">
                <div className="text-[11px] font-semibold text-gray-500 mb-1.5">
                  Vorgänger (muss vorher fertig sein)
                </div>
                <div className="space-y-1">
                  {predecessors.map((p) => (
                    <div key={p.depId} className="bg-gray-50 rounded px-2 py-1.5 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate">{p.task.title}</span>
                        <button
                          onClick={() => removeDependency(p.depId)}
                          className="text-gray-400 hover:text-red-600 ml-2 shrink-0"
                          title="Abhängigkeit entfernen"
                        >
                          &times;
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          className="flex-1 border border-gray-200 rounded px-1.5 py-0.5 text-[11px] bg-white"
                          value={p.dep.type}
                          onChange={(e) => updateDependency(p.depId, { type: e.target.value as DependencyType })}
                        >
                          {(Object.keys(DEP_TYPE_LABELS) as DependencyType[]).map((t) => (
                            <option key={t} value={t}>
                              {DEP_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          title="Vorlauf-/Nachlaufzeit in Tagen (negativ = Überlappung)"
                          className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-[11px]"
                          value={p.dep.lagDays}
                          onChange={(e) => updateDependency(p.depId, { lagDays: Number(e.target.value) || 0 })}
                        />
                        <span className="text-[10px] text-gray-400 shrink-0">Tage</span>
                      </div>
                    </div>
                  ))}
                  {draftPredecessors.map((predecessor) => (
                    <div key={predecessor.id} className="bg-blue-50 rounded px-2 py-1.5 flex items-center justify-between text-xs">
                      <span className="truncate">{predecessor.title}</span>
                      <button
                        type="button"
                        onClick={() => setDraftPredecessorIds((current) => current.filter((id) => id !== predecessor.id))}
                        className="text-gray-400 hover:text-red-600 ml-2 shrink-0"
                        title="Vorgänger entfernen"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  {predecessors.length === 0 && draftPredecessors.length === 0 && (
                    <div className="text-xs text-gray-400">Keiner</div>
                  )}
                </div>
                {predecessorCandidates.length > 0 && (
                  <select
                    aria-label="Vorgänger hinzufügen"
                    className="w-full mt-2 border border-gray-200 rounded-md px-2 py-1 text-xs bg-white"
                    value={newPredecessorId}
                    onChange={(e) => handlePickPredecessor(e.target.value)}
                  >
                    <option value="">+ Vorgänger hinzufügen…</option>
                    {predecessorCandidates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                )}
                <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={predecessorUnknown}
                    disabled={predecessors.length + draftPredecessorIds.length > 0}
                    onChange={(event) => {
                      setPredecessorUnknown(event.target.checked);
                      setFormErrors((current) => ({ ...current, predecessor: undefined }));
                    }}
                  />
                  Vorgänger noch nicht bekannt
                </label>
                {formErrors.predecessor && <p className="mt-1 text-[11px] text-red-600">{formErrors.predecessor}</p>}
              </div>

              <div className="p-2.5">
                <div className="text-[11px] font-semibold text-gray-500 mb-1.5">Nachfolger (startet danach)</div>
                <div className="space-y-1">
                  {successors.map((s) => (
                    <div key={s.depId} className="bg-gray-50 rounded px-2 py-1.5 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate">{s.task.title}</span>
                        <button
                          onClick={() => removeDependency(s.depId)}
                          className="text-gray-400 hover:text-red-600 ml-2 shrink-0"
                          title="Abhängigkeit entfernen"
                        >
                          &times;
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          className="flex-1 border border-gray-200 rounded px-1.5 py-0.5 text-[11px] bg-white"
                          value={s.dep.type}
                          onChange={(e) => updateDependency(s.depId, { type: e.target.value as DependencyType })}
                        >
                          {(Object.keys(DEP_TYPE_LABELS) as DependencyType[]).map((t) => (
                            <option key={t} value={t}>
                              {DEP_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          title="Vorlauf-/Nachlaufzeit in Tagen (negativ = Überlappung)"
                          className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-[11px]"
                          value={s.dep.lagDays}
                          onChange={(e) => updateDependency(s.depId, { lagDays: Number(e.target.value) || 0 })}
                        />
                        <span className="text-[10px] text-gray-400 shrink-0">Tage</span>
                      </div>
                    </div>
                  ))}
                  {draftSuccessors.map((successor) => (
                    <div key={successor.id} className="bg-blue-50 rounded px-2 py-1.5 flex items-center justify-between text-xs">
                      <span className="truncate">{successor.title}</span>
                      <button
                        type="button"
                        onClick={() => setDraftSuccessorIds((current) => current.filter((id) => id !== successor.id))}
                        className="text-gray-400 hover:text-red-600 ml-2 shrink-0"
                        title="Nachfolger entfernen"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                  {successors.length === 0 && draftSuccessors.length === 0 && (
                    <div className="text-xs text-gray-400">Keiner</div>
                  )}
                </div>
                {successorCandidates.length > 0 && (
                  <select
                    aria-label="Nachfolger hinzufügen"
                    className="w-full mt-2 border border-gray-200 rounded-md px-2 py-1 text-xs bg-white"
                    value={newSuccessorId}
                    onChange={(e) => handlePickSuccessor(e.target.value)}
                  >
                    <option value="">+ Nachfolger hinzufügen…</option>
                    {successorCandidates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                )}
                <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={successorUnknown}
                    disabled={successors.length + draftSuccessorIds.length > 0}
                    onChange={(event) => {
                      setSuccessorUnknown(event.target.checked);
                      setFormErrors((current) => ({ ...current, successor: undefined }));
                    }}
                  />
                  Nachfolger noch nicht bekannt
                </label>
                {formErrors.successor && <p className="mt-1 text-[11px] text-red-600">{formErrors.successor}</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Zugewiesene Person(en)</label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleAssignee(p.id)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    assigneeIds.includes(p.id) ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                  style={assigneeIds.includes(p.id) ? { background: p.color } : undefined}
                >
                  {p.name}
                </button>
              ))}
              {people.length === 0 && <span className="text-xs text-gray-400">Keine Personen angelegt</span>}
              {!showNewPerson && (
                <button
                  onClick={() => setShowNewPerson(true)}
                  className="text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700"
                >
                  + Neue Person
                </button>
              )}
            </div>
            {showNewPerson && (
              <div className="flex gap-2 mt-2">
                <input
                  autoFocus
                  className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm"
                  placeholder="Name der Person"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreatePerson();
                    if (e.key === 'Escape') setShowNewPerson(false);
                  }}
                />
                <button
                  onClick={handleCreatePerson}
                  className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 rounded-md"
                >
                  Hinzufügen
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Arbeitspaket / Kategorie</label>
            <div className="flex gap-2">
              <select
                className="flex-1 border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-white"
                value={workPackageId ?? ''}
                onChange={(e) => setWorkPackageId(e.target.value || null)}
              >
                <option value="">–</option>
                {workPackages.map((wp) => (
                  <option key={wp.id} value={wp.id}>
                    {wp.name}
                  </option>
                ))}
              </select>
              {!showNewWP && (
                <button
                  onClick={() => setShowNewWP(true)}
                  className="text-xs font-medium text-gray-500 border border-dashed border-gray-300 px-3 rounded-md hover:border-gray-400 hover:text-gray-700 whitespace-nowrap"
                >
                  + Neu
                </button>
              )}
            </div>
            {showNewWP && (
              <div className="flex gap-2 mt-2">
                <input
                  autoFocus
                  className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm"
                  placeholder="Name des Arbeitspakets"
                  value={newWPName}
                  onChange={(e) => setNewWPName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateWorkPackage();
                    if (e.key === 'Escape') setShowNewWP(false);
                  }}
                />
                <button
                  onClick={handleCreateWorkPackage}
                  className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 rounded-md"
                >
                  Hinzufügen
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Farbe</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-gray-800' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-7 h-7 rounded cursor-pointer border border-gray-200" />
            </div>
          </div>

          {type === 'task' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Fortschritt: {isSummary ? (rollup?.progress ?? 0) : progress}%
              </label>
              <input
                type="range"
                min={0}
                max={100}
                disabled={isSummary}
                value={isSummary ? (rollup?.progress ?? 0) : progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                className="w-full disabled:opacity-50"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notizen</label>
            <textarea
              className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          </fieldset>

          {cloudEnabled && isNew && (
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5">
              Checkliste, Kommentare und Anhänge stehen zur Verfügung, sobald die Aufgabe gespeichert ist.
            </p>
          )}

        </div>
        )}

        {cloudEnabled && task && activeTab === 'checklist' && (
          <div className="p-5">
            <TaskChecklistTab
              taskId={task.id}
              isViewer={isViewer}
            />
          </div>
        )}

        {cloudEnabled && task && activeTab === 'comments' && (
          <div className="p-5">
            <CommentsSection taskId={task.id} isViewer={isViewer} />
          </div>
        )}

        {cloudEnabled && task && activeTab === 'attachments' && (
          <div className="p-5">
            <AttachmentsSection taskId={task.id} taskTitle={task.title} isViewer={isViewer} />
          </div>
        )}

        {cloudEnabled && task && activeTab === 'expenses' && (
          <div className="p-5">
            <ExpensesSection taskId={task.id} taskTitle={task.title} isViewer={isViewer} />
          </div>
        )}

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
          {!isViewer && task ? (
            <button onClick={handleDelete} className="text-xs font-medium text-red-600 hover:text-red-700">
              Löschen
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setEditingTask(null)}
              className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-md border border-gray-200"
            >
              {isViewer ? 'Schließen' : 'Abbrechen'}
            </button>
            {!isViewer && (
              <button
                onClick={handleSave}
                className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md"
              >
                Speichern
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
