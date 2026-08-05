import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TaskEditTabs } from './TaskEditTabs';

describe('TaskEditTabs', () => {
  it('shows completed/total checklist items and the comment count', () => {
    const html = renderToStaticMarkup(
      <TaskEditTabs
        activeTab="details"
        onChange={() => undefined}
        cloudEnabled
        taskSaved
        counts={{ checklistCompleted: 3, checklistTotal: 8, comments: 4 }}
      />,
    );

    expect(html).toContain('Checkliste (3/8)');
    expect(html).toContain('Kommentare (4)');
  });
});
