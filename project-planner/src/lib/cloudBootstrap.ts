import { useProjectStore } from '../store/useProjectStore';
import { cloudEnabled } from './supabase';
import { pullFromCloud, pushToCloud, subscribeToCloud } from './cloudSync';
import { hasSession, onAuthChange } from './auth';
import type { ProjectData } from '../types';

const PUSH_DEBOUNCE_MS = 600;

function extractProjectData(s: ReturnType<typeof useProjectStore.getState>): ProjectData {
  return {
    people: s.people,
    workPackages: s.workPackages,
    tasks: s.tasks,
    dependencies: s.dependencies,
    ideas: s.ideas,
    activity: s.activity,
  };
}

/** Wires the local store to a shared Supabase row: pulls the current cloud
 * state once signed in, keeps pushing local edits (debounced), and applies
 * incoming realtime changes from other devices. No-ops entirely if cloud
 * env vars aren't configured, so local-only usage is unaffected. Syncing
 * only runs while an authenticated session exists (RLS requires it). */
export function initCloudSync() {
  if (!cloudEnabled) return;

  let applyingRemote = false;
  let authed = false;
  let unsubscribeRealtime: (() => void) | null = null;

  async function startSyncing() {
    if (authed) return;
    authed = true;
    const { data: remote, ok } = await pullFromCloud();
    if (remote) {
      applyingRemote = true;
      useProjectStore.setState(remote);
      applyingRemote = false;
    } else if (ok) {
      await pushToCloud(extractProjectData(useProjectStore.getState()));
    }
    unsubscribeRealtime = subscribeToCloud((data) => {
      applyingRemote = true;
      useProjectStore.setState(data);
      applyingRemote = false;
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

  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  useProjectStore.subscribe((state, prevState) => {
    if (applyingRemote || !authed) return;
    const changed =
      state.tasks !== prevState.tasks ||
      state.people !== prevState.people ||
      state.workPackages !== prevState.workPackages ||
      state.dependencies !== prevState.dependencies ||
      state.ideas !== prevState.ideas ||
      state.activity !== prevState.activity;
    if (!changed) return;

    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushToCloud(extractProjectData(useProjectStore.getState()));
    }, PUSH_DEBOUNCE_MS);
  });
}
