import { describe, expect, it } from 'vitest';
import {
  deriveTaskStatus,
  normalizeTaskStatus,
  patchForTaskStatus,
  statusAfterProgressChange,
} from './taskStatus';

describe('task status', () => {
  it('derives a useful status for tasks saved before Kanban existed', () => {
    expect(deriveTaskStatus(0)).toBe('not_started');
    expect(deriveTaskStatus(35)).toBe('in_progress');
    expect(deriveTaskStatus(100)).toBe('completed');
    expect(normalizeTaskStatus(undefined, 100)).toBe('completed');
  });

  it('keeps a valid explicit waiting status', () => {
    expect(normalizeTaskStatus('waiting', 25)).toBe('waiting');
  });

  it('sets progress to 100 when a task is dropped into completed', () => {
    expect(patchForTaskStatus({ progress: 20 }, 'completed')).toEqual({
      status: 'completed',
      progress: 100,
    });
  });

  it('clears completed progress without inventing a new percentage when a task becomes active again', () => {
    expect(patchForTaskStatus({ progress: 100 }, 'in_progress')).toEqual({
      status: 'in_progress',
      progress: 0,
    });
    expect(patchForTaskStatus({ progress: 100 }, 'not_started')).toEqual({
      status: 'not_started',
      progress: 0,
    });
  });

  it('updates ordinary workflow status from an edited percentage but preserves waiting', () => {
    expect(statusAfterProgressChange('not_started', 25)).toBe('in_progress');
    expect(statusAfterProgressChange('in_progress', 0)).toBe('not_started');
    expect(statusAfterProgressChange('waiting', 30)).toBe('waiting');
    expect(statusAfterProgressChange('waiting', 100)).toBe('completed');
  });
});
