import { describe, it, expect } from 'vitest';
import { nextOccurrence, dueInstances } from '../recurring.js';

const rule = (over) => ({
  frequency: 'monthly',
  interval: 1,
  endCondition: { type: 'never' },
  nextDue: '2026-07-01',
  occurrencesDone: 0,
  ...over,
});

describe('nextOccurrence', () => {
  it('steps weekly and biweekly by days', () => {
    expect(nextOccurrence(rule({ frequency: 'weekly' }), '2026-07-01')).toBe('2026-07-08');
    expect(nextOccurrence(rule({ frequency: 'biweekly' }), '2026-07-01')).toBe('2026-07-15');
    expect(nextOccurrence(rule({ frequency: 'weekly', interval: 2 }), '2026-07-01')).toBe('2026-07-15');
  });

  it('crosses month boundaries on day steps', () => {
    expect(nextOccurrence(rule({ frequency: 'weekly' }), '2026-07-29')).toBe('2026-08-05');
  });

  it('clamps month-end and snaps back via anchor day', () => {
    const r = rule({ anchorDay: 31 });
    expect(nextOccurrence(r, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence(r, '2026-02-28')).toBe('2026-03-31');
  });

  it('handles yearly incl. leap-day clamp', () => {
    expect(nextOccurrence(rule({ frequency: 'yearly', anchorDay: 29 }), '2024-02-29')).toBe('2025-02-28');
  });
});

describe('dueInstances', () => {
  it('catches up multiple missed periods', () => {
    const r = rule({ frequency: 'weekly', nextDue: '2026-06-20' });
    const { dates, nextDue } = dueInstances(r, '2026-07-12');
    expect(dates).toEqual(['2026-06-20', '2026-06-27', '2026-07-04', '2026-07-11']);
    expect(nextDue).toBe('2026-07-18');
  });

  it('returns nothing when not yet due', () => {
    const r = rule({ nextDue: '2026-08-01' });
    const { dates, nextDue } = dueInstances(r, '2026-07-12');
    expect(dates).toEqual([]);
    expect(nextDue).toBe('2026-08-01');
  });

  it('stops after N occurrences', () => {
    const r = rule({ frequency: 'weekly', nextDue: '2026-06-20', endCondition: { type: 'count', n: 2 }, occurrencesDone: 1 });
    const { dates, nextDue, occurrencesDone } = dueInstances(r, '2026-07-12');
    expect(dates).toEqual(['2026-06-20']);
    expect(occurrencesDone).toBe(2);
    expect(nextDue).toBeNull();
  });

  it('stops at the until date', () => {
    const r = rule({ frequency: 'weekly', nextDue: '2026-06-20', endCondition: { type: 'until', date: '2026-06-30' } });
    const { dates, nextDue } = dueInstances(r, '2026-07-12');
    expect(dates).toEqual(['2026-06-20', '2026-06-27']);
    expect(nextDue).toBeNull();
  });
});
