import { useMemo, useRef, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useVirtualizer } from '@tanstack/react-virtual';
import { db, registerQuery, toggleCleared, getPrefs, setPrefs } from '../db.js';
import { accountTotals, withRunningBalances, flagRollup } from '../derive.js';
import { formatMonthYear } from '../format.js';
import { formatSigned } from '../money.js';
import SummaryHeader from '../components/SummaryHeader.jsx';
import TransactionRow from '../components/TransactionRow.jsx';
import FlagDot from '../components/FlagDot.jsx';
import FlagManageSheet from './FlagManageSheet.jsx';
import { PlusIcon, ReconcileIcon } from '../components/icons.jsx';

/**
 * The main per-account register (mockup 1a): summary header, filter row,
 * Outstanding + Cleared groups in a virtualized list, FAB. Flag chips in the
 * filter row show live rollups; tapping one filters to that flag.
 */
export default function Register({ account, categories, onNewTransaction, onEditTransaction, onReconcile, onAccounts, onBatchSelect, onHistory, onSettings }) {
  const [hideCleared, setHideCleared] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFlagId, setActiveFlagId] = useState(null);
  const [manageFlag, setManageFlag] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getPrefs(account.id).then((p) => alive && setHideCleared(!!p.hideCleared));
    return () => {
      alive = false;
    };
  }, [account.id]);

  const txs = useLiveQuery(() => registerQuery(account.id), [account.id]);
  const flags = useLiveQuery(() => db.flags.toArray(), []);
  const categoryName = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c.name])), [categories]);
  const flagById = useMemo(() => new Map((flags ?? []).map((f) => [f.id, f])), [flags]);

  // A deleted or archived flag silently drops out of flag mode.
  const activeFlag = activeFlagId ? (flags ?? []).find((f) => f.id === activeFlagId && !f.archived) : null;

  // One rollup per non-archived flag with activity (or a seed) in this account.
  const flagChips = useMemo(() => {
    if (!txs || !flags) return [];
    return flags
      .filter((f) => !f.archived)
      .map((f) => ({ flag: f, rollup: flagRollup(account, txs, f) }))
      .filter(({ rollup }) => rollup.count > 0 || rollup.seed !== 0);
  }, [txs, flags, account]);

  const { totals, items, monthLabel, isEmpty } = useMemo(() => {
    if (!txs) return { totals: { cleared: account.startingBalance, outstanding: 0, balance: account.startingBalance }, items: [], monthLabel: '', isEmpty: false };

    const totals = accountTotals(account, txs);
    const rows = withRunningBalances(account, txs);

    const q = search.trim().toLowerCase();
    let visible = q ? rows.filter(({ tx }) => tx.payee.toLowerCase().includes(q)) : rows;
    if (activeFlag) visible = visible.filter(({ tx }) => tx.flagId === activeFlag.id);

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
  }, [txs, account, hideCleared, search, activeFlag]);

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

  const activeRollup = activeFlag ? flagChips.find((c) => c.flag.id === activeFlag.id)?.rollup : null;

  return (
    <>
      <SummaryHeader
        account={account}
        totals={totals}
        flagSummary={
          activeFlag && activeRollup
            ? { name: activeFlag.name, color: activeFlag.color, ...activeRollup }
            : undefined
        }
        onAccountTap={onAccounts}
        searchOpen={searchOpen}
        search={search}
        onSearch={setSearch}
        onSearchTap={() => {
          setSearchOpen((v) => !v);
          if (searchOpen) setSearch('');
        }}
        menuSlot={
          <button type="button" className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="More actions" aria-haspopup="menu">
            <span style={{ fontWeight: 700, letterSpacing: 1, paddingBottom: 6 }}>…</span>
          </button>
        }
      />

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="menu" aria-label="Account actions">
            <button type="button" className="sheet-row" role="menuitem" onClick={() => { setMenuOpen(false); onBatchSelect(); }}>
              Select transactions
            </button>
            <button type="button" className="sheet-row" role="menuitem" onClick={() => { setMenuOpen(false); onHistory(); }}>
              Reconciliation history
            </button>
            <button type="button" className="sheet-row" role="menuitem" onClick={() => { setMenuOpen(false); onSettings(); }}>
              Settings & backup
            </button>
          </div>
        </div>
      )}

      {manageFlag && <FlagManageSheet flag={manageFlag} onClose={() => setManageFlag(null)} />}

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
            {flagChips.map(({ flag, rollup }) => (
              <FlagChip
                key={flag.id}
                flag={flag}
                rollup={rollup}
                active={activeFlag?.id === flag.id}
                onToggle={() => setActiveFlagId((cur) => (cur === flag.id ? null : flag.id))}
                onManage={() => setManageFlag(flag)}
              />
            ))}
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
                      running={activeFlag ? undefined : item.row.running}
                      categoryName={categoryName.get(item.row.tx.categoryId)}
                      flag={flagById.get(item.row.tx.flagId)}
                      onToggleCleared={(tx) => toggleCleared(tx.id)}
                      onOpen={onEditTransaction}
                      onLongPress={() => onBatchSelect()}
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

/** One flag chip: dot, name, live net. Tap filters; long-press manages. */
function FlagChip({ flag, rollup, active, onToggle, onManage }) {
  const press = useRef({ timer: null, fired: false });

  const startPress = () => {
    press.current.fired = false;
    press.current.timer = setTimeout(() => {
      press.current.fired = true;
      onManage();
    }, 500);
  };
  const cancelPress = () => clearTimeout(press.current.timer);

  return (
    <button
      type="button"
      className={`chip${active ? ' chip--flag-active' : ''}`}
      aria-pressed={active}
      aria-label={`Flag ${flag.name}, net ${formatSigned(rollup.net)}${active ? ', filtering — tap to clear' : ''}`}
      onClick={() => {
        if (!press.current.fired) onToggle();
      }}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerMove={cancelPress}
    >
      <FlagDot color={flag.color} />
      {flag.name}
      <span className="money" style={{ fontWeight: 700 }}>
        {formatSigned(rollup.net)}
      </span>
      {active && <span aria-hidden="true">✕</span>}
    </button>
  );
}
