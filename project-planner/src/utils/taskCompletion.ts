export interface DefinitionOfDoneCompletion {
  available: boolean;
  completed: number;
  total: number;
}

/** A task needs at least one DoD item; missing/unavailable data must fail
 * closed so a network or schema error can never unlock completion. */
export function isDefinitionOfDoneComplete(state: DefinitionOfDoneCompletion): boolean {
  return state.available && state.total > 0 && state.completed === state.total;
}

export interface ChecklistCompletion {
  completed: number;
  total: number;
}

/** Unlike the Definition of Done, a task's own checklist is optional: no
 * checklist at all means nothing to gate on, so it passes open rather than
 * closed. Only a checklist that exists AND is partly unchecked blocks
 * completion. */
export function isChecklistComplete(state: ChecklistCompletion): boolean {
  return state.total === 0 || state.completed === state.total;
}

export type ProgressSliderOutcome =
  | { kind: 'set'; progress: number }
  | { kind: 'blocked'; resetProgress: number }
  | { kind: 'complete' };

/** Decides what dragging the progress slider to a given value should do.
 * Reaching 100% is the same commitment as the "Als erledigt markieren"
 * button, so it only ever completes the task (via the caller's own
 * DoD-gated flow) or bounces back to 99% -- it must never silently persist
 * progress: 100 without going through that gate. An unsaved task (no id
 * yet) has no DoD checklist to check against, so it just keeps the old
 * 99% ceiling. */
export function resolveProgressSliderChange(
  value: number,
  context: { hasTask: boolean; alreadyCompleted: boolean; canComplete: boolean },
): ProgressSliderOutcome {
  if (value < 100 || !context.hasTask || context.alreadyCompleted) {
    return { kind: 'set', progress: value };
  }
  if (!context.canComplete) {
    return { kind: 'blocked', resetProgress: 99 };
  }
  return { kind: 'complete' };
}
