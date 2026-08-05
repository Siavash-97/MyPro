import { supabase } from './supabase';
import type { ActivityEntry, Dependency, Idea, Person, ProjectData, Task, WorkPackage } from '../types';
import { normalizeTaskStatus } from '../utils/taskStatus';

/** One row per entity instead of one JSON blob for the whole plan: two
 * people creating two different tasks at the same time are now two
 * independent inserts instead of two competing overwrites of the same
 * row, so neither can silently erase the other's change. */

interface TaskRow {
  id: string;
  type: string;
  title: string;
  start_date: string;
  end_date: string;
  assignee_ids: string[] | null;
  work_package_id: string | null;
  color: string;
  progress: number;
  status: string | null;
  notes: string;
  parent_id: string | null;
}

interface IdeaRow {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface ActivityRow {
  id: string;
  ts: string;
  message: string;
  actor: string | null;
}

interface DependencyRow {
  id: string;
  from_id: string;
  to_id: string;
  type: string;
  lag_days: number;
}

function taskToRow(t: Task): TaskRow {
  return {
    id: t.id,
    type: t.type,
    title: t.title,
    start_date: t.start,
    end_date: t.end,
    assignee_ids: t.assigneeIds,
    work_package_id: t.workPackageId,
    color: t.color,
    progress: t.progress,
    status: normalizeTaskStatus(t.status, t.progress),
    notes: t.notes,
    parent_id: t.parentId,
  };
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    type: r.type as Task['type'],
    title: r.title,
    start: r.start_date,
    end: r.end_date,
    assigneeIds: r.assignee_ids ?? [],
    workPackageId: r.work_package_id,
    color: r.color,
    progress: r.progress,
    status: normalizeTaskStatus(r.status, r.progress),
    notes: r.notes,
    parentId: r.parent_id,
  };
}

function ideaToRow(i: Idea): IdeaRow {
  return { id: i.id, title: i.title, body: i.text, created_at: i.createdAt };
}

function rowToIdea(r: IdeaRow): Idea {
  return { id: r.id, title: r.title, text: r.body, createdAt: r.created_at };
}

function activityToRow(a: ActivityEntry): ActivityRow {
  return { id: a.id, ts: a.timestamp, message: a.message, actor: a.actor ?? null };
}

function rowToActivity(r: ActivityRow): ActivityEntry {
  return { id: r.id, timestamp: r.ts, message: r.message, actor: r.actor ?? undefined };
}

function depToRow(d: Dependency): DependencyRow {
  return { id: d.id, from_id: d.fromId, to_id: d.toId, type: d.type, lag_days: d.lagDays };
}

function rowToDep(r: DependencyRow): Dependency {
  return { id: r.id, fromId: r.from_id, toId: r.to_id, type: (r.type as Dependency['type']) ?? 'FS', lagDays: r.lag_days ?? 0 };
}

export async function pullAll(): Promise<{ data: ProjectData | null; ok: boolean }> {
  if (!supabase) return { data: null, ok: false };
  const [people, workPackages, tasks, dependencies, ideas, activity] = await Promise.all([
    supabase.from('planner_people').select('*'),
    supabase.from('planner_work_packages').select('*'),
    supabase.from('planner_tasks').select('*'),
    supabase.from('planner_dependencies').select('*'),
    supabase.from('planner_ideas').select('*'),
    supabase.from('planner_activity').select('*').order('ts', { ascending: false }).limit(300),
  ]);
  const anyError =
    people.error || workPackages.error || tasks.error || dependencies.error || ideas.error || activity.error;
  if (anyError) return { data: null, ok: false };
  return {
    ok: true,
    data: {
      people: (people.data ?? []) as Person[],
      workPackages: (workPackages.data ?? []) as WorkPackage[],
      tasks: ((tasks.data ?? []) as TaskRow[]).map(rowToTask),
      dependencies: ((dependencies.data ?? []) as DependencyRow[]).map(rowToDep),
      ideas: ((ideas.data ?? []) as IdeaRow[]).map(rowToIdea),
      activity: ((activity.data ?? []) as ActivityRow[]).map(rowToActivity),
    },
  };
}

/** True once at least one row exists in any table -- used to decide whether
 * to seed the cloud with the local starter data on first-ever run. */
export function isEmpty(data: ProjectData): boolean {
  return (
    data.people.length === 0 &&
    data.workPackages.length === 0 &&
    data.tasks.length === 0 &&
    data.ideas.length === 0
  );
}

export async function seedCloud(data: ProjectData): Promise<void> {
  if (!supabase) return;
  await Promise.all([
    data.people.length && supabase.from('planner_people').insert(data.people),
    data.workPackages.length && supabase.from('planner_work_packages').insert(data.workPackages),
    data.tasks.length && supabase.from('planner_tasks').insert(data.tasks.map(taskToRow)),
    data.dependencies.length && supabase.from('planner_dependencies').insert(data.dependencies.map(depToRow)),
    data.ideas.length && supabase.from('planner_ideas').insert(data.ideas.map(ideaToRow)),
    data.activity.length && supabase.from('planner_activity').insert(data.activity.map(activityToRow)),
  ]);
}

type UndoableData = Pick<ProjectData, 'people' | 'workPackages' | 'tasks' | 'dependencies' | 'ideas'>;

async function diffEntity<T extends { id: string }>(
  prevList: T[],
  nextList: T[],
  upsert: (item: T) => Promise<unknown>,
  del: (id: string) => Promise<void>,
): Promise<void> {
  const prevMap = new Map(prevList.map((x) => [x.id, x]));
  const nextMap = new Map(nextList.map((x) => [x.id, x]));
  const ops: Promise<unknown>[] = [];
  for (const [id, item] of nextMap) {
    const prevItem = prevMap.get(id);
    if (!prevItem || JSON.stringify(prevItem) !== JSON.stringify(item)) ops.push(upsert(item));
  }
  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) ops.push(del(id));
  }
  await Promise.all(ops);
}

/** Used by undo/redo: pushes exactly the rows that differ between two full
 * snapshots (added/changed -> upsert, removed -> delete) instead of
 * re-writing everything, since most undo steps only touch a handful of
 * rows out of the whole plan. */
export async function syncUndoStep(prev: UndoableData, next: UndoableData): Promise<void> {
  await Promise.all([
    diffEntity(prev.people, next.people, upsertPerson, deletePerson),
    diffEntity(prev.workPackages, next.workPackages, upsertWorkPackage, deleteWorkPackage),
    diffEntity(prev.tasks, next.tasks, upsertTask, deleteTaskRemote),
    diffEntity(prev.dependencies, next.dependencies, upsertDependency, deleteDependencyRemote),
    diffEntity(prev.ideas, next.ideas, upsertIdea, deleteIdeaRemote),
  ]);
}

export async function upsertPerson(p: Person): Promise<void> {
  await supabase?.from('planner_people').upsert(p);
}
export async function deletePerson(id: string): Promise<void> {
  await supabase?.from('planner_people').delete().eq('id', id);
}

export async function upsertWorkPackage(wp: WorkPackage): Promise<void> {
  await supabase?.from('planner_work_packages').upsert(wp);
}
export async function deleteWorkPackage(id: string): Promise<void> {
  await supabase?.from('planner_work_packages').delete().eq('id', id);
}

export async function upsertTask(t: Task): Promise<string | null> {
  if (!supabase) return null;
  const row = taskToRow(t);
  const { error } = await supabase.from('planner_tasks').upsert(row);
  // During a staged deployment an older database may not have the Kanban
  // column yet. Keep ordinary task edits syncing until the migration is run.
  if (error && /status/i.test(error.message)) {
    const { status: _status, ...legacyRow } = row;
    const { error: legacyError } = await supabase.from('planner_tasks').upsert(legacyRow);
    return legacyError?.message ?? null;
  }
  return error?.message ?? null;
}
export async function deleteTaskRemote(id: string): Promise<void> {
  await supabase?.from('planner_tasks').delete().eq('id', id);
}

export async function upsertDependency(d: Dependency): Promise<void> {
  await supabase?.from('planner_dependencies').upsert(depToRow(d));
}
export async function deleteDependencyRemote(id: string): Promise<void> {
  await supabase?.from('planner_dependencies').delete().eq('id', id);
}

export async function upsertIdea(i: Idea): Promise<void> {
  await supabase?.from('planner_ideas').upsert(ideaToRow(i));
}
export async function deleteIdeaRemote(id: string): Promise<void> {
  await supabase?.from('planner_ideas').delete().eq('id', id);
}

export async function insertActivity(a: ActivityEntry): Promise<void> {
  await supabase?.from('planner_activity').insert(activityToRow(a));
}
export async function clearActivityRemote(): Promise<void> {
  // No id is universally "not equal to itself" in Postgrest, so filter on
  // a condition every row satisfies instead.
  await supabase?.from('planner_activity').delete().gte('ts', '1970-01-01');
}

type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeHandlers {
  onPerson: (event: ChangeEvent, row: Person | { id: string }) => void;
  onWorkPackage: (event: ChangeEvent, row: WorkPackage | { id: string }) => void;
  onTask: (event: ChangeEvent, row: Task | { id: string }) => void;
  onDependency: (event: ChangeEvent, row: Dependency | { id: string }) => void;
  onIdea: (event: ChangeEvent, row: Idea | { id: string }) => void;
  onActivity: (event: ChangeEvent, row: ActivityEntry | { id: string }) => void;
}

export interface BaselineEntry {
  start: string;
  end: string;
}

interface BaselineRow {
  task_id: string;
  start_date: string;
  end_date: string;
}

export async function pullBaseline(): Promise<Record<string, BaselineEntry>> {
  if (!supabase) return {};
  const { data, error } = await supabase.from('planner_baseline').select('*');
  if (error || !data) return {};
  const result: Record<string, BaselineEntry> = {};
  for (const r of data as BaselineRow[]) result[r.task_id] = { start: r.start_date, end: r.end_date };
  return result;
}

/** Saving a baseline is a full overwrite -- it replaces whatever was there
 * before with the plan's current dates, since a baseline is meant to be
 * "the one committed reference point", not a history of snapshots. */
export async function saveBaseline(tasks: Task[]): Promise<void> {
  if (!supabase) return;
  await supabase.from('planner_baseline').delete().neq('task_id', '');
  const rows = tasks.map((t) => ({ task_id: t.id, start_date: t.start, end_date: t.end }));
  if (rows.length) await supabase.from('planner_baseline').upsert(rows);
}

export async function clearBaseline(): Promise<void> {
  if (!supabase) return;
  await supabase.from('planner_baseline').delete().neq('task_id', '');
}

export function subscribeBaseline(onChange: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};
  const channel = client
    .channel('planner_baseline_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_baseline' }, () => onChange())
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

export function subscribeAll(handlers: RealtimeHandlers): () => void {
  const client = supabase;
  if (!client) return () => {};

  const channel = client
    .channel('planner_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_people' }, (payload) => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Person;
      handlers.onPerson(payload.eventType as ChangeEvent, row);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_work_packages' }, (payload) => {
      const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as WorkPackage;
      handlers.onWorkPackage(payload.eventType as ChangeEvent, row);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_tasks' }, (payload) => {
      const raw = payload.eventType === 'DELETE' ? payload.old : payload.new;
      const row = payload.eventType === 'DELETE' ? (raw as { id: string }) : rowToTask(raw as TaskRow);
      handlers.onTask(payload.eventType as ChangeEvent, row);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_dependencies' }, (payload) => {
      const raw = payload.eventType === 'DELETE' ? payload.old : payload.new;
      const row = payload.eventType === 'DELETE' ? (raw as { id: string }) : rowToDep(raw as DependencyRow);
      handlers.onDependency(payload.eventType as ChangeEvent, row);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_ideas' }, (payload) => {
      const raw = payload.eventType === 'DELETE' ? payload.old : payload.new;
      const row = payload.eventType === 'DELETE' ? (raw as { id: string }) : rowToIdea(raw as IdeaRow);
      handlers.onIdea(payload.eventType as ChangeEvent, row);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'planner_activity' }, (payload) => {
      const raw = payload.eventType === 'DELETE' ? payload.old : payload.new;
      const row = payload.eventType === 'DELETE' ? (raw as { id: string }) : rowToActivity(raw as ActivityRow);
      handlers.onActivity(payload.eventType as ChangeEvent, row);
    })
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
