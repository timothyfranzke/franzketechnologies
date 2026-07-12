// Recurring rule date math. Dates are ISO 'YYYY-MM-DD' strings (lexicographically
// sortable); all arithmetic happens on {y, m, d} to stay timezone-proof.

export function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function toIso({ y, m, d }) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

function addDays(iso, days) {
  const { y, m, d } = parseDate(iso);
  const date = new Date(y, m - 1, d + days);
  return toIso({ y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate() });
}

// Month/year steps clamp to the last day of the target month (Jan 31 + 1mo →
// Feb 28), anchored on the rule's original day so a 31st rule snaps back to
// the 31st in longer months.
function addMonths(iso, months, anchorDay) {
  const { y, m } = parseDate(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return toIso({ y: ny, m: nm, d: Math.min(anchorDay, daysInMonth(ny, nm)) });
}

/** The due date after `dueIso` for this rule. */
export function nextOccurrence(rule, dueIso) {
  const anchorDay = rule.anchorDay ?? parseDate(dueIso).d;
  switch (rule.frequency) {
    case 'weekly':
      return addDays(dueIso, 7 * rule.interval);
    case 'biweekly':
      return addDays(dueIso, 14 * rule.interval);
    case 'monthly':
      return addMonths(dueIso, rule.interval, anchorDay);
    case 'yearly':
      return addMonths(dueIso, 12 * rule.interval, anchorDay);
    default:
      throw new Error(`Unknown frequency: ${rule.frequency}`);
  }
}

/**
 * All instances due on or before `todayIso`, plus the rule's next state.
 * A rule whose end condition is exhausted comes back with nextDue: null
 * (kept, not deleted, so instance edits can still find it).
 *
 * endCondition: {type:'never'} | {type:'count', n} | {type:'until', date}
 */
export function dueInstances(rule, today) {
  const dates = [];
  let due = rule.nextDue;
  let done = rule.occurrencesDone ?? 0;
  const end = rule.endCondition ?? { type: 'never' };

  while (due !== null && due <= today) {
    if (end.type === 'count' && done >= end.n) {
      due = null;
      break;
    }
    if (end.type === 'until' && due > end.date) {
      due = null;
      break;
    }
    dates.push(due);
    done += 1;
    due = nextOccurrence(rule, due);
  }

  if (end.type === 'count' && done >= end.n) due = null;
  if (end.type === 'until' && due !== null && due > end.date) due = null;

  return { dates, nextDue: due, occurrencesDone: done };
}
