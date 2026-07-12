import { TransferIcon } from './icons.jsx';

/** Expense / Income / Transfer selector — the active segment carries its
 * semantic color AND sign glyph, readable without color. */
export default function SegmentedType({ value, onChange, allowTransfer = true }) {
  return (
    <div className="segmented" role="group" aria-label="Transaction type">
      <button type="button" className="segment segment--expense" aria-pressed={value === 'expense'} onClick={() => onChange('expense')}>
        <span className="segment-sign">−</span>Expense
      </button>
      <button type="button" className="segment segment--income" aria-pressed={value === 'income'} onClick={() => onChange('income')}>
        <span className="segment-sign">+</span>Income
      </button>
      {allowTransfer && (
        <button type="button" className="segment segment--transfer" aria-pressed={value === 'transfer'} onClick={() => onChange('transfer')}>
          <TransferIcon size={14} />
          Transfer
        </button>
      )}
    </div>
  );
}
