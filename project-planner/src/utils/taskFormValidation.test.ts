import { describe, expect, it } from 'vitest';
import { datesFromPredecessor, latestTaskEnd, validateTaskForm } from './taskFormValidation';

describe('task form rules', () => {
  it('requires both dates and predecessor/successor decisions for a task', () => {
    expect(validateTaskForm({
      type: 'task',
      start: '',
      end: '',
      isSummary: false,
      hasPredecessor: false,
      hasSuccessor: false,
      predecessorUnknown: false,
      successorUnknown: false,
      assigneeCount: 0,
    })).toEqual({
      start: 'Bitte ein Startdatum eintragen.',
      end: 'Bitte ein Enddatum eintragen.',
      predecessor: 'Bitte einen Vorgänger wählen oder „Vorgänger noch nicht bekannt“ markieren.',
      successor: 'Bitte einen Nachfolger wählen oder „Nachfolger noch nicht bekannt“ markieren.',
      assignee: 'Bitte mindestens eine Person zuweisen.',
    });
  });

  it('accepts the explicit unknown choices', () => {
    expect(validateTaskForm({
      type: 'task',
      start: '2027-03-01',
      end: '2027-03-05',
      isSummary: false,
      hasPredecessor: false,
      hasSuccessor: false,
      predecessorUnknown: true,
      successorUnknown: true,
      assigneeCount: 1,
    })).toEqual({});
  });

  it('allows milestones without an assigned person', () => {
    expect(validateTaskForm({
      type: 'milestone',
      start: '2027-03-01',
      end: '2027-03-01',
      isSummary: false,
      hasPredecessor: false,
      hasSuccessor: false,
      predecessorUnknown: false,
      successorUnknown: false,
      assigneeCount: 0,
    })).toEqual({});
  });

  it('ignores a stale end date on a milestone, even when it is earlier than the chosen date', () => {
    // A milestone has no visible end-date field -- `end` is whatever it was
    // left at when the dialog opened (today), stale the moment `start` is
    // moved into the future. This used to fail with the task-only "end
    // before start" check, silently: the error had nowhere to render since
    // milestones don't show an Enddatum field at all.
    expect(validateTaskForm({
      type: 'milestone',
      start: '2027-03-10',
      end: '2026-01-01',
      isSummary: false,
      hasPredecessor: false,
      hasSuccessor: false,
      predecessorUnknown: false,
      successorUnknown: false,
      assigneeCount: 0,
    })).toEqual({});
  });

  it('uses the latest predecessor end and preserves task duration', () => {
    expect(latestTaskEnd([{ end: '2027-03-08' }, { end: '2027-03-12' }])).toBe('2027-03-12');
    expect(datesFromPredecessor('2027-03-01', '2027-03-04', '2027-03-12')).toEqual({
      start: '2027-03-12',
      end: '2027-03-15',
    });
  });
});
