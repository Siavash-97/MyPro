import { describe, expect, it } from 'vitest';
import type { Person, Task } from '../types';
import { buildRows } from './layout';

function task(id: string, start: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    type: 'task',
    title: id,
    start,
    end: start,
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

function taskIds(tasks: Task[], manualOrder: string[]): string[] {
  return buildRows(tasks, [], false, null, new Set(), 'start', null, manualOrder)
    .filter((r) => r.kind === 'task')
    .map((r) => r.id);
}

describe('buildRows manual order', () => {
  it('sorts by date when nothing has ever been manually arranged', () => {
    const tasks = [task('late', '2028-01-01'), task('early', '2026-01-01')];
    expect(taskIds(tasks, [])).toEqual(['early', 'late']);
  });

  it('keeps previously arranged rows in their recorded relative order', () => {
    const tasks = [task('a', '2026-01-01'), task('b', '2026-02-01'), task('c', '2026-03-01')];
    // User dragged 'c' above everything else.
    expect(taskIds(tasks, ['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('slots a brand-new task next to its date neighbour instead of trailing at the end', () => {
    // 'old2028' was arranged (dragged) back when it was the only known task.
    const tasks = [
      task('old2028', '2028-01-01'),
      // 'new2026' has just been created and has never been seen before.
      task('new2026', '2026-01-01'),
    ];
    expect(taskIds(tasks, ['old2028'])).toEqual(['new2026', 'old2028']);
  });

  it('places several new tasks relative to each other and to known ones by date', () => {
    const tasks = [
      task('known2027', '2027-06-01'),
      task('new2026a', '2026-08-01'),
      task('new2026b', '2026-08-20'),
      task('new2028', '2028-05-01'),
    ];
    expect(taskIds(tasks, ['known2027'])).toEqual(['new2026a', 'new2026b', 'known2027', 'new2028']);
  });

  it('keeps each swimlane its own separately date-sorted group, unaffected by other people\'s manual order', () => {
    const alice: Person = { id: 'alice', name: 'Alice', color: '#000' };
    const bob: Person = { id: 'bob', name: 'Bob', color: '#111' };
    const tasks = [
      task('alice-old2028', '2028-01-01', { assigneeIds: ['alice'] }),
      task('bob-old2027', '2027-01-01', { assigneeIds: ['bob'] }),
      // Both brand-new -- neither has ever been dragged.
      task('alice-new2026', '2026-01-01', { assigneeIds: ['alice'] }),
      task('bob-new2026', '2026-06-01', { assigneeIds: ['bob'] }),
    ];
    // A manual order recorded while working inside Alice's lane only.
    const rows = buildRows(tasks, [alice, bob], true, null, new Set(), 'start', null, ['alice-old2028']);
    const byPerson = new Map<string, string[]>();
    let currentHeader = '';
    for (const row of rows) {
      if (row.kind === 'header') {
        currentHeader = row.label;
        byPerson.set(currentHeader, []);
      } else {
        byPerson.get(currentHeader)!.push(row.id);
      }
    }
    expect(byPerson.get('Alice')).toEqual(['alice-new2026', 'alice-old2028']);
    expect(byPerson.get('Bob')).toEqual(['bob-new2026', 'bob-old2027']);
  });

  it('ignores manual order inside a swimlane -- a lane is always strictly date-sorted', () => {
    const alice: Person = { id: 'alice', name: 'Alice', color: '#000' };
    const tasks = [task('early', '2026-01-01', { assigneeIds: ['alice'] }), task('late', '2028-01-01', { assigneeIds: ['alice'] })];
    // A manual order that tries to put the later task first -- e.g. a
    // leftover recorded position from before this lane became strict, or
    // one shared with the flat/hierarchical view's own manual order.
    const rows = buildRows(tasks, [alice], true, null, new Set(), 'start', null, ['late', 'early']);
    expect(rows.filter((r) => r.kind === 'task').map((r) => r.id)).toEqual(['early', 'late']);
  });
});
