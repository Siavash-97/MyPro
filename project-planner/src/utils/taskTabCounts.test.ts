import { describe, expect, it } from 'vitest';
import { calculateTaskTabCounts } from './taskTabCounts';

describe('task modal tab counts', () => {
  it('combines task checklist and Definition of Done progress', () => {
    const counts = calculateTaskTabCounts(
      [{ done: true }, { done: false }],
      4,
      [{ id: 'dod-1' }, { id: 'dod-2' }, { id: 'dod-3' }],
      [
        { itemId: 'dod-1', done: true },
        { itemId: 'dod-2', done: false },
        { itemId: 'deleted-item', done: true },
      ],
      3,
    );

    expect(counts).toEqual({
      checklistCompleted: 2,
      checklistTotal: 5,
      definitionCompleted: 1,
      definitionTotal: 3,
      definitionAvailable: true,
      comments: 4,
      attachments: 3,
    });
  });
});
