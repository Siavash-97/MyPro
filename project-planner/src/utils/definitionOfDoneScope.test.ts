import { describe, expect, it } from 'vitest';
import { definitionOfDoneItemsForTask } from './definitionOfDoneScope';

describe('Definition of Done task scope', () => {
  it('never exposes items from a different task', () => {
    const items = [
      { id: 'one', taskId: 'task-1' },
      { id: 'two', taskId: 'task-2' },
      { id: 'three', taskId: 'task-1' },
    ];

    expect(definitionOfDoneItemsForTask(items, 'task-1').map((item) => item.id)).toEqual(['one', 'three']);
    expect(definitionOfDoneItemsForTask(items, 'task-2').map((item) => item.id)).toEqual(['two']);
    expect(definitionOfDoneItemsForTask(items, 'missing')).toEqual([]);
  });
});
