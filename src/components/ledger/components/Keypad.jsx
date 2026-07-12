/** Numeric keypad: digits fill cents-first, backspace pops. */
export default function Keypad({ onDigit, onBackspace }) {
  return (
    <div className="keypad">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
        <button key={d} type="button" className="keypad-btn money" onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      <span />
      <button type="button" className="keypad-btn money" onClick={() => onDigit('0')}>
        0
      </button>
      <button type="button" className="keypad-btn" onClick={onBackspace} aria-label="Backspace">
        ⌫
      </button>
    </div>
  );
}
