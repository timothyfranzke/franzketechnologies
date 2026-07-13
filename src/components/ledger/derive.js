// Derived values — pure functions over in-memory arrays, never stored.
// A transaction "belongs" to a register if accountId matches (source side)
// or transferAccountId matches (destination side of a transfer).

/** -1 or +1 as seen from `accountId`'s register. */
export function txSign(tx, accountId) {
  if (tx.type === 'income') return 1;
  if (tx.type === 'expense') return -1;
  return tx.accountId === accountId ? -1 : 1; // transfer: outflow at source, inflow at destination
}

export function signedAmount(tx, accountId) {
  return txSign(tx, accountId) * tx.amount;
}

/** Register order: date asc, ties broken by createdAt asc. */
export function sortForRegister(txs) {
  return [...txs].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt
  );
}

/** { cleared, outstanding, balance } for one account's transactions. */
export function accountTotals(account, txs) {
  let cleared = account.startingBalance;
  let outstanding = 0;
  for (const tx of txs) {
    const amt = signedAmount(tx, account.id);
    if (tx.cleared) cleared += amt;
    else outstanding += amt;
  }
  return { cleared, outstanding, balance: cleared + outstanding };
}

/**
 * Rows newest-first, each { tx, running } where running is the balance after
 * applying the transaction in date order.
 */
export function withRunningBalances(account, txs) {
  let running = account.startingBalance;
  const rows = sortForRegister(txs).map((tx) => {
    running += signedAmount(tx, account.id);
    return { tx, running };
  });
  return rows.reverse();
}

/** Balance locked in by past reconciliations: starting + Σ reconciled. */
export function lastReconciledBalance(account, txs) {
  let bal = account.startingBalance;
  for (const tx of txs) {
    if (tx.reconciled) bal += signedAmount(tx, account.id);
  }
  return bal;
}

/** difference = statement ending balance − (last reconciled balance + Σ checked). Zero means balanced. */
export function reconcileDifference(endingBalance, reconciledBalance, checkedTxs, accountId) {
  let sum = 0;
  for (const tx of checkedTxs) sum += signedAmount(tx, accountId);
  return endingBalance - (reconciledBalance + sum);
}

/** Rollup for one flag as seen from this account's register. */
export function flagRollup(account, txs, flagId) {
  let inflow = 0;
  let outflow = 0;
  let count = 0;
  for (const tx of txs) {
    if (tx.flagId !== flagId) continue;
    const amt = signedAmount(tx, account.id);
    if (amt >= 0) inflow += amt;
    else outflow += amt;
    count += 1;
  }
  return { net: inflow + outflow, inflow, outflow, count };
}
