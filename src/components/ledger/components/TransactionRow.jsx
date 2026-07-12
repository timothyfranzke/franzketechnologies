import { formatCents, formatSigned } from '../money.js';
import { signedAmount } from '../derive.js';
import { formatDateShort } from '../format.js';
import ClearedDisc from './ClearedDisc.jsx';
import { TransferIcon } from './icons.jsx';

/**
 * One register row. `first`/`last` shape the card corners; the parent supplies
 * the group palette via .grp-outstanding / .grp-cleared on a wrapper.
 */
export default function TransactionRow({ tx, accountId, running, categoryName, onToggleCleared, onOpen, first, last }) {
  const isTransfer = tx.type === 'transfer';
  const signed = signedAmount(tx, accountId);
  const meta = [tx.checkNum && `#${tx.checkNum}`, formatDateShort(tx.date), isTransfer ? 'Transfer' : categoryName]
    .filter(Boolean)
    .join(' · ');

  const amountClass = isTransfer
    ? 'txrow-amount--transfer'
    : signed < 0
      ? 'txrow-amount--expense'
      : 'txrow-amount--income';

  const classes = [
    'txrow',
    tx.cleared && 'txrow--cleared',
    first && 'txrow--first',
    last && 'txrow--last',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} onClick={() => onOpen?.(tx)} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.(tx); } }}>
      <ClearedDisc cleared={tx.cleared} payee={tx.payee} onToggle={() => onToggleCleared?.(tx)} />
      <div className="txrow-main">
        <div className="txrow-payee">{tx.payee}</div>
        <div className="txrow-meta">{meta}</div>
      </div>
      <div className="txrow-amounts">
        <div className={`txrow-amount ${amountClass} money`}>
          {isTransfer && <TransferIcon />}
          {isTransfer ? formatCents(tx.amount) : formatSigned(signed)}
        </div>
        {running !== undefined && <div className="txrow-running money">{formatCents(running)}</div>}
      </div>
    </div>
  );
}
