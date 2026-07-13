import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { updateFlag, deleteFlagAndUnflag, countFlagged } from '../db.js';
import FlagDot, { FLAG_COLOR_COUNT, FLAG_COLOR_NAMES } from '../components/FlagDot.jsx';

/** Long-press a flag chip → rename, recolor, archive, or delete the flag. */
export default function FlagManageSheet({ flag, onClose }) {
  const [name, setName] = useState(flag.name);
  const [color, setColor] = useState(flag.color);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const txCount = useLiveQuery(() => countFlagged(flag.id), [flag.id]);

  const dirty = name.trim() !== flag.name || color !== flag.color;

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
          <button
            type="button"
            className="btn-primary"
            disabled={!dirty || !name.trim()}
            onClick={async () => {
              await updateFlag(flag.id, { name: name.trim(), color });
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
