import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';
import './tokens.css';
import './ledger.css';
import { db, materializeRecurring, getMeta, setMeta, createAccount } from './db.js';
import { accountTotals } from './derive.js';
import { centsFromDecimal } from './money.js';
import Register from './views/Register.jsx';
import AccountsSheet from './views/AccountsSheet.jsx';
import { PlusIcon } from './components/icons.jsx';

// View state machine: `view.name` picks the screen, the rest carries context
// (e.g. { name: 'entry', txId }). Register is the home screen.
export default function App() {
  const [view, setView] = useState({ name: 'register' });
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const accounts = useLiveQuery(() => db.accounts.orderBy('name').toArray(), []);
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []);
  const allTxs = useLiveQuery(() => db.transactions.toArray(), []);

  useEffect(() => {
    materializeRecurring().catch(() => {});
    if (import.meta.env.DEV) {
      const n = parseInt(new URLSearchParams(window.location.search).get('seed') ?? '', 10);
      if (n > 0) import('./dev-seed.js').then((m) => m.seedDemo(n));
    }
  }, []);

  // Restore last-selected account; fall back to the first one.
  useEffect(() => {
    if (!accounts?.length) return;
    if (selectedId && accounts.some((a) => a.id === selectedId)) return;
    getMeta('selectedAccountId').then((saved) => {
      const id = accounts.some((a) => a.id === saved) ? saved : accounts[0].id;
      setSelectedId(id);
    });
  }, [accounts, selectedId]);

  const selectAccount = (id) => {
    setSelectedId(id);
    setMeta('selectedAccountId', id);
  };

  const balances = useMemo(() => {
    if (!accounts || !allTxs) return null;
    return new Map(
      accounts.map((account) => {
        const txs = allTxs.filter((t) => t.accountId === account.id || t.transferAccountId === account.id);
        return [account.id, accountTotals(account, txs).balance];
      })
    );
  }, [accounts, allTxs]);

  const account = accounts?.find((a) => a.id === selectedId);

  if (!accounts) return <div className="ledger-app" aria-busy="true" />;

  return (
    <div className="ledger-app">
      {accounts.length === 0 ? (
        <FirstRun />
      ) : !account ? null : (
        <Register
          account={account}
          categories={categories}
          onNewTransaction={(opts) => setView({ name: 'entry', ...opts })}
          onEditTransaction={(tx) => setView({ name: 'entry', txId: tx.id })}
          onReconcile={() => setView({ name: 'reconcile' })}
          onAccounts={() => setAccountsOpen(true)}
        />
      )}

      {accountsOpen && (
        <AccountsSheet
          accounts={accounts}
          balances={balances}
          selectedId={selectedId}
          onSelect={selectAccount}
          onClose={() => setAccountsOpen(false)}
        />
      )}
    </div>
  );
}

// First launch: no accounts yet. One field pair, then straight into the register.
function FirstRun() {
  return (
    <div className="first-run">
      <div className="empty-ring" style={{ alignSelf: 'center' }}>
        <PlusIcon size={26} />
      </div>
      <div className="empty-title" style={{ textAlign: 'center' }}>Set up your first account</div>
      <div className="empty-copy" style={{ textAlign: 'center', marginBottom: 8 }}>
        Name it after the bank account you'll track — you can add more later.
      </div>
      <FirstRunForm />
    </div>
  );
}

function FirstRunForm() {
  const [name, setName] = useState('Checking');
  const [starting, setStarting] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    await createAccount({ name: name.trim() || 'Checking', startingBalance: centsFromDecimal(starting || '0') ?? 0 });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Account name" />
      <input
        className="text-input money"
        placeholder="Current bank balance (e.g. 500.00)"
        inputMode="decimal"
        value={starting}
        onChange={(e) => setStarting(e.target.value)}
        aria-label="Starting balance"
      />
      <button type="button" className="btn-primary" disabled={busy} onClick={submit}>
        Start ledger
      </button>
    </div>
  );
}
