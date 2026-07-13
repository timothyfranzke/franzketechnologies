import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  createAccount,
  addTransaction,
  createFlag,
  deleteFlagAndUnflag,
  countFlagged,
  createRecurringRule,
  materializeRecurring,
  validateImport,
  importReplace,
  exportAll,
} from '../db.js';
import { flagRollup } from '../derive.js';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('flagRollup', () => {
  it('sums net, inflow, outflow, count for one flag only', () => {
    const account = { id: 'A', startingBalance: 0 };
    const txs = [
      { flagId: 'f1', type: 'income', amount: 200000, accountId: 'A' },
      { flagId: 'f1', type: 'expense', amount: 45000, accountId: 'A' },
      { flagId: 'f2', type: 'expense', amount: 8000, accountId: 'A' },
      { flagId: null, type: 'expense', amount: 999, accountId: 'A' },
    ];
    expect(flagRollup(account, txs, { id: 'f1' })).toEqual({ net: 155000, inflow: 200000, outflow: -45000, seed: 0, count: 2 });
    expect(flagRollup(account, txs, { id: 'f2' })).toEqual({ net: -8000, inflow: 0, outflow: -8000, seed: 0, count: 1 });
    expect(flagRollup(account, txs, { id: 'missing' })).toEqual({ net: 0, inflow: 0, outflow: 0, seed: 0, count: 0 });
  });

  it('adds the seed to net without touching in/out', () => {
    const account = { id: 'A', startingBalance: 0 };
    const txs = [{ flagId: 'f1', type: 'expense', amount: 45000, accountId: 'A' }];
    const r = flagRollup(account, txs, { id: 'f1', seed: 200000 });
    expect(r).toEqual({ net: 155000, inflow: 0, outflow: -45000, seed: 200000, count: 1 });
    // seed alone counts even with zero transactions
    expect(flagRollup(account, [], { id: 'f2', seed: -5000 }).net).toBe(-5000);
  });

  it('signs transfers per viewing side', () => {
    const t = { flagId: 'f1', type: 'transfer', amount: 20000, accountId: 'A', transferAccountId: 'B' };
    expect(flagRollup({ id: 'A' }, [t], { id: 'f1' }).net).toBe(-20000);
    expect(flagRollup({ id: 'B' }, [t], { id: 'f1' }).net).toBe(20000);
  });
});

describe('flag CRUD', () => {
  it('deleting a flag unflags its transactions without deleting them', async () => {
    const acct = await createAccount({ name: 'Checking' });
    const flag = await createFlag({ name: "Tim's bonus", color: 1 });
    await addTransaction({ accountId: acct.id, type: 'income', payee: 'Bonus', amount: 200000, flagId: flag.id });
    await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Target', amount: 5432, flagId: flag.id });

    expect(await countFlagged(flag.id)).toBe(2);
    await deleteFlagAndUnflag(flag.id);

    expect(await db.flags.count()).toBe(0);
    const txs = await db.transactions.toArray();
    expect(txs).toHaveLength(2);
    expect(txs.every((t) => t.flagId === null)).toBe(true);
  });

  it('recurring instances inherit the template flagId', async () => {
    const acct = await createAccount({ name: 'Checking' });
    const flag = await createFlag({ name: "Tim's bonus" });
    await createRecurringRule({
      accountId: acct.id,
      frequency: 'weekly',
      startDate: '2026-07-06',
      template: { type: 'income', payee: 'Bonus drip', amount: 10000, categoryId: null, memo: null, checkNum: null, transferAccountId: null, flagId: flag.id },
    });
    await materializeRecurring('2026-07-13');
    const txs = await db.transactions.toArray();
    expect(txs.length).toBeGreaterThan(0);
    expect(txs.every((t) => t.flagId === flag.id)).toBe(true);
  });
});

describe('schema v1 → v2', () => {
  it('accepts v1 import files (flags default empty), rejects unknown versions', async () => {
    const v1 = {
      schemaVersion: 1,
      accounts: [{ id: 'a1', name: 'Old', startingBalance: 1000, createdAt: 1 }],
      categories: [],
      transactions: [{ id: 't1', accountId: 'a1', type: 'expense', payee: 'X', amount: 100, date: '2026-01-01', cleared: false, reconciled: false, createdAt: 1, updatedAt: 1 }],
      recurringRules: [],
      reconciliations: [],
    };
    expect(validateImport(v1)).toBeNull();
    expect(validateImport({ ...v1, schemaVersion: 3 })).toMatch(/schema version/);

    await importReplace(v1);
    expect(await db.flags.count()).toBe(0);
    expect((await exportAll()).schemaVersion).toBe(2);
    expect((await db.transactions.get('t1')).payee).toBe('X');
  });

  it('upgrades an existing v1 database in place', async () => {
    await db.delete();
    // simulate a database created by the shipped v1 app
    const old = new Dexie('ledger');
    old.version(1).stores({
      accounts: 'id, name',
      transactions: 'id, accountId, [accountId+date], transferAccountId, date, ruleId',
      categories: 'id, type, sortOrder',
      reconciliations: 'id, accountId, statementDate',
      recurringRules: 'id, accountId',
      meta: 'key',
    });
    await old.open();
    await old.accounts.add({ id: 'a1', name: 'Old checking', startingBalance: 12345, createdAt: 1 });
    await old.transactions.add({ id: 't1', accountId: 'a1', type: 'expense', payee: 'Legacy', amount: 100, date: '2026-01-01', cleared: true, reconciled: false, createdAt: 1, updatedAt: 1 });
    old.close();

    await db.open(); // runs the v2 upgrade
    expect((await db.accounts.get('a1')).name).toBe('Old checking');
    expect((await db.transactions.get('t1')).payee).toBe('Legacy');
    expect(await db.flags.count()).toBe(0);
    const flag = await createFlag({ name: 'Post-upgrade' });
    await db.transactions.update('t1', { flagId: flag.id });
    expect(await countFlagged(flag.id)).toBe(1);
  });
});
