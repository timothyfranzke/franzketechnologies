import { describe, it, expect } from 'vitest';
import {
  txSign,
  accountTotals,
  withRunningBalances,
  lastReconciledBalance,
  reconcileDifference,
} from '../derive.js';

const checking = { id: 'A', startingBalance: 50000 };
const savings = { id: 'B', startingBalance: 0 };

let seq = 0;
const tx = (over) => ({
  id: `t${seq}`,
  accountId: 'A',
  type: 'expense',
  amount: 1000,
  date: '2026-07-10',
  cleared: false,
  reconciled: false,
  transferAccountId: null,
  createdAt: ++seq,
  ...over,
});

describe('txSign', () => {
  it('is negative for expense, positive for income', () => {
    expect(txSign(tx({ type: 'expense' }), 'A')).toBe(-1);
    expect(txSign(tx({ type: 'income' }), 'A')).toBe(1);
  });
  it('flips per side for transfers', () => {
    const t = tx({ type: 'transfer', transferAccountId: 'B' });
    expect(txSign(t, 'A')).toBe(-1); // outflow at source
    expect(txSign(t, 'B')).toBe(1); // inflow at destination
  });
});

describe('accountTotals', () => {
  it('matches acceptance criteria 1-3', () => {
    // 1. $500.00 starting, no transactions
    expect(accountTotals(checking, [])).toEqual({ cleared: 50000, outstanding: 0, balance: 50000 });

    // 2. uncleared expense $113.73
    const expense = tx({ amount: 11373 });
    expect(accountTotals(checking, [expense])).toEqual({
      cleared: 50000,
      outstanding: -11373,
      balance: 38627,
    });

    // 3. toggled cleared
    expect(accountTotals(checking, [{ ...expense, cleared: true }])).toEqual({
      cleared: 38627,
      outstanding: 0,
      balance: 38627,
    });
  });

  it('counts a transfer once per side', () => {
    const t = tx({ type: 'transfer', transferAccountId: 'B', amount: 20000, cleared: true });
    expect(accountTotals(checking, [t]).cleared).toBe(30000);
    expect(accountTotals(savings, [t]).cleared).toBe(20000);
  });
});

describe('withRunningBalances', () => {
  it('applies date order with createdAt tiebreak, returns newest-first', () => {
    const a = tx({ amount: 1000, date: '2026-07-01', type: 'income' }); // created 1st
    const b = tx({ amount: 2000, date: '2026-07-01' }); // created 2nd, same date
    const c = tx({ amount: 500, date: '2026-07-02' });
    const rows = withRunningBalances(checking, [c, b, a]);
    expect(rows.map((r) => r.tx.id)).toEqual([c.id, b.id, a.id]);
    expect(rows.map((r) => r.running)).toEqual([48500, 49000, 51000]);
  });
});

describe('reconcile math', () => {
  it('computes difference against last reconciled balance', () => {
    const done = tx({ amount: 10000, cleared: true, reconciled: true });
    const pending = tx({ amount: 11373, cleared: true });
    const reconciled = lastReconciledBalance(checking, [done, pending]);
    expect(reconciled).toBe(40000);

    // statement says $286.27 → checking off `pending` balances exactly
    expect(reconcileDifference(28627, reconciled, [pending], 'A')).toBe(0);
    expect(reconcileDifference(28627, reconciled, [], 'A')).toBe(-11373);
  });
});
