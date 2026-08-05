import { describe, expect, it } from 'vitest';
import type { Dependency, Task } from '../types';
import { applyCascade, wouldCreateCycle } from './schedule';

function task(id: string, start: string, end: string): Task {
  return {
    id,
    type: 'task',
    title: id,
    start,
    end,
    assigneeIds: [],
    workPackageId: null,
    color: '#2563eb',
    progress: 0,
    notes: '',
    parentId: null,
  };
}

function dependency(id: string, fromId: string, toId: string): Dependency {
  return { id, fromId, toId, type: 'FS', lagDays: 0 };
}

describe('automatic scheduling', () => {
  it('moves a successor behind its predecessor and preserves its duration', () => {
    const tasks = [task('a', '2027-03-01', '2027-03-05'), task('b', '2027-03-03', '2027-03-06')];

    const result = applyCascade(tasks, [dependency('a-b', 'a', 'b')]);

    expect(result[1].start).toBe('2027-03-06');
    expect(result[1].end).toBe('2027-03-09');
  });

  it('detects direct and transitive dependency cycles', () => {
    const dependencies = [dependency('a-b', 'a', 'b'), dependency('b-c', 'b', 'c')];

    expect(wouldCreateCycle(dependencies, 'c', 'a')).toBe(true);
    expect(wouldCreateCycle(dependencies, 'a', 'c')).toBe(false);
    expect(wouldCreateCycle(dependencies, 'a', 'a')).toBe(true);
  });
});
