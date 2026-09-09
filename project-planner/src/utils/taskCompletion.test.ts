import { describe, expect, it } from 'vitest';
import { isChecklistComplete, isDefinitionOfDoneComplete, resolveProgressSliderChange } from './taskCompletion';

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

describe('checklist completion gate', () => {
  it('unlocks when every own checklist item is checked', () => {
    expect(isChecklistComplete({ completed: 5, total: 5 })).toBe(true);
    expect(isChecklistComplete({ completed: 4, total: 5 })).toBe(false);
  });

  it('passes open (unlike DoD) when a task has no checklist of its own at all', () => {
    expect(isChecklistComplete({ completed: 0, total: 0 })).toBe(true);
  });
});

describe('progress slider outcome', () => {
  const context = (overrides: Partial<Parameters<typeof resolveProgressSliderChange>[1]> = {}) => ({
    hasTask: true,
    alreadyCompleted: false,
    canComplete: true,
    ...overrides,
  });

  it('just sets progress below 100%, regardless of completion state', () => {
    expect(resolveProgressSliderChange(42, context())).toEqual({ kind: 'set', progress: 42 });
    expect(resolveProgressSliderChange(0, context({ canComplete: false }))).toEqual({ kind: 'set', progress: 0 });
  });

  it('completes the task when the slider reaches 100% and the DoD gate is open', () => {
    expect(resolveProgressSliderChange(100, context())).toEqual({ kind: 'complete' });
  });

  it('bounces back to 99% instead of completing when the DoD gate is not open', () => {
    expect(resolveProgressSliderChange(100, context({ canComplete: false }))).toEqual({
      kind: 'blocked',
      resetProgress: 99,
    });
  });

  it('never auto-completes an unsaved task or a task that is already done', () => {
    expect(resolveProgressSliderChange(100, context({ hasTask: false }))).toEqual({ kind: 'set', progress: 100 });
    expect(resolveProgressSliderChange(100, context({ alreadyCompleted: true }))).toEqual({
      kind: 'set',
      progress: 100,
    });
  });
});
