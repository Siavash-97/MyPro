import { describe, expect, it } from 'vitest';
import { buildChecklistTodos, filterChecklistTodosByPerson } from './checklistTodos';
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

describe('buildChecklistTodos', () => {
  it('carries the parent task title and assignees onto its checklist item', () => {
    const todos = buildChecklistTodos(
      [{ id: 'item-1', taskId: 'task-1', text: 'GPS Genauigkeit prüfen', done: false }],
      [task()],
    );

    expect(todos).toEqual([
      {
        id: 'item-1',
        taskId: 'task-1',
        taskTitle: 'App-Frontend finalisieren',
        text: 'GPS Genauigkeit prüfen',
        done: false,
        assigneeIds: ['person-1'],
      },
    ]);
  });

  it('drops items whose parent task no longer exists', () => {
    const todos = buildChecklistTodos(
      [{ id: 'item-1', taskId: 'missing-task', text: 'Verwaist', done: false }],
      [task()],
    );

    expect(todos).toEqual([]);
  });

  it('drops items belonging to a milestone', () => {
    const todos = buildChecklistTodos(
      [{ id: 'item-1', taskId: 'task-1', text: 'Sollte nicht erscheinen', done: false }],
      [task({ type: 'milestone' })],
    );

    expect(todos).toEqual([]);
  });
});

describe('filterChecklistTodosByPerson', () => {
  const todos = [
    { id: 'item-1', taskId: 'task-1', taskTitle: 'A', text: 'x', done: false, assigneeIds: ['person-1'] },
    { id: 'item-2', taskId: 'task-2', taskTitle: 'B', text: 'y', done: false, assigneeIds: ['person-2'] },
  ];

  it('returns everything when no person is selected', () => {
    expect(filterChecklistTodosByPerson(todos, null)).toEqual(todos);
  });

  it('keeps only items whose parent task is assigned to the given person', () => {
    expect(filterChecklistTodosByPerson(todos, 'person-2')).toEqual([todos[1]]);
  });
});
