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
        counts={{
          checklistCompleted: 3,
          checklistTotal: 8,
          ownChecklistCompleted: 1,
          ownChecklistTotal: 3,
          definitionCompleted: 2,
          definitionTotal: 5,
          definitionAvailable: true,
          comments: 4,
          attachments: 2,
        }}
      />,
    );

    expect(html).toContain('Checkliste (3/8)');
    expect(html).toContain('Kommentare (4)');
    expect(html).toContain('Anhänge (2)');
  });

  it('keeps cloud tabs clickable for a new task and explains the automatic save', () => {
    const html = renderToStaticMarkup(
      <TaskEditTabs
        activeTab="details"
        onChange={() => undefined}
        cloudEnabled
        taskSaved={false}
        counts={{
          checklistCompleted: 0,
          checklistTotal: 0,
          ownChecklistCompleted: 0,
          ownChecklistTotal: 0,
          definitionCompleted: 0,
          definitionTotal: 0,
          definitionAvailable: false,
          comments: 0,
          attachments: 0,
        }}
      />,
    );

    expect(html).not.toContain('disabled=""');
    expect(html).toContain('Pflichtfelder prüfen, Aufgabe speichern und Bereich öffnen');
  });
});
