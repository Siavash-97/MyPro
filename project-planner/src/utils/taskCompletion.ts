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
