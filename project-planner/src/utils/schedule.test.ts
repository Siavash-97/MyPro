import { describe, expect, it } from 'vitest';
import type { Dependency, Task } from '../types';
import {
  applyCascade,
  nextOpenTaskId,
  rescheduleAfterTaskCompletion,
  rescheduleAfterTaskEndChange,
  wouldCreateCycle,
} from './schedule';

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
    status: 'not_started',
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

    expect(result[1].start).toBe('2027-03-05');
    expect(result[1].end).toBe('2027-03-08');
  });

  it('detects direct and transitive dependency cycles', () => {
    const dependencies = [dependency('a-b', 'a', 'b'), dependency('b-c', 'b', 'c')];

    expect(wouldCreateCycle(dependencies, 'c', 'a')).toBe(true);
    expect(wouldCreateCycle(dependencies, 'a', 'c')).toBe(false);
    expect(wouldCreateCycle(dependencies, 'a', 'a')).toBe(true);
  });

  it('pulls the successor chain forward after an early completion', () => {
    const tasks = [
      task('a', '2027-01-01', '2027-01-10'),
      task('b', '2027-01-10', '2027-01-15'),
      task('c', '2027-01-15', '2027-01-20'),
    ];
    const dependencies = [dependency('a-b', 'a', 'b'), dependency('b-c', 'b', 'c')];

    const result = rescheduleAfterTaskCompletion(tasks, dependencies, 'a', '2027-01-05');

    expect(result[0]).toMatchObject({ end: '2027-01-05', progress: 100, status: 'completed' });
    expect(result[1]).toMatchObject({ start: '2027-01-05', end: '2027-01-10' });
    expect(result[2]).toMatchObject({ start: '2027-01-10', end: '2027-01-15' });
    expect(nextOpenTaskId(result, dependencies, 'a')).toBe('b');
  });

  it('pushes the successor chain back after a late completion', () => {
    const tasks = [
      task('a', '2027-01-01', '2027-01-10'),
      task('b', '2027-01-10', '2027-01-15'),
      task('c', '2027-01-15', '2027-01-20'),
    ];
    const dependencies = [dependency('a-b', 'a', 'b'), dependency('b-c', 'b', 'c')];

    const result = rescheduleAfterTaskCompletion(tasks, dependencies, 'a', '2027-01-11');

    expect(result[1]).toMatchObject({ start: '2027-01-11', end: '2027-01-16' });
    expect(result[2]).toMatchObject({ start: '2027-01-16', end: '2027-01-21' });
  });

  it('moves later tasks by the full overdue delay even when the plan contains a gap', () => {
    const tasks = [task('a', '2027-01-01', '2027-01-10'), task('b', '2027-01-20', '2027-01-25')];

    const result = rescheduleAfterTaskEndChange(tasks, [dependency('a-b', 'a', 'b')], 'a', '2027-01-11');

    expect(result[0].end).toBe('2027-01-11');
    expect(result[1]).toMatchObject({ start: '2027-01-21', end: '2027-01-26' });
  });
});
