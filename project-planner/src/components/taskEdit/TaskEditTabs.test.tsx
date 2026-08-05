import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TaskEditTabs } from './TaskEditTabs';

describe('TaskEditTabs', () => {
  it('shows checklist, comment and attachment counts', () => {
    const html = renderToStaticMarkup(
      <TaskEditTabs
        activeTab="details"
        onChange={() => undefined}
        cloudEnabled
        taskSaved
        counts={{ checklistCompleted: 3, checklistTotal: 8, comments: 4, attachments: 2 }}
      />,
    );

    expect(html).toContain('Checkliste (3/8)');
    expect(html).toContain('Kommentare (4)');
    expect(html).toContain('Anhänge (2)');
  });
});
