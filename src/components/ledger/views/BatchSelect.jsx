import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { registerQuery, markCleared } from '../db.js';
import { accountTotals, withRunningBalances, signedAmount } from '../derive.js';
import { formatCents, formatSigned } from '../money.js';
import { formatDateShort } from '../format.js';
import { CheckIcon } from '../components/icons.jsx';

/**
 * Batch select (mockup 2a): tap outstanding rows to build a selection with a
 * live total, then mark them cleared in one commit or carry them into
 * Reconcile pre-checked.
 */
export default function BatchSelect({ account, categories, onReconcile, onClose }) {
  const txs = useLiveQuery(() => registerQuery(account.id), [account.id]);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const categoryName = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c.name])), [categories]);

  const { outstanding, cleared, totals } = useMemo(() => {
    if (!txs) return { outstanding: [], cleared: [], totals: { cleared: account.startingBalance } };
    const rows = withRunningBalances(account, txs);
    return {
      outstanding: rows.filter(({ tx }) => !tx.cleared),
      cleared: rows.filter(({ tx }) => tx.cleared),
      totals: accountTotals(account, txs),
    };
  }, [txs, account]);

  const selectedTotal = outstanding.reduce((sum, { tx }) => (selected.has(tx.id) ? sum + signedAmount(tx, account.id) : sum), 0);
  const clearedIfCommitted = totals.cleared + selectedTotal;

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commit = async () => {
    setBusy(true);
    await markCleared([...selected]);
    onClose();
  };

  const row = ({ tx }, i, list, selectable) => {
    const isSelected = selected.has(tx.id);
    const meta = [formatDateShort(tx.date), tx.type === 'transfer' ? 'Transfer' : categoryName.get(tx.categoryId)].filter(Boolean).join(' · ');
    return (
      <div
        key={tx.id}
        className={`txrow${isSelected ? ' batch-row--selected' : ''}${i === 0 ? ' txrow--first' : ''}${i === list.length - 1 ? ' txrow--last' : ''}`}
        onClick={selectable ? () => toggle(tx.id) : undefined}
        role={selectable ? 'checkbox' : undefined}
        aria-checked={selectable ? isSelected : undefined}
        tabIndex={selectable ? 0 : undefined}
        onKeyDown={
          selectable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggle(tx.id);
                }
              }
            : undefined
        }
      >
        <span className="disc-target">
          {selectable ? (
            <span className={`disc ${isSelected ? '' : 'disc--off'}`} style={isSelected ? { border: '2px solid var(--accent)', color: 'var(--accent)' } : undefined}>
              {isSelected && <CheckIcon />}
            </span>
          ) : (
            <span className="disc disc--on">
              <CheckIcon />
            </span>
          )}
        </span>
        <div className="txrow-main">
          <div className="txrow-payee">{tx.payee}</div>
          <div className="txrow-meta">{meta}</div>
        </div>
        <div className="txrow-amounts">
          <div className={`txrow-amount money${tx.type === 'income' ? ' txrow-amount--income' : tx.type === 'expense' ? ' txrow-amount--expense' : ' txrow-amount--transfer'}`}>
            {formatSigned(signedAmount(tx, account.id))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="batch-header">
        <div className="batch-nav">
          <button type="button" className="batch-nav-cancel" onClick={onClose}>
            Cancel
          </button>
          <div className="batch-nav-title">Select outstanding</div>
          <button type="button" className="batch-nav-all" onClick={() => setSelected(new Set(outstanding.map(({ tx }) => tx.id)))}>
            All
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
          <div>
            <div className="stat-label">Selected</div>
            <div className="balance-big money">{formatSigned(selectedTotal)}</div>
          </div>
          <div style={{ textAlign: 'right', paddingBottom: 2 }}>
            <div className="stat-label stat-label--sub">Cleared if committed</div>
            <div className="stat-value money">{formatCents(clearedIfCommitted)}</div>
          </div>
        </div>
      </div>

      <div className="reg-scroll">
        <div className="section-label section-label--first">Outstanding · {outstanding.length}</div>
        <div className="grp-outstanding">{outstanding.map((r, i) => row(r, i, outstanding, true))}</div>

        {cleared.length > 0 && (
          <>
            <div className="section-label">Cleared · {cleared.length}</div>
            <div className="grp-cleared batch-group--muted">{cleared.map((r, i) => row(r, i, cleared, false))}</div>
          </>
        )}
      </div>

      <div className="batch-footer">
        <div className="batch-footer-info">
          <div className="batch-count money">
            {selected.size} selected · {formatSigned(selectedTotal)}
          </div>
          <button type="button" className="batch-deselect" onClick={() => setSelected(new Set())}>
            Deselect
          </button>
        </div>
        <div className="batch-actions">
          <button type="button" className="btn-primary" disabled={!selected.size || busy} onClick={commit}>
            Mark cleared
          </button>
          <button type="button" className="btn-tint" disabled={!selected.size} onClick={() => onReconcile([...selected])}>
            Reconcile…
          </button>
        </div>
      </div>
    </>
  );
}
