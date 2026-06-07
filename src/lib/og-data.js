import { computeNets, formatCents } from './vacationMath.js';
import { getTripSummary } from './firebase-admin.js';

function findFamilyByName(families, name) {
  if (!name) return null;
  const lower = String(name).trim().toLowerCase();
  if (!lower) return null;
  return families.find((f) => f.name.toLowerCase() === lower) || null;
}

function truncate(s, max) {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

export async function computeOgPayload({ code, family }) {
  const generic = {
    variant: 'generic',
    title: 'Vacation Splitter',
    subtitle: 'Split shared trip expenses across families.',
    tripName: '',
    familyName: '',
    netCents: 0,
    totalCents: 0,
    familyCount: 0,
    expenseCount: 0,
    tone: 'neutral',
  };

  if (!code) return generic;

  const trip = await getTripSummary(code);
  if (!trip) return { ...generic, variant: 'not-found', subtitle: `Trip ${code} not found.` };

  const familyMatch = findFamilyByName(trip.families, family);
  const { totalSpent, nets } = computeNets(trip.families, trip.expenses);

  if (familyMatch && trip.families.length >= 2 && trip.expenses.length > 0) {
    const myNet = nets.find((n) => n.id === familyMatch.id);
    const net = myNet?.net ?? 0;
    let tone = 'neutral';
    let label = 'is settled up on';
    if (net > 0) {
      tone = 'positive';
      label = 'is owed';
    } else if (net < 0) {
      tone = 'negative';
      label = 'owes';
    }
    const amount = net === 0 ? '' : ` ${formatCents(Math.abs(net))}`;
    return {
      variant: 'family-balance',
      title:
        net === 0
          ? `${truncate(familyMatch.name, 30)} ${label} ${truncate(trip.name, 40)}`
          : `${truncate(familyMatch.name, 30)} ${label}${amount}`,
      subtitle: net === 0 ? '' : truncate(trip.name, 40),
      tripName: trip.name,
      familyName: familyMatch.name,
      netCents: net,
      totalCents: totalSpent,
      familyCount: trip.families.length,
      expenseCount: trip.expenseCount,
      tone,
    };
  }

  // Trip-stats variant: trip exists but no usable family balance to show
  return {
    variant: 'trip-stats',
    title: truncate(trip.name, 40),
    subtitle:
      trip.expenses.length === 0
        ? `${trip.families.length} ${trip.families.length === 1 ? 'family' : 'families'} · no expenses yet`
        : `${formatCents(totalSpent)} across ${trip.families.length} ${
            trip.families.length === 1 ? 'family' : 'families'
          }`,
    tripName: trip.name,
    familyName: family ? String(family).trim() : '',
    netCents: 0,
    totalCents: totalSpent,
    familyCount: trip.families.length,
    expenseCount: trip.expenseCount,
    tone: 'neutral',
  };
}

export function buildOgImageUrl(origin, { code, family, expenseCount }) {
  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (family) params.set('family', family);
  if (typeof expenseCount === 'number') params.set('v', String(expenseCount));
  const qs = params.toString();
  const path = '/.netlify/functions/og';
  return qs ? `${origin}${path}?${qs}` : `${origin}${path}`;
}
