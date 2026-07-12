import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.js';
import { formatCents } from '../money.js';
import { formatDateLong } from '../format.js';

/** Read-only reconciliation log for one account. */
export default function ReconcileHistory({ account, onClose }) {
  const entries = useLiveQuery(
    () => db.reconciliations.where('accountId').equals(account.id).reverse().sortBy('statementDate'),
    [account.id]
  );

  return (
    <div className="entry-screen">
      <div className="entry-nav">
        <button type="button" className="entry-nav-btn" onClick={onClose}>
          Done
        </button>
        <div className="entry-nav-title">Reconciliations</div>
        <span style={{ minWidth: 60 }} />
      </div>

      {entries?.length ? (
        <div className="card">
          {entries.map((entry) => (
            <div key={entry.id} className="field-row" style={{ minHeight: 56 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{formatDateLong(entry.statementDate)}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 1 }}>
                  {entry.txCount} transaction{entry.txCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="field-value money">{formatCents(entry.endingBalance)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-title">No reconciliations yet</div>
          <div className="empty-copy">Finish your first statement reconcile and it will be logged here.</div>
        </div>
      )}
    </div>
  );
}
