import { CheckIcon } from './icons.jsx';

/**
 * The 44pt cleared toggle target with the 28px disc inside.
 * Uncleared = dashed ring, cleared = solid disc — state is shape, not color.
 */
export default function ClearedDisc({ cleared, onToggle, variant = 'accent', payee }) {
  return (
    <button
      type="button"
      className="disc-target"
      aria-pressed={cleared}
      aria-label={`${payee ?? 'Transaction'}: ${cleared ? 'cleared' : 'outstanding'}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle?.();
      }}
    >
      <span className={`disc ${cleared ? 'disc--on' : 'disc--off'}${variant === 'navy' ? ' disc--navy' : ''}`}>
        {cleared && <CheckIcon />}
      </span>
    </button>
  );
}
