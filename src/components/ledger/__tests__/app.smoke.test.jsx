// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import App from '../App.jsx';
import { db, createAccount, addTransaction, createFlag } from '../db.js';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(cleanup);

// happy-dom has no layout: give the virtualizer a real-looking viewport so it
// renders rows (row height exaggerated → overscan still covers all test data).
Element.prototype.getBoundingClientRect = function () {
  return { width: 390, height: 700, top: 0, left: 0, bottom: 700, right: 390, x: 0, y: 0, toJSON: () => ({}) };
};

// ...and a ResizeObserver that reports that rect immediately on observe.
globalThis.ResizeObserver = class {
  constructor(cb) {
    this.cb = cb;
  }
  observe(target) {
    this.cb([{ target, borderBoxSize: [{ inlineSize: 390, blockSize: 700 }] }], this);
  }
  unobserve() {}
  disconnect() {}
};

describe('App smoke', () => {
  it('shows first-run setup when no accounts exist', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Set up your first account')).toBeTruthy());
  });

  it('creates an account from first-run and lands on the empty register', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Start ledger'));
    fireEvent.click(screen.getByText('Start ledger'));
    await waitFor(() => expect(screen.getByText('No transactions yet')).toBeTruthy());
    expect(screen.getByText('Set opening balance')).toBeTruthy();
  });

  it('renders the register with grouped transactions and live totals', async () => {
    const acct = await createAccount({ name: 'Everyday Checking', startingBalance: 214350 });
    await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Target', amount: 5432 });
    await addTransaction({ accountId: acct.id, type: 'income', payee: 'Paycheck', amount: 165000, cleared: true });

    render(<App />);
    await waitFor(() => expect(screen.getByText('Target')).toBeTruthy());
    expect(screen.getByText('Outstanding · 1')).toBeTruthy();
    expect(screen.getByText('Cleared · 1')).toBeTruthy();
    // Balance = 2143.50 + 1650.00 - 54.32 — shown in the header AND as the
    // newest row's running balance
    expect(screen.getAllByText('$3,739.18').length).toBeGreaterThanOrEqual(2);

    // inline cleared toggle updates the header immediately
    fireEvent.click(screen.getByRole('button', { name: /Target: outstanding/ }));
    await waitFor(() => expect(screen.getByText('Cleared · 2')).toBeTruthy());
  });

  it('adds an uncleared expense through the form (acceptance #2)', async () => {
    const acct = await createAccount({ name: 'Checking', startingBalance: 50000 });
    await addTransaction({ accountId: acct.id, type: 'income', payee: 'Opening balance', amount: 0, cleared: true });

    render(<App />);
    await waitFor(() => screen.getByLabelText('Add transaction'));
    fireEvent.click(screen.getByLabelText('Add transaction'));

    await waitFor(() => screen.getByText('New Transaction'));
    for (const digit of ['1', '1', '3', '7', '3']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }
    fireEvent.change(screen.getByLabelText('Payee'), { target: { value: 'Target' } });
    fireEvent.click(screen.getByText('Save transaction'));

    // Back on the register: Outstanding −$113.73, Balance $386.27, Cleared $500.00
    await waitFor(() => expect(screen.queryByText('New Transaction')).toBeNull());
    await waitFor(() => expect(screen.getByText('Outstanding · 1')).toBeTruthy());
    expect(screen.getAllByText('−$113.73').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$386.27').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$500.00').length).toBeGreaterThanOrEqual(1);
  });

  it('reconciles to zero and locks transactions (acceptance #4)', async () => {
    const acct = await createAccount({ name: 'Checking', startingBalance: 50000 });
    const tx = await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Target', amount: 11373, cleared: true });

    render(<App />);
    await waitFor(() => screen.getByText('Reconcile'));
    fireEvent.click(screen.getByText('Reconcile'));

    // statement ending balance $386.27
    await waitFor(() => screen.getByText('Start reconciling'));
    for (const digit of ['3', '8', '6', '2', '7']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }
    fireEvent.click(screen.getByText('Start reconciling'));

    // the cleared expense is pre-checked → balanced immediately
    await waitFor(() => expect(screen.getByText('Balanced to the penny.')).toBeTruthy());
    fireEvent.click(screen.getByText('Finish reconciliation'));

    await waitFor(async () => {
      const locked = await db.transactions.get(tx.id);
      expect(locked.reconciled).toBe(true);
    });
    const log = await db.reconciliations.toArray();
    expect(log).toHaveLength(1);
    expect(log[0].endingBalance).toBe(38627);
  });

  it('batch select marks several outstanding transactions cleared', async () => {
    const acct = await createAccount({ name: 'Checking', startingBalance: 50000 });
    await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Target', amount: 5432 });
    await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Shell', amount: 4820 });

    render(<App />);
    await waitFor(() => screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByText('Select transactions'));

    await waitFor(() => screen.getByText('Select outstanding'));
    await waitFor(() => expect(screen.getByText('Outstanding · 2')).toBeTruthy());
    fireEvent.click(screen.getByText('All'));
    await waitFor(() =>
      expect(screen.getByText((_, el) => el.className?.includes?.('batch-count') && /2 selected/.test(el.textContent))).toBeTruthy()
    );
    fireEvent.click(screen.getByText('Mark cleared'));

    await waitFor(() => expect(screen.getByText('Cleared · 2')).toBeTruthy());
    expect((await db.transactions.toArray()).every((t) => t.cleared)).toBe(true);
  });

  it('warns when editing a reconciled transaction', async () => {
    const acct = await createAccount({ name: 'Checking', startingBalance: 50000 });
    await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Rent', amount: 145000, cleared: true, reconciled: true });

    render(<App />);
    await waitFor(() => screen.getByText('Rent'));
    fireEvent.click(screen.getByText('Rent'));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/reconciled/));
  });

  it('creates a flag inside the entry form and saves it on the transaction', async () => {
    const acct = await createAccount({ name: 'Checking', startingBalance: 50000 });
    await addTransaction({ accountId: acct.id, type: 'income', payee: 'Opening balance', amount: 0, cleared: true });

    render(<App />);
    await waitFor(() => screen.getByLabelText('Add transaction'));
    fireEvent.click(screen.getByLabelText('Add transaction'));
    await waitFor(() => screen.getByText('New Transaction'));

    for (const digit of ['2', '0', '0', '0', '0', '0']) {
      fireEvent.click(screen.getByRole('button', { name: digit }));
    }
    fireEvent.change(screen.getByLabelText('Payee'), { target: { value: 'Bonus check' } });

    fireEvent.click(screen.getByText('Flag'));
    await waitFor(() => screen.getByText('New flag…'));
    fireEvent.click(screen.getByText('New flag…'));
    fireEvent.change(screen.getByLabelText('Flag name'), { target: { value: "Tim's bonus" } });
    fireEvent.click(screen.getByText('Create flag'));

    // picker closed, flag shown on the form row
    await waitFor(() => expect(screen.getByText("Tim's bonus")).toBeTruthy());
    fireEvent.click(screen.getByText('Save transaction'));
    await waitFor(() => expect(screen.queryByText('New Transaction')).toBeNull());

    const flags = await db.flags.toArray();
    expect(flags).toHaveLength(1);
    const tx = (await db.transactions.toArray()).find((t) => t.payee === 'Bonus check');
    expect(tx.flagId).toBe(flags[0].id);
    expect(tx.amount).toBe(200000);
  });

  it('flag chips roll up and filter the register', async () => {
    const acct = await createAccount({ name: 'Checking', startingBalance: 50000 });
    const flag = await createFlag({ name: "Tim's bonus", color: 1 });
    await addTransaction({ accountId: acct.id, type: 'income', payee: 'Bonus check', amount: 200000, flagId: flag.id, cleared: true });
    await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Target', amount: 45000, flagId: flag.id });
    await addTransaction({ accountId: acct.id, type: 'expense', payee: 'Shell', amount: 4820 });

    render(<App />);

    // chip shows the live net: +$2,000.00 − $450.00 = +$1,550.00
    await waitFor(() => expect(screen.getByRole('button', { name: /Flag Tim's bonus, net \+\$1,550\.00/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Flag Tim's bonus/ }));

    // drill-in: header flips to In/Out, unflagged rows disappear
    await waitFor(() => expect(screen.getByText('In')).toBeTruthy());
    expect(screen.getByText('Out')).toBeTruthy();
    expect(screen.getAllByText('$2,000.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('−$450.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Shell')).toBeNull();
    expect(screen.getAllByText('Target').length).toBeGreaterThanOrEqual(1);

    // tap again exits flag mode
    fireEvent.click(screen.getByRole('button', { name: /Flag Tim's bonus/ }));
    await waitFor(() => expect(screen.getByText('Shell')).toBeTruthy());
    expect(screen.getByText('Balance')).toBeTruthy();
  });
});
