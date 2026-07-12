import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { registerQuery, finishReconcile } from '../db.js';
import { lastReconciledBalance, reconcileDifference, sortForRegister, signedAmount } from '../derive.js';
import { formatCents, formatSigned, centsFromKeypad } from '../money.js';
import { formatDateShort, formatDateLong, formatMonthYear } from '../format.js';
import { todayIso } from '../recurring.js';
import Keypad from '../components/Keypad.jsx';
import { CheckIcon } from '../components/icons.jsx';

/**
 * Reconcile flow (mockup 1c): setup sheet (statement balance + date), then
 * check-off screen with live difference. `preChecked` carries a batch-select
 * selection in as already-checked rows.
 */
export default function Reconcile({ account, preChecked, onClose }) {
  const [statement, setStatement] = useState(null); // { endingBalance, statementDate }
  return statement ? (
    <ReconcileMain account={account} statement={statement} preChecked={preChecked} onClose={onClose} />
  ) : (
    <ReconcileSetup onStart={setStatement} onClose={onClose} />
  );
}

function ReconcileSetup({ onStart, onClose }) {
  const [digits, setDigits] = useState('');
  const [date, setDate] = useState(todayIso());
  const endingBalance = centsFromKeypad(digits);

  return (
    <div className="entry-screen">
      <div className="entry-nav">
        <button type="button" className="entry-nav-btn" onClick={onClose}>
          Cancel
        </button>
        <div className="entry-nav-title">Reconcile</div>
        <span style={{ minWidth: 60 }} />
      </div>

      <div className="card amount-card" style={{ cursor: 'default' }}>
        <div className="stat-label stat-label--sub">Statement ending balance</div>
        <div className="amount-display money" style={{ color: 'var(--ink)' }}>
          {formatCents(endingBalance)}
        </div>
      </div>
      <Keypad onDigit={(d) => setDigits((v) => (v + d).replace(/^0+(?=\d)/, '').slice(0, 10))} onBackspace={() => setDigits((v) => v.slice(0, -1))} />

      <div className="card">
        <div className="field-row">
          <span className="field-label">Statement date</span>
          <input type="date" className="field-input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Statement date" />
        </div>
      </div>

      <div className="entry-footer">
        <button type="button" className="btn-primary" disabled={!digits} onClick={() => onStart({ endingBalance, statementDate: date })}>
          Start reconciling
        </button>
        <div className="entry-hint">Enter the ending balance from your bank statement</div>
      </div>
    </div>
  );
}

function ReconcileMain({ account, statement, preChecked, onClose }) {
  const txs = useLiveQuery(() => registerQuery(account.id), [account.id]);
  const [checked, setChecked] = useState(() => new Set(preChecked ?? []));
  const [initialized, setInitialized] = useState(!!preChecked?.length);
  const [busy, setBusy] = useState(false);

  const candidates = useMemo(() => {
    if (!txs) return [];
    return sortForRegister(txs.filter((t) => !t.reconciled && t.date <= statement.statementDate)).reverse();
  }, [txs, statement.statementDate]);

  // First load: pre-check everything already marked cleared (the common case —
  // those are the rows you toggled as they posted).
  if (!initialized && txs) {
    const initial = new Set(candidates.filter((t) => t.cleared).map((t) => t.id));
    setChecked(initial);
    setInitialized(true);
  }

  const reconciledBalance = txs ? lastReconciledBalance(account, txs) : 0;
  const checkedTxs = candidates.filter((t) => checked.has(t.id));
  const difference = reconcileDifference(statement.endingBalance, reconciledBalance, checkedTxs, account.id);
  const balanced = difference === 0 && checked.size > 0;

  const toggle = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const finish = async () => {
    setBusy(true);
    await finishReconcile(account.id, statement, [...checked]);
    onClose();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className={`recon-header${balanced ? ' recon-header--balanced' : ''}`}>
        <div className="recon-header-top">
          <div className="recon-title">Reconcile</div>
          <button type="button" className="recon-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="recon-subtitle">
          {formatMonthYear(statement.statementDate)} statement · ending balance <b className="money">{formatCents(statement.endingBalance)}</b>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div className="recon-diff-label">Difference remaining</div>
            <div className="recon-diff money">{formatCents(difference)}</div>
          </div>
          {balanced && (
            <div className="recon-balanced-chip">
              <CheckIcon size={12} />
              Balanced
            </div>
          )}
        </div>
        <div className="recon-progress-track">
          <div className="recon-progress-fill" style={{ width: candidates.length ? `${(checked.size / candidates.length) * 100}%` : 0 }} />
        </div>
        <div className="recon-progress-count money">
          {checked.size} of {candidates.length} checked
        </div>
      </div>

      {balanced ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 32px' }}>
          <div className="balanced-card">
            <div className="balanced-disc">
              <CheckIcon size={28} />
            </div>
            <div className="balanced-title">Balanced to the penny.</div>
            <div className="balanced-copy">
              {checked.size} transaction{checked.size === 1 ? '' : 's'} cleared against the {formatMonthYear(statement.statementDate)} statement.
              <br />
              Reconciled {formatDateLong(todayIso())}.
            </div>
          </div>
        </div>
      ) : (
        <div className="reg-scroll">
          <div className="section-label section-label--first">Check off items on your statement</div>
          <div className="grp-cleared">
            {candidates.map((tx, i) => {
              const isChecked = checked.has(tx.id);
              return (
                <div
                  key={tx.id}
                  className={`txrow${isChecked ? ' recon-row--checked' : ''}${i === 0 ? ' txrow--first' : ''}${i === candidates.length - 1 ? ' txrow--last' : ''}`}
                  onClick={() => toggle(tx.id)}
                  role="checkbox"
                  aria-checked={isChecked}
                  aria-label={`${tx.payee} ${formatSigned(signedAmount(tx, account.id))}`}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(tx.id);
                    }
                  }}
                >
                  <span className="disc-target">
                    <span className={`disc disc--navy ${isChecked ? 'disc--on' : 'disc--off'}`}>{isChecked && <CheckIcon />}</span>
                  </span>
                  <div className="txrow-main">
                    <div className="txrow-payee">{tx.payee}</div>
                    <div className="txrow-meta">
                      {[tx.checkNum && `#${tx.checkNum}`, formatDateShort(tx.date)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="txrow-amounts">
                    <div
                      className={`txrow-amount money${
                        isChecked ? '' : tx.type === 'income' ? ' txrow-amount--income' : tx.type === 'expense' ? ' txrow-amount--expense' : ' txrow-amount--transfer'
                      }`}
                    >
                      {formatSigned(signedAmount(tx, account.id))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="recon-footer">
        {balanced ? (
          <button type="button" className="btn-finish" disabled={busy} onClick={finish}>
            Finish reconciliation
          </button>
        ) : (
          <div className="btn-off money">Off by {formatCents(Math.abs(difference))}</div>
        )}
      </div>
    </div>
  );
}
