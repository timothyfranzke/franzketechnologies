import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, createAccount, renameAccount, deleteAccountCascade } from '../db.js';
import { formatCents, centsFromDecimal } from '../money.js';
import { CheckIcon, ChevronRightIcon } from '../components/icons.jsx';

/** Bottom sheet: switch, create, rename, or delete accounts. */
export default function AccountsSheet({ accounts, balances, selectedId, onSelect, onClose }) {
  const [creating, setCreating] = useState(accounts.length === 0);
  const [managing, setManaging] = useState(null); // account being edited

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Accounts">
        {managing ? (
          <ManageAccount
            account={managing}
            isOnly={accounts.length === 1}
            onBack={() => setManaging(null)}
            onDeleted={(id) => {
              setManaging(null);
              if (id === selectedId) {
                const next = accounts.find((a) => a.id !== id);
                if (next) onSelect(next.id);
              }
            }}
          />
        ) : (
          <>
            <div className="sheet-title">Accounts</div>

            {accounts.map((account) => (
              <div key={account.id} style={{ display: 'flex' }}>
                <button type="button" className="sheet-row" style={{ flex: 1, borderRadius: 0 }} onClick={() => { onSelect(account.id); onClose(); }}>
                  <span>{account.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {balances?.has(account.id) && (
                      <span className="money" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>
                        {formatCents(balances.get(account.id))}
                      </span>
                    )}
                    {account.id === selectedId && (
                      <span style={{ color: 'var(--accent)' }}>
                        <CheckIcon />
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="sheet-row"
                  style={{ flex: '0 0 auto', width: 52, justifyContent: 'center', borderLeft: 'none', borderRadius: 0, color: 'var(--ink-3)' }}
                  aria-label={`Manage ${account.name}`}
                  onClick={() => setManaging(account)}
                >
                  <ChevronRightIcon />
                </button>
              </div>
            ))}

            {creating ? (
              <CreateAccount
                onCreated={(id) => {
                  onSelect(id);
                  onClose();
                }}
                topMargin={accounts.length > 0}
              />
            ) : (
              <button type="button" className="btn-tint" style={{ marginTop: 16, width: '100%' }} onClick={() => setCreating(true)}>
                New account
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CreateAccount({ onCreated, topMargin }) {
  const [name, setName] = useState('');
  const [starting, setStarting] = useState('');
  const startingCents = centsFromDecimal(starting || '0');
  const canCreate = name.trim() && startingCents !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: topMargin ? 16 : 0 }}>
      <input className="text-input" placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input
        className="text-input money"
        placeholder="Starting balance (e.g. 500.00)"
        inputMode="decimal"
        value={starting}
        onChange={(e) => setStarting(e.target.value)}
      />
      <button
        type="button"
        className="btn-primary"
        disabled={!canCreate}
        onClick={async () => {
          const account = await createAccount({ name: name.trim(), startingBalance: startingCents ?? 0 });
          onCreated(account.id);
        }}
      >
        Create account
      </button>
    </div>
  );
}

function ManageAccount({ account, isOnly, onBack, onDeleted }) {
  const [name, setName] = useState(account.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const txCount = useLiveQuery(
    () => db.transactions.where('accountId').equals(account.id).count(),
    [account.id]
  );

  return (
    <>
      <div className="sheet-title">{account.name}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Account name" />
        <button
          type="button"
          className="btn-primary"
          disabled={!name.trim() || name.trim() === account.name}
          onClick={async () => {
            await renameAccount(account.id, name.trim());
            onBack();
          }}
        >
          Rename
        </button>
        <button
          type="button"
          className="btn-tint"
          style={{ width: '100%', color: 'var(--expense)', background: 'rgba(180,35,24,0.08)' }}
          disabled={isOnly}
          onClick={async () => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            await deleteAccountCascade(account.id);
            onDeleted(account.id);
          }}
        >
          {isOnly
            ? 'Can’t delete the only account'
            : confirmDelete
              ? `Tap again to delete ${txCount ?? ''} transactions with it`
              : 'Delete account…'}
        </button>
        <button type="button" className="btn-tint" style={{ width: '100%' }} onClick={onBack}>
          Back
        </button>
      </div>
    </>
  );
}
