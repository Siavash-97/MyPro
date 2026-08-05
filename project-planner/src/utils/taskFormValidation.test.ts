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
    })).toEqual({
      start: 'Bitte ein Startdatum eintragen.',
      end: 'Bitte ein Enddatum eintragen.',
      predecessor: 'Bitte einen Vorgänger wählen oder „Vorgänger noch nicht bekannt“ markieren.',
      successor: 'Bitte einen Nachfolger wählen oder „Nachfolger noch nicht bekannt“ markieren.',
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
