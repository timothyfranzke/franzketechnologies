import { db, createAccount } from './db.js';
import { toIso } from './recurring.js';

// Dev-only: /ledger?seed=10000 fills the register for scroll-performance checks.
const PAYEES = ['Target', "McDonald's", 'Shell', 'Costco', 'Netflix', 'Rent', "Trader Joe's", 'Amazon', 'HyVee', 'QuikTrip'];

export async function seedDemo(count) {
  if (await db.meta.get('devSeeded')) return;
  await db.meta.put({ key: 'devSeeded', value: count });

  let account = (await db.accounts.toArray())[0];
  if (!account) account = await createAccount({ name: 'Everyday Checking', startingBalance: 214350 });

  const categories = await db.categories.toArray();
  const start = Date.now();
  const txs = [];
  for (let i = 0; i < count; i++) {
    const income = i % 15 === 0;
    const daysAgo = Math.floor(i / 3);
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    txs.push({
      id: crypto.randomUUID(),
      accountId: account.id,
      type: income ? 'income' : 'expense',
      payee: income ? 'Paycheck' : PAYEES[i % PAYEES.length],
      amount: income ? 165000 : 100 + ((i * 7919) % 20000),
      categoryId: categories[i % categories.length]?.id ?? null,
      date: toIso({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }),
      checkNum: null,
      memo: null,
      transferAccountId: null,
      ruleId: null,
      cleared: i % 4 !== 0,
      reconciled: false,
      createdAt: start - i,
      updatedAt: start - i,
    });
  }
  await db.transactions.bulkAdd(txs);
}
