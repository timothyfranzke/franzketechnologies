import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  createAccount,
  deleteAccountCascade,
  addTransaction,
  toggleCleared,
  markCleared,
  registerQuery,
  finishReconcile,
  createRecurringRule,
  materializeRecurring,
  exportAll,
  validateImport,
  importReplace,
  importMerge,
} from '../db.js';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('accounts and transactions', () => {
  it('seeds default categories on first open', async () => {
    expect(await db.categories.count()).toBeGreaterThan(10);
  });

  it('toggles cleared and bulk-marks cleared', async () => {
    const acct = await createAccount({ name: 'Checking', startingBalance: 50000 });
    const a = await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Target', amount: 5432 });
    const b = await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Shell', amount: 4820 });

    await toggleCleared(a.id);
    expect((await db.transactions.get(a.id)).cleared).toBe(true);
    await toggleCleared(a.id);
    expect((await db.transactions.get(a.id)).cleared).toBe(false);

    await markCleared([a.id, b.id]);
    expect((await db.transactions.get(a.id)).cleared).toBe(true);
    expect((await db.transactions.get(b.id)).cleared).toBe(true);
  });

  it('shows transfers in both registers', async () => {
    const a = await createAccount({ name: 'Checking' });
    const b = await createAccount({ name: 'Savings' });
    await addTransaction({ accountId: a.id, type: 'transfer', payee: 'Transfer to Savings', amount: 20000, transferAccountId: b.id });

    expect(await registerQuery(a.id)).toHaveLength(1);
    expect(await registerQuery(b.id)).toHaveLength(1);
  });

  it('cascade delete preserves the surviving side of transfers', async () => {
    const a = await createAccount({ name: 'Checking' });
    const b = await createAccount({ name: 'Savings' });
    // a → b and b → a, plus a plain expense on a
    await addTransaction({ accountId: a.id, type: 'transfer', payee: 'To savings', amount: 100, transferAccountId: b.id });
    await addTransaction({ accountId: b.id, type: 'transfer', payee: 'To checking', amount: 200, transferAccountId: a.id });
    await addTransaction({ accountId: a.id, type: 'expense', payee: 'Target', amount: 300 });

    await deleteAccountCascade(a.id);

    const remaining = await db.transactions.toArray();
    expect(remaining).toHaveLength(2);
    // a→b became b's income; b→a became b's expense; plain expense gone
    expect(remaining.every((t) => t.accountId === b.id && t.transferAccountId === null)).toBe(true);
    expect(remaining.find((t) => t.amount === 100).type).toBe('income');
    expect(remaining.find((t) => t.amount === 200).type).toBe('expense');
  });
});

describe('reconcile', () => {
  it('locks transactions and logs the statement (acceptance #4)', async () => {
    const acct = await createAccount({ name: 'Checking', startingBalance: 50000 });
    const tx = await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Target', amount: 11373, cleared: true });

    await finishReconcile(acct.id, { statementDate: '2026-07-12', endingBalance: 38627 }, [tx.id]);

    const locked = await db.transactions.get(tx.id);
    expect(locked.reconciled).toBe(true);
    expect(locked.cleared).toBe(true);

    const log = await db.reconciliations.where('accountId').equals(acct.id).toArray();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ endingBalance: 38627, txCount: 1, statementDate: '2026-07-12' });
  });
});

describe('recurring materialization', () => {
  it('creates uncleared instances and advances the rule', async () => {
    const acct = await createAccount({ name: 'Checking' });
    await createRecurringRule({
      accountId: acct.id,
      frequency: 'biweekly',
      startDate: '2026-06-20',
      template: { type: 'income', payee: 'Paycheck', amount: 165000, categoryId: null, memo: null, checkNum: null, transferAccountId: null },
    });

    const created = await materializeRecurring('2026-07-12');
    expect(created).toBe(2); // Jun 20, Jul 4

    const txs = await db.transactions.toArray();
    expect(txs.map((t) => t.date).sort()).toEqual(['2026-06-20', '2026-07-04']);
    expect(txs.every((t) => t.cleared === false && t.ruleId)).toBe(true);

    // idempotent: nothing new until the next due date
    expect(await materializeRecurring('2026-07-12')).toBe(0);
    expect(await materializeRecurring('2026-07-18')).toBe(1);
  });
});

describe('write atomicity (acceptance #6)', () => {
  it('a transaction that dies mid-write leaves no partial state', async () => {
    const acct = await createAccount({ name: 'Checking', startingBalance: 50000 });
    const before = await db.transactions.count();

    await expect(
      db.transaction('rw', db.transactions, async () => {
        await db.transactions.add({ id: 'partial-1', accountId: acct.id, type: 'expense', payee: 'A', amount: 100, date: '2026-07-12', cleared: false, reconciled: false, createdAt: 1, updatedAt: 1 });
        throw new Error('force-kill');
      })
    ).rejects.toThrow('force-kill');

    expect(await db.transactions.count()).toBe(before);
    expect(await db.transactions.get('partial-1')).toBeUndefined();
  });
});

describe('export / import', () => {
  async function seed() {
    const acct = await createAccount({ name: 'Checking', startingBalance: 50000 });
    const tx = await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Target', amount: 11373, cleared: true });
    await finishReconcile(acct.id, { statementDate: '2026-07-12', endingBalance: 38627 }, [tx.id]);
    return acct;
  }

  it('round-trips identically through export → wipe → import (acceptance #5)', async () => {
    await seed();
    const snapshot = await exportAll();
    expect(validateImport(snapshot)).toBeNull();

    await db.delete();
    await db.open();
    await importReplace(snapshot);

    const after = await exportAll();
    for (const table of ['accounts', 'categories', 'transactions', 'recurringRules', 'reconciliations']) {
      expect(after[table]).toEqual(snapshot[table]);
    }
  });

  it('merge dedupes by id', async () => {
    await seed();
    const snapshot = await exportAll();
    const counts = await importMerge(snapshot);
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);

    snapshot.transactions.push({ ...snapshot.transactions[0], id: 'brand-new' });
    const counts2 = await importMerge(snapshot);
    expect(counts2.transactions).toBe(1);
    expect(await db.transactions.count()).toBe(2);
  });

  it('rejects wrong schema versions', () => {
    expect(validateImport({ schemaVersion: 99 })).toMatch(/schema version/);
    expect(validateImport(null)).toBeTruthy();
  });
});
