import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { updateFlag, deleteFlagAndUnflag, countFlagged } from '../db.js';
import { centsFromDecimal, decimalString } from '../money.js';
import FlagDot, { FLAG_COLOR_COUNT, FLAG_COLOR_NAMES } from '../components/FlagDot.jsx';

/** Long-press a flag chip → rename, recolor, reseed, archive, or delete the flag. */
export default function FlagManageSheet({ flag, onClose }) {
  const [name, setName] = useState(flag.name);
  const [color, setColor] = useState(flag.color);
  const [seedText, setSeedText] = useState((flag.seed ?? 0) === 0 ? '' : decimalString(flag.seed));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const txCount = useLiveQuery(() => countFlagged(flag.id), [flag.id]);

  const seed = seedText.trim() === '' ? 0 : centsFromDecimal(seedText);
  const seedValid = seed !== null;
  const dirty = name.trim() !== flag.name || color !== flag.color || seed !== (flag.seed ?? 0);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Manage flag ${flag.name}`}>
        <div className="sheet-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlagDot color={color} />
          {flag.name}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input className="text-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Flag name" />
          <div className="flag-swatches" role="radiogroup" aria-label="Flag color">
            {Array.from({ length: FLAG_COLOR_COUNT }, (_, i) => (
              <button key={i} type="button" className="flag-swatch" aria-pressed={color === i} aria-label={FLAG_COLOR_NAMES[i]} onClick={() => setColor(i)}>
                <FlagDot color={i} />
              </button>
            ))}
          </div>
          <input
            className="text-input money"
            placeholder="Seed amount (e.g. 2000.00)"
            inputMode="decimal"
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            aria-label="Seed amount"
          />
          <div className="entry-hint" style={{ marginTop: -4, textAlign: 'left' }}>
            The seed is added to this flag's total directly — no transaction, account balance untouched.
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={!dirty || !name.trim() || !seedValid}
            onClick={async () => {
              await updateFlag(flag.id, { name: name.trim(), color, seed });
              onClose();
            }}
          >
            Save changes
          </button>
          <button
            type="button"
            className="btn-tint"
            style={{ width: '100%' }}
            onClick={async () => {
              await updateFlag(flag.id, { archived: !flag.archived });
              onClose();
            }}
          >
            {flag.archived ? 'Unarchive' : 'Archive (hide from chips & picker)'}
          </button>
          <button
            type="button"
            className="btn-tint"
            style={{ width: '100%', color: 'var(--expense)', background: 'rgba(180,35,24,0.08)' }}
            onClick={async () => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              await deleteFlagAndUnflag(flag.id);
              onClose();
            }}
          >
            {confirmDelete
              ? `Tap again — ${txCount ?? 0} transaction${txCount === 1 ? '' : 's'} will lose this flag`
              : 'Delete flag…'}
          </button>
        </div>
      </div>
    </div>
  );
}
