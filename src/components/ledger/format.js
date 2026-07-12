// Date display helpers. Dates are ISO 'YYYY-MM-DD'; construct local Dates from
// parts so the string never shifts across timezones.

function toDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "Jul 3" */
export function formatDateShort(iso) {
  return toDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "July 2026" */
export function formatMonthYear(iso) {
  return toDate(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** "Jul 12, 2026" */
export function formatDateLong(iso) {
  return toDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
