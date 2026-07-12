// All amounts are integer cents. Formatting is the only place decimals exist.

const MINUS = '−'; // the mockups use a true minus sign, not a hyphen

function formatter(locale) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
  });
}

/** "$1,857.06"; negatives as "−$286.44". */
export function formatCents(cents, locale) {
  const abs = formatter(locale).format(Math.abs(cents) / 100);
  return cents < 0 ? `${MINUS}${abs}` : abs;
}

/** Always signed: "+$1,650.00" / "−$54.32". Zero formats as "$0.00". */
export function formatSigned(cents, locale) {
  if (cents === 0) return formatter(locale).format(0);
  const abs = formatter(locale).format(Math.abs(cents) / 100);
  return cents < 0 ? `${MINUS}${abs}` : `+${abs}`;
}

/** Keypad digits fill cents-first: "5432" → 5432 ($54.32). */
export function centsFromKeypad(digits) {
  const clean = String(digits).replace(/\D/g, '').slice(0, 10);
  return clean ? parseInt(clean, 10) : 0;
}

/** "386.27" for CSV export (signed decimal string, no symbol). */
export function decimalString(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
