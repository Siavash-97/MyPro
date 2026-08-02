import { useProjectStore } from '../store/useProjectStore';
import { cloudEnabled } from './supabase';
import { pullAll, seedCloud, isEmpty, subscribeAll } from './db';
import { hasSession, onAuthChange } from './auth';
import type { ActivityEntry, Dependency, Idea, Person, ProjectData, Task, WorkPackage } from '../types';

function upsertById<T extends { id: string }>(list: T[], row: T): T[] {
  const idx = list.findIndex((x) => x.id === row.id);
  if (idx === -1) return [...list, row];
  const next = list.slice();
  next[idx] = row;
  return next;
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

/** Wires the local store to per-row Supabase tables: pulls the current
 * cloud state once signed in (seeding the cloud from local data on a
 * brand-new project), and applies incoming realtime row changes from other
 * devices/people directly into the matching array. Individual mutations
 * are pushed to the cloud from useProjectStore itself, right where each
 * mutation happens, instead of a single whole-plan push from here -- that
 * per-row push is what stops two people's simultaneous edits from
 * overwriting each other. No-ops entirely if cloud env vars aren't
 * configured, so local-only usage is unaffected. */
export function initCloudSync() {
  if (!cloudEnabled) return;

  let authed = false;
  let unsubscribeRealtime: (() => void) | null = null;

  async function startSyncing() {
    if (authed) return;
    authed = true;
    const { data: remote, ok } = await pullAll();
    if (remote && !isEmpty(remote)) {
      useProjectStore.setState(remote);
    } else if (ok) {
      const local: ProjectData = {
        people: useProjectStore.getState().people,
        workPackages: useProjectStore.getState().workPackages,
        tasks: useProjectStore.getState().tasks,
        dependencies: useProjectStore.getState().dependencies,
        ideas: useProjectStore.getState().ideas,
        activity: useProjectStore.getState().activity,
      };
      await seedCloud(local);
    }

    unsubscribeRealtime = subscribeAll({
      onPerson: (event, row) => {
        if (event === 'DELETE') useProjectStore.setState((s) => ({ people: removeById(s.people, row.id) }));
        else useProjectStore.setState((s) => ({ people: upsertById(s.people, row as Person) }));
      },
      onWorkPackage: (event, row) => {
        if (event === 'DELETE')
          useProjectStore.setState((s) => ({ workPackages: removeById(s.workPackages, row.id) }));
        else useProjectStore.setState((s) => ({ workPackages: upsertById(s.workPackages, row as WorkPackage) }));
      },
      onTask: (event, row) => {
        if (event === 'DELETE') useProjectStore.setState((s) => ({ tasks: removeById(s.tasks, row.id) }));
        else useProjectStore.setState((s) => ({ tasks: upsertById(s.tasks, row as Task) }));
      },
      onDependency: (event, row) => {
        if (event === 'DELETE')
          useProjectStore.setState((s) => ({ dependencies: removeById(s.dependencies, row.id) }));
        else useProjectStore.setState((s) => ({ dependencies: upsertById(s.dependencies, row as Dependency) }));
      },
      onIdea: (event, row) => {
        if (event === 'DELETE') useProjectStore.setState((s) => ({ ideas: removeById(s.ideas, row.id) }));
        else useProjectStore.setState((s) => ({ ideas: upsertById(s.ideas, row as Idea) }));
      },
      onActivity: (event, row) => {
        if (event === 'DELETE') useProjectStore.setState((s) => ({ activity: removeById(s.activity, row.id) }));
        else
          useProjectStore.setState((s) => ({
            activity: upsertById(s.activity, row as ActivityEntry).sort((a, b) =>
              b.timestamp.localeCompare(a.timestamp),
            ),
          }));
      },
    });
  }

  function stopSyncing() {
    authed = false;
    unsubscribeRealtime?.();
    unsubscribeRealtime = null;
  }

  hasSession().then((yes) => {
    if (yes) startSyncing();
  });
  onAuthChange((yes) => {
    if (yes) startSyncing();
    else stopSyncing();
  });
}
