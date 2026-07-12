import { describe, it, expect } from 'vitest';
import { buildCsv } from '../export.js';

const account = { id: 'A', startingBalance: 50000 };
const categories = [{ id: 'c1', name: 'Groceries' }];

describe('buildCsv', () => {
  it('emits signed decimal amounts oldest-first with escaping', () => {
    const txs = [
      { id: 't2', accountId: 'A', type: 'income', payee: 'Paycheck', amount: 165000, categoryId: null, date: '2026-07-05', checkNum: null, memo: null, cleared: true, reconciled: false, createdAt: 2, transferAccountId: null },
      { id: 't1', accountId: 'A', type: 'expense', payee: 'Bob\'s "Best", LLC', amount: 5432, categoryId: 'c1', date: '2026-07-01', checkNum: '1041', memo: 'weekly, groceries', cleared: false, reconciled: false, createdAt: 1, transferAccountId: null },
    ];
    const csv = buildCsv(account, txs, categories);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('date,payee,category,type,checkNum,memo,amount,cleared,reconciled');
    expect(lines[1]).toBe('2026-07-01,"Bob\'s ""Best"", LLC",Groceries,expense,1041,"weekly, groceries",-54.32,false,false');
    expect(lines[2]).toBe('2026-07-05,Paycheck,,income,,,1650.00,true,false');
  });

  it('signs transfers per viewing side', () => {
    const t = { id: 't', accountId: 'A', type: 'transfer', payee: 'To savings', amount: 20000, categoryId: null, date: '2026-07-08', checkNum: null, memo: null, cleared: true, reconciled: false, createdAt: 1, transferAccountId: 'B' };
    expect(buildCsv(account, [t], categories).split('\n')[1]).toContain('-200.00');
    expect(buildCsv({ id: 'B', startingBalance: 0 }, [t], categories).split('\n')[1]).toContain(',200.00');
  });
});
