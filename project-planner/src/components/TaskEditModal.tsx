import { useEffect, useMemo, useRef, useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useDismissGuard } from '../hooks/useDismissGuard';
import { PALETTE } from '../utils/colors';
import type { ItemType, DependencyType } from '../types';
import { DEP_TYPE_LABELS } from '../types';
import { cloudEnabled } from '../lib/supabase';
import { computeRollups, getDescendantIds, hasChildren } from '../utils/hierarchy';
import { formatShort } from '../utils/date';
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  getDownloadUrl,
  formatSize,
  type Attachment,
} from '../lib/attachments';

export function TaskEditModal() {
  const editingTaskId = useProjectStore((s) => s.editingTaskId);
  const canDismiss = useDismissGuard(editingTaskId);
  const tasks = useProjectStore((s) => s.tasks);
  const people = useProjectStore((s) => s.people);
  const workPackages = useProjectStore((s) => s.workPackages);
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

  const task = tasks.find((t) => t.id === editingTaskId) ?? null;

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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setType(task.type);
    setStart(task.start);
    setEnd(task.end);
    setAssigneeIds(task.assigneeIds);
    setWorkPackageId(task.workPackageId);
    setColor(task.color);
    setProgress(task.progress);
    setNotes(task.notes);
    setParentId(task.parentId);
    setShowNewPerson(false);
    setNewPersonName('');
    setShowNewWP(false);
    setNewWPName('');
    setNewPredecessorId('');
    setNewSuccessorId('');
    setAttachmentError('');
  }, [task]);

  useEffect(() => {
    if (!task || !cloudEnabled) {
      setAttachments([]);
      return;
    }
    listAttachments(task.id).then(setAttachments);
  }, [task?.id]);

  const rollups = useMemo(() => computeRollups(tasks), [tasks]);

  if (!task) return null;

  const isSummary = hasChildren(tasks, task.id);
  const rollup = isSummary ? rollups.get(task.id) : undefined;
  const descendantIds = getDescendantIds(tasks, task.id);
  const parentCandidates = tasks.filter(
    (t) => t.id !== task.id && t.type === 'task' && !descendantIds.has(t.id),
  );

  async function refreshAttachments() {
    if (!task) return;
    setAttachments(await listAttachments(task.id));
  }

  async function handleUploadFile(file: File) {
    if (!task) return;
    setUploading(true);
    setAttachmentError('');
    const { error } = await uploadAttachment(task.id, file);
    setUploading(false);
    if (error) {
      setAttachmentError(error);
      return;
    }
    await refreshAttachments();
    logActivity(`Datei "${file.name}" an Aufgabe "${task.title}" angehängt.`);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file);
    e.target.value = '';
  }

  async function handleDeleteAttachment(att: Attachment) {
    if (!task) return;
    await deleteAttachment(att);
    await refreshAttachments();
    logActivity(`Anhang "${att.name}" von Aufgabe "${task.title}" entfernt.`);
  }

  async function handleDownload(att: Attachment) {
    const url = await getDownloadUrl(att.storagePath);
    if (url) window.open(url, '_blank');
  }

  const predecessors = dependencies
    .filter((d) => d.toId === task.id)
    .map((d) => ({ depId: d.id, dep: d, task: tasks.find((t) => t.id === d.fromId) }))
    .filter((p): p is { depId: string; dep: (typeof dependencies)[number]; task: (typeof tasks)[number] } => !!p.task);

  const successors = dependencies
    .filter((d) => d.fromId === task.id)
    .map((d) => ({ depId: d.id, dep: d, task: tasks.find((t) => t.id === d.toId) }))
    .filter((p): p is { depId: string; dep: (typeof dependencies)[number]; task: (typeof tasks)[number] } => !!p.task);

  const predecessorCandidates = tasks.filter(
    (t) => t.id !== task.id && !predecessors.some((p) => p.task.id === t.id),
  );
  const successorCandidates = tasks.filter(
    (t) => t.id !== task.id && !successors.some((s) => s.task.id === t.id),
  );

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
    if (!id || !task) return;
    addDependency(id, task.id);
    setNewPredecessorId('');
  }

  function handlePickSuccessor(id: string) {
    if (!id || !task) return;
    addDependency(task.id, id);
    setNewSuccessorId('');
  }

  function handleSave() {
    if (!task) return;
    const effectiveEnd = type === 'milestone' ? start : end < start ? start : end;
    const finalTitle = title.trim() || 'Ohne Titel';

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

  function handleDelete() {
    if (!task) return;
    deleteTask(task.id);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
      onClick={() => canDismiss() && setEditingTask(null)}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-800">
            {type === 'milestone' ? 'Meilenstein bearbeiten' : 'Aufgabe bearbeiten'}
          </h2>
          <button className="text-gray-400 hover:text-gray-600 text-lg leading-none" onClick={() => setEditingTask(null)}>
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4">
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
                disabled={isSummary}
                className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                value={isSummary ? (rollup?.start ?? start) : start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            {type === 'task' && (
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Enddatum</label>
                <input
                  type="date"
                  disabled={isSummary}
                  className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                  value={isSummary ? (rollup?.end ?? end) : end}
                  min={start}
                  onChange={(e) => setEnd(e.target.value)}
                />
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
                  {predecessors.length === 0 && <div className="text-xs text-gray-400">Keiner</div>}
                </div>
                {predecessorCandidates.length > 0 && (
                  <select
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
                  {successors.length === 0 && <div className="text-xs text-gray-400">Keiner</div>}
                </div>
                {successorCandidates.length > 0 && (
                  <select
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

          {cloudEnabled && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Anhänge</label>
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
                {attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs">
                    <button
                      onClick={() => handleDownload(att)}
                      className="truncate text-left text-blue-600 hover:underline"
                      title={att.name}
                    >
                      📎 {att.name}
                    </button>
                    <span className="text-gray-400 shrink-0">{formatSize(att.size)}</span>
                    <button
                      onClick={() => handleDeleteAttachment(att)}
                      className="text-gray-400 hover:text-red-600 shrink-0"
                      title="Anhang entfernen"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                {attachments.length === 0 && (
                  <div className="px-2.5 py-2 text-xs text-gray-400">Keine Anhänge.</div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-2 text-xs font-medium text-gray-500 border border-dashed border-gray-300 px-3 py-1 rounded-md hover:border-gray-400 hover:text-gray-700 disabled:opacity-50"
              >
                {uploading ? 'Lädt hoch…' : '+ Datei anhängen'}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInputChange} />
              {attachmentError && <p className="text-xs text-red-600 mt-1">{attachmentError}</p>}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={handleDelete} className="text-xs font-medium text-red-600 hover:text-red-700">
            Löschen
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setEditingTask(null)}
              className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-md border border-gray-200"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
