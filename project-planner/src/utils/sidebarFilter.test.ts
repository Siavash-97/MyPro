import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { filterTasksByGanttVisibility } from './sidebarFilter';

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    type: 'task',
    title: id,
    start: '2027-03-01',
    end: '2027-03-05',
    assigneeIds: [],
    workPackageId: null,
    color: '#2563eb',
    progress: 0,
    status: 'not_started',
    notes: '',
    parentId: null,
    ...overrides,
  };
}

describe('filterTasksByGanttVisibility', () => {
  it('keeps tasks with showInGantt true', () => {
    const tasks = [task('a', { showInGantt: true })];
    expect(filterTasksByGanttVisibility(tasks).map((t) => t.id)).toEqual(['a']);
  });

  it('keeps tasks with showInGantt left undefined -- pre-existing tasks stay visible', () => {
    const tasks = [task('a')];
    expect(filterTasksByGanttVisibility(tasks).map((t) => t.id)).toEqual(['a']);
  });

  it('drops tasks explicitly opted out with showInGantt false', () => {
    const tasks = [task('a', { showInGantt: false }), task('b', { showInGantt: true })];
    expect(filterTasksByGanttVisibility(tasks).map((t) => t.id)).toEqual(['b']);
  });

  it('does not force-keep a hidden task just because a visible child points at it as parent', () => {
    const tasks = [
      task('parent', { showInGantt: false }),
      task('child', { showInGantt: true, parentId: 'parent' }),
    ];
    expect(filterTasksByGanttVisibility(tasks).map((t) => t.id)).toEqual(['child']);
  });
});
