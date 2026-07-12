import { useState } from 'react';
import { createAccount } from '../db.js';
import { formatCents, centsFromDecimal } from '../money.js';
import { CheckIcon } from '../components/icons.jsx';

/**
 * Bottom sheet: switch between accounts or create one. Rename/delete arrive
 * with the management view in a later phase.
 */
export default function AccountsSheet({ accounts, balances, selectedId, onSelect, onClose }) {
  const [creating, setCreating] = useState(accounts.length === 0);
  const [name, setName] = useState('');
  const [starting, setStarting] = useState('');

  const startingCents = centsFromDecimal(starting || '0');
  const canCreate = name.trim() && startingCents !== null;

  const create = async () => {
    const account = await createAccount({ name: name.trim(), startingBalance: startingCents ?? 0 });
    onSelect(account.id);
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Accounts">
        <div className="sheet-title">Accounts</div>

        {accounts.map((account) => (
          <button key={account.id} type="button" className="sheet-row" onClick={() => { onSelect(account.id); onClose(); }}>
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
        ))}

        {creating ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: accounts.length ? 16 : 0 }}>
            <input className="text-input" placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <input
              className="text-input money"
              placeholder="Starting balance (e.g. 500.00)"
              inputMode="decimal"
              value={starting}
              onChange={(e) => setStarting(e.target.value)}
            />
            <button type="button" className="btn-primary" disabled={!canCreate} onClick={create}>
              Create account
            </button>
          </div>
        ) : (
          <button type="button" className="btn-tint" style={{ marginTop: 16, width: '100%' }} onClick={() => setCreating(true)}>
            New account
          </button>
        )}
      </div>
    </div>
  );
}
