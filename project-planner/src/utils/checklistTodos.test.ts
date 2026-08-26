import { describe, expect, it } from 'vitest';
import { buildChecklistTodos, filterChecklistTodosByPerson, normalizeChecklistStatus } from './checklistTodos';
import type { Task } from '../types';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    type: 'task',
    title: 'App-Frontend finalisieren',
    start: '2026-08-01',
    end: '2026-08-10',
    assigneeIds: ['person-1'],
    workPackageId: null,
    color: '#3b82f6',
    progress: 0,
    status: 'not_started',
    notes: '',
    parentId: null,
    ...overrides,
  };
}

describe('normalizeChecklistStatus', () => {
  it('is always "completed" when done is true, regardless of the stored status', () => {
    expect(normalizeChecklistStatus('in_progress', true)).toBe('completed');
    expect(normalizeChecklistStatus(undefined, true)).toBe('completed');
  });

  it('keeps a valid non-completed status when done is false', () => {
    expect(normalizeChecklistStatus('in_progress', false)).toBe('in_progress');
    expect(normalizeChecklistStatus('waiting', false)).toBe('waiting');
  });

  it('falls back to "not_started" for a missing or invalid status when done is false', () => {
    expect(normalizeChecklistStatus(undefined, false)).toBe('not_started');
    expect(normalizeChecklistStatus('completed', false)).toBe('not_started');
    expect(normalizeChecklistStatus('nonsense', false)).toBe('not_started');
  });
});

describe('buildChecklistTodos', () => {
  it('carries the parent task title and assignees onto its checklist item', () => {
    const todos = buildChecklistTodos(
      [{ id: 'item-1', taskId: 'task-1', text: 'GPS Genauigkeit prüfen', status: 'not_started', done: false }],
      [task()],
    );

    expect(todos).toEqual([
      {
        id: 'item-1',
        taskId: 'task-1',
        taskTitle: 'App-Frontend finalisieren',
        text: 'GPS Genauigkeit prüfen',
        status: 'not_started',
        assigneeIds: ['person-1'],
      },
    ]);
  });

  it('normalizes the status through normalizeChecklistStatus instead of trusting the raw field', () => {
    const todos = buildChecklistTodos(
      [{ id: 'item-1', taskId: 'task-1', text: 'x', status: 'in_progress', done: true }],
      [task()],
    );

    expect(todos[0].status).toBe('completed');
  });

  it('drops items whose parent task no longer exists', () => {
    const todos = buildChecklistTodos(
      [{ id: 'item-1', taskId: 'missing-task', text: 'Verwaist', status: 'not_started', done: false }],
      [task()],
    );

    expect(todos).toEqual([]);
  });

  it('drops items belonging to a milestone', () => {
    const todos = buildChecklistTodos(
      [{ id: 'item-1', taskId: 'task-1', text: 'Sollte nicht erscheinen', status: 'not_started', done: false }],
      [task({ type: 'milestone' })],
    );

    expect(todos).toEqual([]);
  });
});

describe('filterChecklistTodosByPerson', () => {
  const todos = [
    { id: 'item-1', taskId: 'task-1', taskTitle: 'A', text: 'x', status: 'not_started' as const, assigneeIds: ['person-1'] },
    { id: 'item-2', taskId: 'task-2', taskTitle: 'B', text: 'y', status: 'not_started' as const, assigneeIds: ['person-2'] },
  ];

  it('returns everything when no person is selected', () => {
    expect(filterChecklistTodosByPerson(todos, null)).toEqual(todos);
  });

  it('keeps only items whose parent task is assigned to the given person', () => {
    expect(filterChecklistTodosByPerson(todos, 'person-2')).toEqual([todos[1]]);
  });
});
