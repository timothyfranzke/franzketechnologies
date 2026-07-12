import { useMemo, useRef, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import { registerQuery, toggleCleared, getPrefs, setPrefs } from '../db.js';
import { accountTotals, withRunningBalances } from '../derive.js';
import { formatMonthYear } from '../format.js';
import SummaryHeader from '../components/SummaryHeader.jsx';
import TransactionRow from '../components/TransactionRow.jsx';
import { PlusIcon, ReconcileIcon } from '../components/icons.jsx';

/**
 * The main per-account register (mockup 1a): summary header, filter row,
 * Outstanding + Cleared groups in a virtualized list, FAB.
 */
export default function Register({ account, categories, onNewTransaction, onEditTransaction, onReconcile, onAccounts }) {
  const [hideCleared, setHideCleared] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getPrefs(account.id).then((p) => alive && setHideCleared(!!p.hideCleared));
    return () => {
      alive = false;
    };
  }, [account.id]);

  const txs = useLiveQuery(() => registerQuery(account.id), [account.id]);
  const categoryName = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c.name])), [categories]);

  const { totals, items, monthLabel, isEmpty } = useMemo(() => {
    if (!txs) return { totals: { cleared: account.startingBalance, outstanding: 0, balance: account.startingBalance }, items: [], monthLabel: '', isEmpty: false };

    const totals = accountTotals(account, txs);
    const rows = withRunningBalances(account, txs);

    const q = search.trim().toLowerCase();
    const visible = q ? rows.filter(({ tx }) => tx.payee.toLowerCase().includes(q)) : rows;

    const outstanding = visible.filter(({ tx }) => !tx.cleared);
    const cleared = hideCleared ? [] : visible.filter(({ tx }) => tx.cleared);

    const items = [];
    if (outstanding.length) {
      items.push({ kind: 'label', key: 'label-out', text: `Outstanding · ${outstanding.length}`, first: true });
      outstanding.forEach((row, i) =>
        items.push({ kind: 'tx', key: row.tx.id, row, group: 'grp-outstanding', first: i === 0, last: i === outstanding.length - 1 })
      );
    }
    if (cleared.length) {
      items.push({ kind: 'label', key: 'label-clr', text: `Cleared · ${cleared.length}`, first: !outstanding.length });
      cleared.forEach((row, i) =>
        items.push({ kind: 'tx', key: row.tx.id, row, group: 'grp-cleared', first: i === 0, last: i === cleared.length - 1 })
      );
    }

    return {
      totals,
      items,
      monthLabel: visible.length ? formatMonthYear(visible[0].tx.date) : '',
      isEmpty: txs.length === 0,
    };
  }, [txs, account, hideCleared, search]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (items[i].kind === 'label' ? 34 : 62),
    getItemKey: (i) => items[i].key,
    overscan: 12,
    paddingEnd: 120,
  });

  const toggleHideCleared = () => {
    const next = !hideCleared;
    setHideCleared(next);
    setPrefs(account.id, { hideCleared: next });
  };

  return (
    <>
      <SummaryHeader
        account={account}
        totals={totals}
        onAccountTap={onAccounts}
        searchOpen={searchOpen}
        search={search}
        onSearch={setSearch}
        onSearchTap={() => {
          setSearchOpen((v) => !v);
          if (searchOpen) setSearch('');
        }}
      />

      {!isEmpty && (
        <div className="filter-row">
          <div className="month-label">{monthLabel}</div>
          <div className="filter-chips">
            <button type="button" className="chip chip--accent" onClick={onReconcile}>
              <ReconcileIcon />
              Reconcile
            </button>
            <button type="button" className="chip" onClick={toggleHideCleared} aria-pressed={hideCleared}>
              <span className={`mini-switch${hideCleared ? ' mini-switch--on' : ''}`} />
              Hide cleared
            </button>
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-ring">
            <PlusIcon size={26} />
          </div>
          <div className="empty-title">No transactions yet</div>
          <div className="empty-copy">Start with your bank's current balance so the register matches from day one.</div>
          <button type="button" className="btn-tint" onClick={() => onNewTransaction({ openingBalance: true })}>
            Set opening balance
          </button>
        </div>
      ) : (
        <div className="reg-scroll" ref={scrollRef}>
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vi) => {
              const item = items[vi.index];
              return (
                <div
                  key={vi.key}
                  ref={virtualizer.measureElement}
                  data-index={vi.index}
                  className={item.kind === 'tx' ? item.group : undefined}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
                >
                  {item.kind === 'label' ? (
                    <div className={`section-label${item.first ? ' section-label--first' : ''}`}>{item.text}</div>
                  ) : (
                    <TransactionRow
                      tx={item.row.tx}
                      accountId={account.id}
                      running={item.row.running}
                      categoryName={categoryName.get(item.row.tx.categoryId)}
                      onToggleCleared={(tx) => toggleCleared(tx.id)}
                      onOpen={onEditTransaction}
                      first={item.first}
                      last={item.last}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <button type="button" className="fab" onClick={() => onNewTransaction()} aria-label="Add transaction">
        <PlusIcon />
      </button>
    </>
  );
}
