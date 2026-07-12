import Dexie from 'dexie';
import { dueInstances, todayIso } from './recurring.js';

export const SCHEMA_VERSION = 1;

export const db = new Dexie('ledger');

db.version(1).stores({
  accounts: 'id, name',
  transactions: 'id, accountId, [accountId+date], transferAccountId, date, ruleId',
  categories: 'id, type, sortOrder',
  reconciliations: 'id, accountId, statementDate',
  recurringRules: 'id, accountId',
  meta: 'key',
});

const DEFAULT_CATEGORIES = [
  ...['Groceries', 'Dining', 'Gas', 'Household', 'Housing', 'Subscriptions', 'Utilities', 'Health', 'Entertainment', 'Misc'].map(
    (name, i) => ({ name, type: 'expense', sortOrder: i })
  ),
  ...['Paycheck', 'Interest', 'Other income'].map((name, i) => ({ name, type: 'income', sortOrder: i })),
].map((c) => ({ ...c, id: crypto.randomUUID(), icon: null, archived: false }));

db.on('populate', () => {
  db.categories.bulkAdd(DEFAULT_CATEGORIES);
  db.meta.add({ key: 'schemaVersion', value: SCHEMA_VERSION });
});

// Best-effort durable storage; browsers may silently decline. Runs once.
async function requestPersistence() {
  const flag = await db.meta.get('persistRequested');
  if (flag || typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  await db.meta.put({ key: 'persistRequested', value: true });
  navigator.storage.persist().catch(() => {});
}

// ── Accounts ────────────────────────────────────────────────────────────────

export async function createAccount({ name, startingBalance = 0 }) {
  const account = { id: crypto.randomUUID(), name, startingBalance, createdAt: Date.now() };
  await db.accounts.add(account);
  await requestPersistence();
  return account;
}

export function renameAccount(id, name) {
  return db.accounts.update(id, { name });
}

/**
 * Deletes the account and everything scoped to it. Transfer rows shared with
 * other accounts are rewritten to preserve the surviving side's history:
 * a transfer INTO a surviving account becomes its income; a transfer OUT of
 * a surviving account becomes its expense.
 */
export function deleteAccountCascade(id) {
  return db.transaction('rw', db.accounts, db.transactions, db.recurringRules, db.reconciliations, db.meta, async () => {
    const outgoing = await db.transactions.where('accountId').equals(id).toArray();
    for (const tx of outgoing) {
      if (tx.type === 'transfer' && tx.transferAccountId) {
        await db.transactions.update(tx.id, {
          accountId: tx.transferAccountId,
          type: 'income',
          transferAccountId: null,
          updatedAt: Date.now(),
        });
      } else {
        await db.transactions.delete(tx.id);
      }
    }
    await db.transactions.where('transferAccountId').equals(id).modify({
      type: 'expense',
      transferAccountId: null,
      updatedAt: Date.now(),
    });
    await db.recurringRules.where('accountId').equals(id).delete();
    await db.reconciliations.where('accountId').equals(id).delete();
    await db.meta.delete(`prefs:${id}`);
    await db.accounts.delete(id);
  });
}

// ── Transactions ────────────────────────────────────────────────────────────

export async function addTransaction(fields) {
  const now = Date.now();
  const tx = {
    id: crypto.randomUUID(),
    categoryId: null,
    checkNum: null,
    memo: null,
    transferAccountId: null,
    ruleId: null,
    cleared: false,
    reconciled: false,
    date: todayIso(),
    ...fields,
    createdAt: now,
    updatedAt: now,
  };
  await db.transactions.add(tx);
  await requestPersistence();
  return tx;
}

export function updateTransaction(id, changes) {
  return db.transactions.update(id, { ...changes, updatedAt: Date.now() });
}

export function deleteTransaction(id) {
  return db.transactions.delete(id);
}

export function toggleCleared(id) {
  return db.transaction('rw', db.transactions, async () => {
    const tx = await db.transactions.get(id);
    if (tx) await db.transactions.update(id, { cleared: !tx.cleared, updatedAt: Date.now() });
  });
}

export function markCleared(ids) {
  return db.transaction('rw', db.transactions, () =>
    db.transactions.where('id').anyOf(ids).modify({ cleared: true, updatedAt: Date.now() })
  );
}

/** All transactions visible in an account's register (both transfer sides). */
export function registerQuery(accountId) {
  return db.transactions
    .where('accountId')
    .equals(accountId)
    .or('transferAccountId')
    .equals(accountId)
    .toArray();
}

// ── Reconcile ───────────────────────────────────────────────────────────────

export function finishReconcile(accountId, { statementDate, endingBalance }, txIds) {
  return db.transaction('rw', db.transactions, db.reconciliations, async () => {
    await db.transactions
      .where('id')
      .anyOf(txIds)
      .modify({ reconciled: true, cleared: true, updatedAt: Date.now() });
    await db.reconciliations.add({
      id: crypto.randomUUID(),
      accountId,
      statementDate,
      endingBalance,
      txCount: txIds.length,
      finishedAt: Date.now(),
    });
  });
}

// ── Recurring ───────────────────────────────────────────────────────────────

/** Materialize every due instance across all rules. Returns count created. */
export function materializeRecurring(today = todayIso()) {
  return db.transaction('rw', db.recurringRules, db.transactions, async () => {
    const rules = await db.recurringRules.toArray();
    let created = 0;
    for (const rule of rules) {
      if (!rule.nextDue) continue;
      const { dates, nextDue, occurrencesDone } = dueInstances(rule, today);
      if (!dates.length && nextDue === rule.nextDue) continue;
      const now = Date.now();
      for (const date of dates) {
        await db.transactions.add({
          id: crypto.randomUUID(),
          ...rule.template,
          accountId: rule.accountId,
          date,
          cleared: false,
          reconciled: false,
          ruleId: rule.id,
          createdAt: now,
          updatedAt: now,
        });
        created += 1;
      }
      await db.recurringRules.update(rule.id, { nextDue, occurrencesDone });
    }
    return created;
  });
}

export async function createRecurringRule({ accountId, frequency, interval = 1, endCondition = { type: 'never' }, startDate, template }) {
  const rule = {
    id: crypto.randomUUID(),
    accountId,
    frequency,
    interval,
    endCondition,
    nextDue: startDate,
    anchorDay: Number(startDate.split('-')[2]),
    occurrencesDone: 0,
    template,
  };
  await db.recurringRules.add(rule);
  return rule;
}

export function updateRecurringRule(id, changes) {
  return db.recurringRules.update(id, changes);
}

export function deleteRecurringRule(id) {
  return db.recurringRules.delete(id);
}

// ── Export / import ─────────────────────────────────────────────────────────

const DATA_TABLES = ['accounts', 'categories', 'transactions', 'recurringRules', 'reconciliations'];

export async function exportAll() {
  const snapshot = { schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString() };
  for (const table of DATA_TABLES) snapshot[table] = await db[table].toArray();
  return snapshot;
}

export function validateImport(data) {
  if (!data || typeof data !== 'object') return 'Not a valid export file.';
  if (data.schemaVersion !== SCHEMA_VERSION) return `Unsupported schema version: ${data.schemaVersion}.`;
  for (const table of DATA_TABLES) {
    if (!Array.isArray(data[table])) return `Missing "${table}" data.`;
  }
  return null;
}

/** Destructive: wipes every table and loads the snapshot, atomically. */
export function importReplace(data) {
  const tables = DATA_TABLES.map((t) => db[t]);
  return db.transaction('rw', [...tables, db.meta], async () => {
    for (const table of DATA_TABLES) {
      await db[table].clear();
      await db[table].bulkAdd(data[table]);
    }
  });
}

/** Inserts records whose ids are absent; existing ids win. Returns counts. */
export function importMerge(data) {
  const tables = DATA_TABLES.map((t) => db[t]);
  return db.transaction('rw', tables, async () => {
    const counts = {};
    for (const table of DATA_TABLES) {
      const existing = new Set(await db[table].toCollection().primaryKeys());
      const fresh = data[table].filter((r) => !existing.has(r.id));
      await db[table].bulkAdd(fresh);
      counts[table] = fresh.length;
    }
    return counts;
  });
}

// ── Per-account UI prefs ────────────────────────────────────────────────────

export async function getPrefs(accountId) {
  const row = await db.meta.get(`prefs:${accountId}`);
  return row?.value ?? { hideCleared: false };
}

export async function setPrefs(accountId, value) {
  await db.meta.put({ key: `prefs:${accountId}`, value });
}

export async function getMeta(key) {
  return (await db.meta.get(key))?.value;
}

export function setMeta(key, value) {
  return db.meta.put({ key, value });
}
