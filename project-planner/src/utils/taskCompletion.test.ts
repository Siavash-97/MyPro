import { describe, expect, it } from 'vitest';
import { isDefinitionOfDoneComplete } from './taskCompletion';

describe('task completion gate', () => {
  it('unlocks only when every existing DoD item is complete', () => {
    expect(isDefinitionOfDoneComplete({ available: true, completed: 5, total: 5 })).toBe(true);
    expect(isDefinitionOfDoneComplete({ available: true, completed: 4, total: 5 })).toBe(false);
  });

  it('fails closed when DoD data is unavailable or empty', () => {
    expect(isDefinitionOfDoneComplete({ available: false, completed: 5, total: 5 })).toBe(false);
    expect(isDefinitionOfDoneComplete({ available: true, completed: 0, total: 0 })).toBe(false);
  });
});
