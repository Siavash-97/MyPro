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
      ownChecklistCompleted: 1,
      ownChecklistTotal: 2,
      definitionCompleted: 1,
      definitionTotal: 3,
      definitionAvailable: true,
      comments: 4,
      attachments: 3,
    });
  });

  it('also reports the custom checklist alone, undiluted by Definition of Done items', () => {
    const counts = calculateTaskTabCounts(
      [{ done: true }, { done: true }, { done: false }],
      0,
      [{ id: 'dod-1' }],
      [{ itemId: 'dod-1', done: true }],
      0,
    );

    expect(counts.ownChecklistCompleted).toBe(2);
    expect(counts.ownChecklistTotal).toBe(3);
    // The combined tab-label count still includes Definition of Done.
    expect(counts.checklistCompleted).toBe(3);
    expect(counts.checklistTotal).toBe(4);
  });
});
