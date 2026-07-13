import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  createRecurringRule,
  updateRecurringRule,
  registerQuery,
  createFlag,
} from '../db.js';
import FlagDot, { FLAG_COLOR_COUNT, FLAG_COLOR_NAMES } from '../components/FlagDot.jsx';
import { formatCents, centsFromDecimal } from '../money.js';
import { nextOccurrence, todayIso } from '../recurring.js';
import { formatDateShort } from '../format.js';
import SegmentedType from '../components/SegmentedType.jsx';
import Keypad from '../components/Keypad.jsx';
import { ChevronRightIcon } from '../components/icons.jsx';

const FREQUENCIES = [
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Every month' },
  { value: 'yearly', label: 'Every year' },
];

/**
 * New/edit transaction (mockup 1b). `editingTx` switches to edit mode;
 * `openingBalance` prefills a cleared income for a fresh account.
 */
export default function EntryForm({ account, accounts, categories, editingTx, openingBalance, onClose }) {
  const isEdit = !!editingTx;
  const [type, setType] = useState(editingTx?.type ?? (openingBalance ? 'income' : 'expense'));
  const [digits, setDigits] = useState(editingTx ? String(editingTx.amount) : '');
  const [payee, setPayee] = useState(editingTx?.payee ?? (openingBalance ? 'Opening balance' : ''));
  const [categoryId, setCategoryId] = useState(editingTx?.categoryId ?? null);
  const [categoryTouched, setCategoryTouched] = useState(isEdit);
  const [date, setDate] = useState(editingTx?.date ?? todayIso());
  const [checkNum, setCheckNum] = useState(editingTx?.checkNum ?? '');
  const [memo, setMemo] = useState(editingTx?.memo ?? '');
  const [cleared, setCleared] = useState(editingTx?.cleared ?? !!openingBalance);
  const [transferAccountId, setTransferAccountId] = useState(editingTx?.transferAccountId ?? null);
  const [flagId, setFlagId] = useState(editingTx?.flagId ?? null);
  const [newFlagName, setNewFlagName] = useState('');
  const [newFlagColor, setNewFlagColor] = useState(0);
  const [newFlagSeed, setNewFlagSeed] = useState('');
  const [newFlagOpen, setNewFlagOpen] = useState(false);
  const [recurringOn, setRecurringOn] = useState(false);
  const [frequency, setFrequency] = useState('monthly');
  const [interval, setRuleInterval] = useState(1);
  const [endCondition, setEndCondition] = useState({ type: 'never' });
  const [keypadOpen, setKeypadOpen] = useState(!isEdit);
  const [sheet, setSheet] = useState(null); // 'category' | 'transferTo' | 'repeats' | 'ruleChoice'
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const amount = digits ? parseInt(digits, 10) : 0;
  const txs = useLiveQuery(() => registerQuery(account.id), [account.id]);
  const flags = useLiveQuery(() => db.flags.toArray(), []);
  const selectedFlag = flags?.find((f) => f.id === flagId);

  const addNewFlag = async () => {
    const flag = await createFlag({
      name: newFlagName.trim(),
      color: newFlagColor,
      seed: centsFromDecimal(newFlagSeed || '0') ?? 0,
    });
    setFlagId(flag.id);
    setNewFlagName('');
    setNewFlagSeed('');
    setNewFlagOpen(false);
    setSheet(null);
  };

  // Payee suggestions: frequency-ranked for this account; picking one carries
  // its most-used category along (unless the user already chose one).
  const payeeStats = useMemo(() => {
    const stats = new Map();
    for (const tx of txs ?? []) {
      if (tx.type === 'transfer') continue;
      const key = tx.payee;
      const entry = stats.get(key) ?? { count: 0, categories: new Map() };
      entry.count += 1;
      if (tx.categoryId) entry.categories.set(tx.categoryId, (entry.categories.get(tx.categoryId) ?? 0) + 1);
      stats.set(key, entry);
    }
    return stats;
  }, [txs]);

  const suggestions = useMemo(() => {
    const q = payee.trim().toLowerCase();
    const ranked = [...payeeStats.entries()].sort((a, b) => b[1].count - a[1].count);
    const starts = ranked.filter(([p]) => p.toLowerCase().startsWith(q) && p.toLowerCase() !== q);
    const contains = ranked.filter(([p]) => !p.toLowerCase().startsWith(q) && p.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 3).map(([p]) => p);
  }, [payeeStats, payee]);

  const pickSuggestion = (name) => {
    setPayee(name);
    if (!categoryTouched) {
      const cats = payeeStats.get(name)?.categories;
      if (cats?.size) setCategoryId([...cats.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    }
  };

  const categoryLabel = categories?.find((c) => c.id === categoryId)?.name;
  const transferTarget = accounts.find((a) => a.id === transferAccountId);
  const isTransfer = type === 'transfer';
  const canSave =
    amount > 0 && !busy && (isTransfer ? !!transferAccountId : payee.trim().length > 0);

  const save = async () => {
    if (isEdit && editingTx.ruleId && sheet !== 'ruleChoice') {
      setSheet('ruleChoice');
      return;
    }
    await commit('occurrence');
  };

  const commit = async (scope) => {
    setBusy(true);
    const fields = {
      accountId: editingTx?.accountId ?? account.id,
      type,
      payee: isTransfer ? `Transfer to ${transferTarget?.name ?? 'account'}` : payee.trim(),
      amount,
      categoryId: isTransfer ? null : categoryId,
      date,
      checkNum: checkNum.trim() || null,
      memo: memo.trim() || null,
      cleared,
      transferAccountId: isTransfer ? transferAccountId : null,
      flagId,
    };

    if (isEdit) {
      await updateTransaction(editingTx.id, fields);
      if (scope === 'rule' && editingTx.ruleId) {
        await updateRecurringRule(editingTx.ruleId, {
          template: {
            type: fields.type,
            payee: fields.payee,
            amount: fields.amount,
            categoryId: fields.categoryId,
            memo: fields.memo,
            checkNum: fields.checkNum,
            transferAccountId: fields.transferAccountId,
            flagId: fields.flagId,
          },
        });
      }
    } else {
      await addTransaction(fields);
      if (recurringOn) {
        const rule = { frequency, interval, anchorDay: Number(date.split('-')[2]) };
        await createRecurringRule({
          accountId: account.id,
          frequency,
          interval,
          endCondition,
          startDate: nextOccurrence(rule, date),
          template: {
            type: fields.type,
            payee: fields.payee,
            amount: fields.amount,
            categoryId: fields.categoryId,
            memo: fields.memo,
            checkNum: fields.checkNum,
            transferAccountId: fields.transferAccountId,
            flagId: fields.flagId,
          },
        });
      }
    }
    onClose();
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    await deleteTransaction(editingTx.id);
    onClose();
  };

  const amountClass = isTransfer ? 'amount-display--transfer' : type === 'expense' ? 'amount-display--expense' : 'amount-display--income';
  const amountPrefix = isTransfer ? '' : type === 'expense' ? '−' : '+';
  const repeatsLabel =
    FREQUENCIES.find((f) => f.value === frequency)?.label.replace('Every', interval > 1 ? `Every ${interval}` : 'Every') ?? '';

  return (
    <div className="entry-screen">
      <div className="entry-nav">
        <button type="button" className="entry-nav-btn" onClick={onClose}>
          Cancel
        </button>
        <div className="entry-nav-title">{isEdit ? 'Edit Transaction' : 'New Transaction'}</div>
        <button type="button" className="entry-nav-btn entry-nav-btn--save" disabled={!canSave} onClick={save}>
          Save
        </button>
      </div>

      {isEdit && editingTx.reconciled && (
        <div className="warn-banner" role="alert">
          This transaction is reconciled — editing it will change past reconciliations.
        </div>
      )}

      <SegmentedType value={type} onChange={setType} allowTransfer={accounts.length > 1 || isTransfer} />

      <button type="button" className="card amount-card" onClick={() => setKeypadOpen((v) => !v)} aria-label="Amount" aria-expanded={keypadOpen}>
        <div className="stat-label stat-label--sub">Amount</div>
        <div className={`amount-display money ${amountClass}`}>
          {amountPrefix}
          {formatCents(amount)}
        </div>
      </button>
      {keypadOpen && (
        <Keypad onDigit={(d) => setDigits((v) => (v + d).replace(/^0+(?=\d)/, '').slice(0, 10))} onBackspace={() => setDigits((v) => v.slice(0, -1))} />
      )}

      <div className="card">
        {!isTransfer && (
          <div className="payee-block">
            <div className="field-row" style={{ padding: 0, minHeight: 30 }}>
              <span className="field-label">Payee</span>
              <input className="field-input" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Who?" aria-label="Payee" />
            </div>
            {suggestions.length > 0 && (
              <div className="payee-chips">
                {suggestions.map((name) => (
                  <button key={name} type="button" className="payee-chip" onClick={() => pickSuggestion(name)}>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isTransfer && (
          <button type="button" className="field-row" onClick={() => setSheet('category')}>
            <span className="field-label">Category</span>
            <span className={`field-value${categoryLabel ? '' : ' field-value--placeholder'}`}>
              {categoryLabel ?? 'Optional'}
              <span className="field-chevron">
                <ChevronRightIcon />
              </span>
            </span>
          </button>
        )}

        {isTransfer && (
          <button type="button" className="field-row" onClick={() => setSheet('transferTo')}>
            <span className="field-label">To account</span>
            <span className={`field-value${transferTarget ? '' : ' field-value--placeholder'}`}>
              {transferTarget?.name ?? 'Choose'}
              <span className="field-chevron">
                <ChevronRightIcon />
              </span>
            </span>
          </button>
        )}

        <button type="button" className="field-row" onClick={() => setSheet('flag')}>
          <span className="field-label">Flag</span>
          <span className={`field-value${selectedFlag ? '' : ' field-value--placeholder'}`}>
            {selectedFlag && <FlagDot color={selectedFlag.color} />}
            {selectedFlag?.name ?? 'Optional'}
            <span className="field-chevron">
              <ChevronRightIcon />
            </span>
          </span>
        </button>

        <div className="field-row">
          <span className="field-label">Account</span>
          <span className="field-value">{account.name}</span>
        </div>

        <div className="field-row">
          <span className="field-label">Date</span>
          <input type="date" className="field-input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
        </div>

        {type === 'expense' && (
          <div className="field-row">
            <span className="field-label">Check #</span>
            <input className="field-input money" value={checkNum} onChange={(e) => setCheckNum(e.target.value)} placeholder="Optional" inputMode="numeric" aria-label="Check number" />
          </div>
        )}

        <div className="field-row">
          <span className="field-label">Memo</span>
          <input className="field-input" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Add memo…" aria-label="Memo" />
        </div>
      </div>

      <div className="card">
        <button type="button" className="field-row" onClick={() => setCleared((v) => !v)}>
          <span>Cleared</span>
          <span className={`switch${cleared ? ' switch--on' : ''}`} role="switch" aria-checked={cleared} aria-label="Cleared" />
        </button>
        {!isEdit && (
          <>
            <button type="button" className="field-row" onClick={() => setRecurringOn((v) => !v)}>
              <span>Recurring</span>
              <span className={`switch${recurringOn ? ' switch--on' : ''}`} role="switch" aria-checked={recurringOn} aria-label="Recurring" />
            </button>
            {recurringOn && (
              <button type="button" className="field-row" onClick={() => setSheet('repeats')}>
                <span className="field-label">Repeats</span>
                <span className="field-value">
                  {repeatsLabel}
                  <span className="field-chevron">
                    <ChevronRightIcon />
                  </span>
                </span>
              </button>
            )}
          </>
        )}
      </div>

      <div className="entry-footer">
        <button type="button" className="btn-primary" disabled={!canSave} onClick={save}>
          Save transaction
        </button>
        {!isEdit && <div className="entry-hint">Payee + amount is enough — everything else is optional</div>}
        {isEdit && (
          <button
            type="button"
            className="btn-tint"
            style={{ width: '100%', marginTop: 10, color: 'var(--expense)', background: 'rgba(180,35,24,0.08)' }}
            onClick={remove}
          >
            {confirmDelete ? 'Tap again to delete' : 'Delete transaction'}
          </button>
        )}
      </div>

      {sheet === 'category' && (
        <PickerSheet title="Category" onClose={() => setSheet(null)}>
          {['expense', 'income'].map((group) => (
            <div key={group}>
              <div className="picker-group-label">{group === 'expense' ? 'Expense' : 'Income'}</div>
              {(categories ?? [])
                .filter((c) => c.type === group && !c.archived)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="picker-option"
                    onClick={() => {
                      setCategoryId(c.id);
                      setCategoryTouched(true);
                      setSheet(null);
                    }}
                  >
                    <span>{c.name}</span>
                    {c.id === categoryId && <span style={{ color: 'var(--accent)' }}>✓</span>}
                  </button>
                ))}
            </div>
          ))}
          <button type="button" className="btn-tint" style={{ width: '100%', marginTop: 12 }} onClick={() => { setCategoryId(null); setCategoryTouched(true); setSheet(null); }}>
            No category
          </button>
        </PickerSheet>
      )}

      {sheet === 'transferTo' && (
        <PickerSheet title="Transfer to" onClose={() => setSheet(null)}>
          {accounts
            .filter((a) => a.id !== account.id)
            .map((a) => (
              <button key={a.id} type="button" className="picker-option" onClick={() => { setTransferAccountId(a.id); setSheet(null); }}>
                <span>{a.name}</span>
                {a.id === transferAccountId && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </button>
            ))}
        </PickerSheet>
      )}

      {sheet === 'flag' && (
        <PickerSheet title="Flag" onClose={() => { setSheet(null); setNewFlagOpen(false); }}>
          {(flags ?? [])
            .filter((f) => !f.archived)
            .map((f) => (
              <button key={f.id} type="button" className="picker-option" onClick={() => { setFlagId(f.id); setSheet(null); }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FlagDot color={f.color} />
                  {f.name}
                </span>
                {f.id === flagId && <span style={{ color: 'var(--accent)' }}>✓</span>}
              </button>
            ))}
          {(flags ?? []).some((f) => f.archived) && (
            <>
              <div className="picker-group-label">Archived</div>
              {flags
                .filter((f) => f.archived)
                .map((f) => (
                  <button key={f.id} type="button" className="picker-option" style={{ opacity: 0.6 }} onClick={() => { setFlagId(f.id); setSheet(null); }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FlagDot color={f.color} />
                      {f.name}
                    </span>
                    {f.id === flagId && <span style={{ color: 'var(--accent)' }}>✓</span>}
                  </button>
                ))}
            </>
          )}
          {newFlagOpen ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              <input
                className="text-input"
                placeholder="Flag name (e.g. Tim's bonus)"
                value={newFlagName}
                onChange={(e) => setNewFlagName(e.target.value)}
                autoFocus
                aria-label="Flag name"
              />
              <div className="flag-swatches" role="radiogroup" aria-label="Flag color">
                {Array.from({ length: FLAG_COLOR_COUNT }, (_, i) => (
                  <button key={i} type="button" className="flag-swatch" aria-pressed={newFlagColor === i} aria-label={FLAG_COLOR_NAMES[i]} onClick={() => setNewFlagColor(i)}>
                    <FlagDot color={i} />
                  </button>
                ))}
              </div>
              <input
                className="text-input money"
                placeholder="Seed amount — optional (e.g. 2000.00)"
                inputMode="decimal"
                value={newFlagSeed}
                onChange={(e) => setNewFlagSeed(e.target.value)}
                aria-label="Seed amount"
              />
              <button
                type="button"
                className="btn-primary"
                disabled={!newFlagName.trim() || centsFromDecimal(newFlagSeed || '0') === null}
                onClick={addNewFlag}
              >
                Create flag
              </button>
            </div>
          ) : (
            <button type="button" className="btn-tint" style={{ width: '100%', marginTop: 12 }} onClick={() => setNewFlagOpen(true)}>
              New flag…
            </button>
          )}
          <button type="button" className="btn-tint" style={{ width: '100%', marginTop: 10 }} onClick={() => { setFlagId(null); setSheet(null); }}>
            No flag
          </button>
        </PickerSheet>
      )}

      {sheet === 'repeats' && (
        <PickerSheet title="Repeats" onClose={() => setSheet(null)}>
          {FREQUENCIES.map((f) => (
            <button key={f.value} type="button" className="picker-option" onClick={() => setFrequency(f.value)}>
              <span>{f.label}</span>
              {f.value === frequency && <span style={{ color: 'var(--accent)' }}>✓</span>}
            </button>
          ))}
          <div className="picker-group-label">Ends</div>
          <button type="button" className="picker-option" onClick={() => setEndCondition({ type: 'never' })}>
            <span>Never</span>
            {endCondition.type === 'never' && <span style={{ color: 'var(--accent)' }}>✓</span>}
          </button>
          <button type="button" className="picker-option" onClick={() => setEndCondition({ type: 'count', n: endCondition.n ?? 12 })}>
            <span>After</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {endCondition.type === 'count' && (
                <input
                  className="text-input money"
                  style={{ width: 72, height: 36, textAlign: 'center' }}
                  inputMode="numeric"
                  value={endCondition.n}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEndCondition({ type: 'count', n: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  aria-label="Number of occurrences"
                />
              )}
              <span>{endCondition.type === 'count' ? 'times ✓' : 'N times'}</span>
            </span>
          </button>
          <button type="button" className="picker-option" onClick={() => setEndCondition({ type: 'until', date: endCondition.date ?? date })}>
            <span>Until</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {endCondition.type === 'until' ? (
                <>
                  <input
                    type="date"
                    className="text-input"
                    style={{ width: 160, height: 36 }}
                    value={endCondition.date}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => e.target.value && setEndCondition({ type: 'until', date: e.target.value })}
                    aria-label="End date"
                  />
                  <span>✓</span>
                </>
              ) : (
                <span>a date</span>
              )}
            </span>
          </button>
          <button type="button" className="btn-primary" style={{ marginTop: 14 }} onClick={() => setSheet(null)}>
            Done
          </button>
        </PickerSheet>
      )}

      {sheet === 'ruleChoice' && (
        <PickerSheet title="This is a recurring transaction" onClose={() => setSheet(null)}>
          <button type="button" className="picker-option" onClick={() => commit('occurrence')}>
            <span>Save this occurrence only</span>
          </button>
          <button type="button" className="picker-option" onClick={() => commit('rule')}>
            <span>Save and update the rule for future occurrences</span>
          </button>
        </PickerSheet>
      )}
    </div>
  );
}

function PickerSheet({ title, children, onClose }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-title">{title}</div>
        {children}
      </div>
    </div>
  );
}
