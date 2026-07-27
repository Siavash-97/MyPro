import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type { ActivityEntry, ColorMode, Dependency, Idea, Person, ProjectData, Task, WorkPackage, ZoomLevel } from '../types';
import { buildSeedData } from '../data/seed';
import { colorForIndex } from '../utils/colors';
import { applyCascade, wouldCreateCycle } from '../utils/schedule';

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
}

interface ProjectStore extends ProjectData, UIState {
  addTask: (partial?: Partial<Task>) => string;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, newStart: string, newEnd: string) => void;

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

  logActivity: (message: string) => void;
  clearActivity: () => void;
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

      addTask: (partial) => {
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
        get().logActivity(
          task.type === 'milestone'
            ? `Meilenstein "${task.title}" erstellt.`
            : `Aufgabe "${task.title}" erstellt.`,
        );
        return id;
      },

      updateTask: (id, patch) => {
        set((s) => {
          const updated = s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
          return { tasks: applyCascade(updated, s.dependencies) };
        });
      },

      deleteTask: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          dependencies: s.dependencies.filter((d) => d.fromId !== id && d.toId !== id),
          editingTaskId: s.editingTaskId === id ? null : s.editingTaskId,
        }));
        if (task) {
          get().logActivity(
            task.type === 'milestone'
              ? `Meilenstein "${task.title}" gelöscht.`
              : `Aufgabe "${task.title}" gelöscht.`,
          );
        }
      },

      moveTask: (id, newStart, newEnd) => {
        set((s) => {
          const updated = s.tasks.map((t) => (t.id === id ? { ...t, start: newStart, end: newEnd } : t));
          return { tasks: applyCascade(updated, s.dependencies) };
        });
      },

      addPerson: (name) => {
        if (!name.trim()) return null;
        const person: Person = { id: uuid(), name: name.trim(), color: colorForIndex(get().people.length) };
        set((s) => ({ people: [...s.people, person] }));
        get().logActivity(`Person "${person.name}" hinzugefügt.`);
        return person.id;
      },

      removePerson: (id) => {
        const person = get().people.find((p) => p.id === id);
        set((s) => ({
          people: s.people.filter((p) => p.id !== id),
          tasks: s.tasks.map((t) => ({ ...t, assigneeIds: t.assigneeIds.filter((a) => a !== id) })),
          personFilter: s.personFilter === id ? null : s.personFilter,
        }));
        if (person) get().logActivity(`Person "${person.name}" entfernt.`);
      },

      addWorkPackage: (name) => {
        if (!name.trim()) return null;
        const wp: WorkPackage = { id: uuid(), name: name.trim(), color: colorForIndex(get().workPackages.length) };
        set((s) => ({ workPackages: [...s.workPackages, wp] }));
        get().logActivity(`Arbeitspaket "${wp.name}" hinzugefügt.`);
        return wp.id;
      },

      removeWorkPackage: (id) => {
        const wp = get().workPackages.find((w) => w.id === id);
        set((s) => ({
          workPackages: s.workPackages.filter((w) => w.id !== id),
          tasks: s.tasks.map((t) => (t.workPackageId === id ? { ...t, workPackageId: null } : t)),
        }));
        if (wp) get().logActivity(`Arbeitspaket "${wp.name}" entfernt.`);
      },

      addDependency: (fromId, toId) => {
        if (fromId === toId) return;
        const exists = get().dependencies.some((d) => d.fromId === fromId && d.toId === toId);
        if (exists) return;
        if (wouldCreateCycle(get().dependencies, fromId, toId)) return;
        const dep: Dependency = { id: uuid(), fromId, toId };
        set((s) => {
          const dependencies = [...s.dependencies, dep];
          return { dependencies, tasks: applyCascade(s.tasks, dependencies) };
        });
        const titleOf = (id: string) => get().tasks.find((t) => t.id === id)?.title ?? '?';
        get().logActivity(`Abhängigkeit erstellt: "${titleOf(fromId)}" → "${titleOf(toId)}".`);
      },

      removeDependency: (id) => {
        const dep = get().dependencies.find((d) => d.id === id);
        set((s) => ({
          dependencies: s.dependencies.filter((d) => d.id !== id),
          selectedDependencyId: s.selectedDependencyId === id ? null : s.selectedDependencyId,
        }));
        if (dep) {
          const titleOf = (tid: string) => get().tasks.find((t) => t.id === tid)?.title ?? '?';
          get().logActivity(`Abhängigkeit entfernt: "${titleOf(dep.fromId)}" → "${titleOf(dep.toId)}".`);
        }
      },

      rewireDependency: (depId, end, newTaskId) => {
        let changed = false;
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
            const titleOf = (tid: string) => get().tasks.find((t) => t.id === tid)?.title ?? '?';
            get().logActivity(`Abhängigkeit umgehängt: jetzt "${titleOf(dep.fromId)}" → "${titleOf(dep.toId)}".`);
          }
        }
      },

      addIdea: (title) => {
        const idea: Idea = {
          id: uuid(),
          title: title?.trim() || 'Neue Idee',
          text: '',
          createdAt: new Date().toISOString().slice(0, 10),
        };
        set((s) => ({ ideas: [idea, ...s.ideas] }));
        get().logActivity(`Idee "${idea.title}" hinzugefügt.`);
        return idea.id;
      },

      updateIdea: (id, patch) => {
        set((s) => ({ ideas: s.ideas.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
      },

      deleteIdea: (id) => {
        const idea = get().ideas.find((i) => i.id === id);
        set((s) => ({ ideas: s.ideas.filter((i) => i.id !== id) }));
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
        const data = JSON.parse(json) as ProjectData;
        set({
          people: data.people ?? [],
          workPackages: data.workPackages ?? [],
          tasks: data.tasks ?? [],
          dependencies: data.dependencies ?? [],
          ideas: data.ideas ?? [],
          activity: data.activity ?? [],
        });
        get().logActivity('Projektdaten aus JSON-Datei importiert.');
      },

      resetToSeed: () => {
        const seed = buildSeedData();
        set({ ...seed });
      },

      logActivity: (message) => {
        const entry: ActivityEntry = { id: uuid(), timestamp: new Date().toISOString(), message };
        set((s) => ({ activity: [entry, ...s.activity].slice(0, MAX_ACTIVITY_ENTRIES) }));
      },

      clearActivity: () => set({ activity: [] }),
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
