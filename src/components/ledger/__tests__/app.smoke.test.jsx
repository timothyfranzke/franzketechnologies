// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import App from '../App.jsx';
import { db, createAccount, addTransaction } from '../db.js';

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
});
