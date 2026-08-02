import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type { ActivityEntry, ColorMode, Dependency, Idea, Person, ProjectData, Task, WorkPackage, ZoomLevel } from '../types';
import { buildSeedData } from '../data/seed';
import { colorForIndex } from '../utils/colors';
import { applyCascade, wouldCreateCycle } from '../utils/schedule';
import { today } from '../utils/date';
import { getCurrentDisplayName } from '../lib/auth';
import {
  upsertPerson,
  deletePerson as deletePersonRemote,
  upsertWorkPackage,
  deleteWorkPackage as deleteWorkPackageRemote,
  upsertTask,
  deleteTaskRemote,
  upsertDependency,
  deleteDependencyRemote,
  upsertIdea,
  deleteIdeaRemote,
  insertActivity,
  clearActivityRemote,
  syncUndoStep,
} from '../lib/db';

type UndoSnapshot = Pick<ProjectData, 'people' | 'workPackages' | 'tasks' | 'dependencies' | 'ideas'>;
const MAX_UNDO_HISTORY = 30;

function snapshotForUndo(s: ProjectData): UndoSnapshot {
  return {
    people: s.people,
    workPackages: s.workPackages,
    tasks: s.tasks,
    dependencies: s.dependencies,
    ideas: s.ideas,
  };
}

/** Pushes every task whose scheduling-relevant fields actually changed
 * between two snapshots (e.g. after a dependency cascade shifts several
 * tasks' dates). Comparing values rather than object identity matters
 * because applyCascade rebuilds a fresh object for every task on every
 * call, changed or not. */
function pushChangedTasks(prevTasks: Task[], nextTasks: Task[]) {
  const prevMap = new Map(prevTasks.map((t) => [t.id, t]));
  for (const t of nextTasks) {
    const prev = prevMap.get(t.id);
    if (
      !prev ||
      prev.start !== t.start ||
      prev.end !== t.end ||
      prev.title !== t.title ||
      prev.workPackageId !== t.workPackageId ||
      prev.color !== t.color ||
      prev.progress !== t.progress ||
      prev.notes !== t.notes ||
      prev.assigneeIds.length !== t.assigneeIds.length ||
      prev.assigneeIds.some((id, i) => id !== t.assigneeIds[i])
    ) {
      upsertTask(t);
    }
  }
}

export type DependencyEnd = 'from' | 'to';

const MAX_ACTIVITY_ENTRIES = 300;

interface UIState {
  colorMode: ColorMode;
  zoom: ZoomLevel;
  personFilter: string | null;
  swimlane: boolean;
  linkingEnabled: boolean;
  linkModeFromId: string | null;
  selectedDependencyId: string | null;
  editingTaskId: string | null;
  undoPast: UndoSnapshot[];
  undoFuture: UndoSnapshot[];
}

interface ProjectStore extends ProjectData, UIState {
  addTask: (partial?: Partial<Task>) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newStart: string, newEnd: string) => void;
  markTaskDone: (id: string) => void;
  checkOverdueTasks: () => void;

  addPerson: (name: string) => string | null;
  removePerson: (id: string) => void;

  addWorkPackage: (name: string) => string | null;
  removeWorkPackage: (id: string) => void;

  addIdea: (title?: string) => string;
  updateIdea: (id: string, patch: Partial<Idea>) => void;
  deleteIdea: (id: string) => void;

  addDependency: (fromId: string, toId: string) => void;
  removeDependency: (id: string) => void;
  rewireDependency: (depId: string, end: DependencyEnd, newTaskId: string) => void;

  setColorMode: (mode: ColorMode) => void;
  setZoom: (zoom: ZoomLevel) => void;
  setPersonFilter: (id: string | null) => void;
  setSwimlane: (v: boolean) => void;
  setLinkingEnabled: (v: boolean) => void;
  startLink: (fromId: string) => void;
  cancelLink: () => void;
  completeLink: (toId: string) => void;
  selectDependency: (id: string | null) => void;
  setEditingTask: (id: string | null) => void;

  exportJSON: () => string;
  importJSON: (json: string) => void;
  resetToSeed: () => void;

  logActivity: (message: string, actorOverride?: string) => void;
  clearActivity: () => void;

  pushUndoSnapshot: () => void;
  undo: () => void;
  redo: () => void;
}

const initial = buildSeedData();

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      ...initial,
      colorMode: 'custom',
      zoom: 'day',
      personFilter: null,
      swimlane: false,
      linkingEnabled: false,
      linkModeFromId: null,
      selectedDependencyId: null,
      editingTaskId: null,
      undoPast: [],
      undoFuture: [],

      addTask: (partial) => {
        get().pushUndoSnapshot();
        const id = uuid();
        const start = partial?.start ?? new Date().toISOString().slice(0, 10);
        const task: Task = {
          id,
          type: partial?.type ?? 'task',
          title: partial?.title ?? 'Neue Aufgabe',
          start,
          end: partial?.end ?? start,
          assigneeIds: partial?.assigneeIds ?? [],
          workPackageId: partial?.workPackageId ?? get().workPackages[0]?.id ?? null,
          color: partial?.color ?? colorForIndex(get().tasks.length),
          progress: partial?.progress ?? 0,
          notes: partial?.notes ?? '',
        };
        set((s) => ({ tasks: [...s.tasks, task] }));
        upsertTask(task);
        get().logActivity(
          task.type === 'milestone'
            ? `Meilenstein "${task.title}" erstellt.`
            : `Aufgabe "${task.title}" erstellt.`,
        );
        return id;
      },

      updateTask: (id, patch) => {
        const prevTasks = get().tasks;
        set((s) => {
          const updated = s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
          return { tasks: applyCascade(updated, s.dependencies) };
        });
        pushChangedTasks(prevTasks, get().tasks);
      },

      deleteTask: (id) => {
        get().pushUndoSnapshot();
        const task = get().tasks.find((t) => t.id === id);
        const removedDeps = get().dependencies.filter((d) => d.fromId === id || d.toId === id);
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          dependencies: s.dependencies.filter((d) => d.fromId !== id && d.toId !== id),
          editingTaskId: s.editingTaskId === id ? null : s.editingTaskId,
        }));
        deleteTaskRemote(id);
        for (const dep of removedDeps) deleteDependencyRemote(dep.id);
        if (task) {
          get().logActivity(
            task.type === 'milestone'
              ? `Meilenstein "${task.title}" gelöscht.`
              : `Aufgabe "${task.title}" gelöscht.`,
          );
        }
      },

      moveTask: (id, newStart, newEnd) => {
        const prevTasks = get().tasks;
        set((s) => {
          const updated = s.tasks.map((t) => (t.id === id ? { ...t, start: newStart, end: newEnd } : t));
          return { tasks: applyCascade(updated, s.dependencies) };
        });
        pushChangedTasks(prevTasks, get().tasks);
      },

      markTaskDone: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task || task.progress === 100) return;
        get().pushUndoSnapshot();
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, progress: 100 } : t)) }));
        const updated = get().tasks.find((t) => t.id === id);
        if (updated) upsertTask(updated);
        get().logActivity(`Aufgabe "${task.title}" als erledigt markiert.`);
      },

      /** A task whose end date has passed without being marked done is
       * treated as still running: its end is pulled forward to today. That
       * alone re-triggers applyCascade's normal "predecessor ran long"
       * logic, which pushes every dependent task (and so the whole rest of
       * the plan) back by the same delay -- exactly like manually dragging
       * the task longer, just automatic. As long as nobody clicks
       * "erledigt", this keeps happening every day the task stays open. */
      checkOverdueTasks: () => {
        const t0 = today();
        const prevTasks = get().tasks;
        const overdue: Task[] = [];
        set((s) => {
          const updated = s.tasks.map((t) => {
            if (t.type === 'task' && t.progress < 100 && t.end < t0) {
              overdue.push(t);
              return { ...t, end: t0 };
            }
            return t;
          });
          if (overdue.length === 0) return {};
          return { tasks: applyCascade(updated, s.dependencies) };
        });
        if (overdue.length === 0) return;
        pushChangedTasks(prevTasks, get().tasks);
        for (const t of overdue) {
          get().logActivity(
            `Aufgabe "${t.title}" war überfällig (Enddatum ${t.end}) und wurde automatisch auf ${t0} verlängert -- restlicher Zeitplan verschiebt sich entsprechend.`,
            'Automatisch',
          );
        }
      },

      addPerson: (name) => {
        if (!name.trim()) return null;
        get().pushUndoSnapshot();
        const person: Person = { id: uuid(), name: name.trim(), color: colorForIndex(get().people.length) };
        set((s) => ({ people: [...s.people, person] }));
        upsertPerson(person);
        get().logActivity(`Person "${person.name}" hinzugefügt.`);
        return person.id;
      },

      removePerson: (id) => {
        get().pushUndoSnapshot();
        const person = get().people.find((p) => p.id === id);
        const affectedTasks = get().tasks.filter((t) => t.assigneeIds.includes(id));
        set((s) => ({
          people: s.people.filter((p) => p.id !== id),
          tasks: s.tasks.map((t) => ({ ...t, assigneeIds: t.assigneeIds.filter((a) => a !== id) })),
          personFilter: s.personFilter === id ? null : s.personFilter,
        }));
        deletePersonRemote(id);
        for (const t of affectedTasks) {
          const updated = get().tasks.find((x) => x.id === t.id);
          if (updated) upsertTask(updated);
        }
        if (person) get().logActivity(`Person "${person.name}" entfernt.`);
      },

      addWorkPackage: (name) => {
        if (!name.trim()) return null;
        get().pushUndoSnapshot();
        const wp: WorkPackage = { id: uuid(), name: name.trim(), color: colorForIndex(get().workPackages.length) };
        set((s) => ({ workPackages: [...s.workPackages, wp] }));
        upsertWorkPackage(wp);
        get().logActivity(`Arbeitspaket "${wp.name}" hinzugefügt.`);
        return wp.id;
      },

      removeWorkPackage: (id) => {
        get().pushUndoSnapshot();
        const wp = get().workPackages.find((w) => w.id === id);
        const affectedTasks = get().tasks.filter((t) => t.workPackageId === id);
        set((s) => ({
          workPackages: s.workPackages.filter((w) => w.id !== id),
          tasks: s.tasks.map((t) => (t.workPackageId === id ? { ...t, workPackageId: null } : t)),
        }));
        deleteWorkPackageRemote(id);
        for (const t of affectedTasks) {
          const updated = get().tasks.find((x) => x.id === t.id);
          if (updated) upsertTask(updated);
        }
        if (wp) get().logActivity(`Arbeitspaket "${wp.name}" entfernt.`);
      },

      addDependency: (fromId, toId) => {
        if (fromId === toId) return;
        const exists = get().dependencies.some((d) => d.fromId === fromId && d.toId === toId);
        if (exists) return;
        if (wouldCreateCycle(get().dependencies, fromId, toId)) return;
        get().pushUndoSnapshot();
        const dep: Dependency = { id: uuid(), fromId, toId };
        const prevTasks = get().tasks;
        set((s) => {
          const dependencies = [...s.dependencies, dep];
          return { dependencies, tasks: applyCascade(s.tasks, dependencies) };
        });
        upsertDependency(dep);
        pushChangedTasks(prevTasks, get().tasks);
        const titleOf = (id: string) => get().tasks.find((t) => t.id === id)?.title ?? '?';
        get().logActivity(`Abhängigkeit erstellt: "${titleOf(fromId)}" → "${titleOf(toId)}".`);
      },

      removeDependency: (id) => {
        get().pushUndoSnapshot();
        const dep = get().dependencies.find((d) => d.id === id);
        set((s) => ({
          dependencies: s.dependencies.filter((d) => d.id !== id),
          selectedDependencyId: s.selectedDependencyId === id ? null : s.selectedDependencyId,
        }));
        deleteDependencyRemote(id);
        if (dep) {
          const titleOf = (tid: string) => get().tasks.find((t) => t.id === tid)?.title ?? '?';
          get().logActivity(`Abhängigkeit entfernt: "${titleOf(dep.fromId)}" → "${titleOf(dep.toId)}".`);
        }
      },

      rewireDependency: (depId, end, newTaskId) => {
        get().pushUndoSnapshot();
        let changed = false;
        const prevTasks = get().tasks;
        set((s) => {
          const dep = s.dependencies.find((d) => d.id === depId);
          if (!dep) return {};
          const nextFromId = end === 'from' ? newTaskId : dep.fromId;
          const nextToId = end === 'to' ? newTaskId : dep.toId;
          if (nextFromId === nextToId) return {};
          const duplicate = s.dependencies.some(
            (d) => d.id !== depId && d.fromId === nextFromId && d.toId === nextToId,
          );
          if (duplicate) return {};
          const others = s.dependencies.filter((d) => d.id !== depId);
          if (wouldCreateCycle(others, nextFromId, nextToId)) return {};
          const dependencies = s.dependencies.map((d) =>
            d.id === depId ? { ...d, fromId: nextFromId, toId: nextToId } : d,
          );
          changed = true;
          return { dependencies, tasks: applyCascade(s.tasks, dependencies) };
        });
        if (changed) {
          const dep = get().dependencies.find((d) => d.id === depId);
          if (dep) {
            upsertDependency(dep);
            pushChangedTasks(prevTasks, get().tasks);
            const titleOf = (tid: string) => get().tasks.find((t) => t.id === tid)?.title ?? '?';
            get().logActivity(`Abhängigkeit umgehängt: jetzt "${titleOf(dep.fromId)}" → "${titleOf(dep.toId)}".`);
          }
        }
      },

      addIdea: (title) => {
        get().pushUndoSnapshot();
        const idea: Idea = {
          id: uuid(),
          title: title?.trim() || 'Neue Idee',
          text: '',
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set((s) => ({ ideas: [idea, ...s.ideas] }));
        upsertIdea(idea);
        get().logActivity(`Idee "${idea.title}" hinzugefügt.`);
        return idea.id;
      },

      updateIdea: (id, patch) => {
        set((s) => ({ ideas: s.ideas.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
        const updated = get().ideas.find((i) => i.id === id);
        if (updated) upsertIdea(updated);
      },

      deleteIdea: (id) => {
        get().pushUndoSnapshot();
        const idea = get().ideas.find((i) => i.id === id);
        set((s) => ({ ideas: s.ideas.filter((i) => i.id !== id) }));
        deleteIdeaRemote(id);
        if (idea) get().logActivity(`Idee "${idea.title}" gelöscht.`);
      },

      setColorMode: (mode) => set({ colorMode: mode }),
      setZoom: (zoom) => set({ zoom }),
      setPersonFilter: (id) => set({ personFilter: id }),
      setSwimlane: (v) => set({ swimlane: v }),
      setLinkingEnabled: (v) => set({ linkingEnabled: v, linkModeFromId: null }),

      startLink: (fromId) => set({ linkModeFromId: fromId }),
      cancelLink: () => set({ linkModeFromId: null }),
      completeLink: (toId) => {
        const from = get().linkModeFromId;
        if (from) get().addDependency(from, toId);
        set({ linkModeFromId: null });
      },
      selectDependency: (id) => set({ selectedDependencyId: id }),
      setEditingTask: (id) => set({ editingTaskId: id }),

      exportJSON: () => {
        const { people, workPackages, tasks, dependencies, ideas, activity } = get();
        return JSON.stringify({ people, workPackages, tasks, dependencies, ideas, activity }, null, 2);
      },

      importJSON: (json) => {
        get().pushUndoSnapshot();
        const data = JSON.parse(json) as ProjectData;
        set({
          people: data.people ?? [],
          workPackages: data.workPackages ?? [],
          tasks: data.tasks ?? [],
          dependencies: data.dependencies ?? [],
          ideas: data.ideas ?? [],
          activity: data.activity ?? [],
        });
        // Pushes every imported row to the cloud; doesn't delete cloud rows
        // that aren't in the import, since this is a rare, manual action.
        for (const p of data.people ?? []) upsertPerson(p);
        for (const wp of data.workPackages ?? []) upsertWorkPackage(wp);
        for (const t of data.tasks ?? []) upsertTask(t);
        for (const d of data.dependencies ?? []) upsertDependency(d);
        for (const i of data.ideas ?? []) upsertIdea(i);
        get().logActivity('Projektdaten aus JSON-Datei importiert.');
      },

      resetToSeed: () => {
        get().pushUndoSnapshot();
        const seed = buildSeedData();
        set({ ...seed });
        for (const p of seed.people) upsertPerson(p);
        for (const wp of seed.workPackages) upsertWorkPackage(wp);
        for (const t of seed.tasks) upsertTask(t);
        for (const d of seed.dependencies) upsertDependency(d);
        for (const i of seed.ideas) upsertIdea(i);
      },

      logActivity: (message, actorOverride) => {
        const entry: ActivityEntry = {
          id: uuid(),
          timestamp: new Date().toISOString(),
          message,
          actor: actorOverride ?? getCurrentDisplayName() ?? undefined,
        };
        set((s) => ({ activity: [entry, ...s.activity].slice(0, MAX_ACTIVITY_ENTRIES) }));
        insertActivity(entry);
      },

      clearActivity: () => {
        set({ activity: [] });
        clearActivityRemote();
      },

      /** Called at the start of every undoable action, before it changes
       * anything, so the snapshot captures the state to go back to. Drag-
       * repositioning and idea text edits deliberately don't call this --
       * they're continuous and trivially self-correctable by just dragging
       * or typing back, so tracking every intermediate tick would flood
       * the history with useless steps. */
      pushUndoSnapshot: () => {
        set((s) => ({
          undoPast: [...s.undoPast, snapshotForUndo(s)].slice(-MAX_UNDO_HISTORY),
          undoFuture: [],
        }));
      },

      undo: () => {
        const { undoPast } = get();
        if (undoPast.length === 0) return;
        const target = undoPast[undoPast.length - 1];
        const current = snapshotForUndo(get());
        set((s) => ({
          ...target,
          undoPast: s.undoPast.slice(0, -1),
          undoFuture: [...s.undoFuture, current],
        }));
        syncUndoStep(current, target);
        get().logActivity('Letzte Änderung rückgängig gemacht.', 'Rückgängig');
      },

      redo: () => {
        const { undoFuture } = get();
        if (undoFuture.length === 0) return;
        const target = undoFuture[undoFuture.length - 1];
        const current = snapshotForUndo(get());
        set((s) => ({
          ...target,
          undoFuture: s.undoFuture.slice(0, -1),
          undoPast: [...s.undoPast, current],
        }));
        syncUndoStep(current, target);
        get().logActivity('Änderung wiederholt.', 'Wiederholt');
      },
    }),
    {
      name: 'myprosole-project-planner',
      partialize: (s) => ({
        people: s.people,
        workPackages: s.workPackages,
        tasks: s.tasks,
        dependencies: s.dependencies,
        ideas: s.ideas,
        activity: s.activity,
        colorMode: s.colorMode,
        zoom: s.zoom,
        swimlane: s.swimlane,
      }),
    },
  ),
);
