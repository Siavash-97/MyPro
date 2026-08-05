import { describe, expect, it } from 'vitest';
import { definitionOfDoneItemsForWorkPackage } from './definitionOfDoneScope';

describe('Definition of Done work-package scope', () => {
  it('never exposes items from a different work package', () => {
    const items = [
      { id: 'one', workPackageId: 'wp-1' },
      { id: 'two', workPackageId: 'wp-2' },
      { id: 'three', workPackageId: 'wp-1' },
    ];

    expect(definitionOfDoneItemsForWorkPackage(items, 'wp-1').map((item) => item.id)).toEqual(['one', 'three']);
    expect(definitionOfDoneItemsForWorkPackage(items, 'wp-2').map((item) => item.id)).toEqual(['two']);
    expect(definitionOfDoneItemsForWorkPackage(items, null)).toEqual([]);
  });
});
