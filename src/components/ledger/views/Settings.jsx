import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportAll, validateImport, importReplace, importMerge, registerQuery, getMeta, setMeta } from '../db.js';
import { buildCsv, shareOrDownload } from '../export.js';
import { formatDateLong } from '../format.js';
import { todayIso } from '../recurring.js';

/**
 * Settings & backup: JSON export (full snapshot), per-account CSV, JSON
 * import with merge / double-confirmed replace, storage status.
 */
export default function Settings({ accounts, categories, onClose }) {
  const [status, setStatus] = useState(null);
  const [pendingImport, setPendingImport] = useState(null); // parsed snapshot awaiting a mode choice
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [persisted, setPersisted] = useState(null);
  const [lastExport, setLastExport] = useState(null);
  const fileRef = useRef(null);

  const txCount = useLiveQuery(() => db.transactions.count(), []);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    getMeta('lastExportAt').then(setLastExport);
  }, []);

  const exportJson = async () => {
    const snapshot = await exportAll();
    const result = await shareOrDownload(`ledger-backup-${todayIso()}.json`, 'application/json', JSON.stringify(snapshot, null, 2));
    if (result !== 'cancelled') {
      await setMeta('lastExportAt', todayIso());
      setLastExport(todayIso());
      setStatus('Backup exported.');
    }
  };

  const exportCsv = async (account) => {
    const txs = await registerQuery(account.id);
    const result = await shareOrDownload(
      `${account.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-transactions.csv`,
      'text/csv',
      buildCsv(account, txs, categories)
    );
    if (result !== 'cancelled') setStatus(`CSV exported for ${account.name}.`);
  };

  const pickFile = () => fileRef.current?.click();

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const error = validateImport(data);
      if (error) {
        setStatus(error);
        return;
      }
      setPendingImport(data);
      setConfirmReplace(false);
    } catch {
      setStatus('That file is not valid JSON.');
    }
  };

  const doMerge = async () => {
    const counts = await importMerge(pendingImport);
    const added = Object.values(counts).reduce((a, b) => a + b, 0);
    setPendingImport(null);
    setStatus(`Merge complete — ${added} new record${added === 1 ? '' : 's'} added.`);
  };

  const doReplace = async () => {
    if (!confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    await importReplace(pendingImport);
    setPendingImport(null);
    setConfirmReplace(false);
    setStatus('All data replaced from backup.');
  };

  return (
    <div className="entry-screen">
      <div className="entry-nav">
        <button type="button" className="entry-nav-btn" onClick={onClose}>
          Done
        </button>
        <div className="entry-nav-title">Settings & backup</div>
        <span style={{ minWidth: 60 }} />
      </div>

      {status && (
        <div className="warn-banner" role="status" style={{ background: 'var(--accent-tint)', borderColor: 'var(--accent-tint-border)', color: 'var(--accent)' }}>
          {status}
        </div>
      )}

      <div className="picker-group-label" style={{ margin: '12px 16px 0' }}>Backup</div>
      <div className="card" style={{ marginTop: 6 }}>
        <button type="button" className="field-row" onClick={exportJson}>
          <span>Export everything (JSON)</span>
          <span className="field-value" style={{ color: 'var(--accent)' }}>Share</span>
        </button>
        <button type="button" className="field-row" onClick={pickFile}>
          <span>Import from backup (JSON)</span>
          <span className="field-value" style={{ color: 'var(--accent)' }}>Choose file</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onFile} aria-label="Backup file" />

      <div className="picker-group-label" style={{ margin: '12px 16px 0' }}>Spreadsheet export</div>
      <div className="card" style={{ marginTop: 6 }}>
        {accounts.map((account) => (
          <button key={account.id} type="button" className="field-row" onClick={() => exportCsv(account)}>
            <span>{account.name}</span>
            <span className="field-value" style={{ color: 'var(--accent)' }}>CSV</span>
          </button>
        ))}
      </div>

      <div className="picker-group-label" style={{ margin: '12px 16px 0' }}>Storage</div>
      <div className="card" style={{ marginTop: 6 }}>
        <div className="field-row">
          <span className="field-label">Transactions</span>
          <span className="field-value money">{txCount ?? '—'}</span>
        </div>
        <div className="field-row">
          <span className="field-label">Durable storage</span>
          <span className="field-value">{persisted === null ? '—' : persisted ? 'Granted' : 'Best effort'}</span>
        </div>
        <div className="field-row">
          <span className="field-label">Last export</span>
          <span className="field-value">{lastExport ? formatDateLong(lastExport) : 'Never'}</span>
        </div>
      </div>
      <div className="entry-hint" style={{ padding: '0 24px' }}>
        Your data lives only on this device. Export a backup regularly — it's the only copy.
      </div>

      {pendingImport && (
        <div className="sheet-backdrop" onClick={() => setPendingImport(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Import backup">
            <div className="sheet-title">Import backup</div>
            <div className="empty-copy" style={{ marginBottom: 12 }}>
              {pendingImport.accounts.length} account{pendingImport.accounts.length === 1 ? '' : 's'},{' '}
              {pendingImport.transactions.length} transactions, exported {pendingImport.exportedAt?.slice(0, 10) ?? 'unknown'}.
            </div>
            <button type="button" className="sheet-row" onClick={doMerge}>
              <span>Merge — add records this device doesn't have</span>
            </button>
            <button type="button" className="sheet-row" onClick={doReplace} style={{ color: 'var(--expense)' }}>
              <span>{confirmReplace ? 'Tap again to erase this device and replace' : 'Replace all — erase this device first'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
