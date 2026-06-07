// Pure settlement math. All amounts are integer cents.

export function computeNets(families, expenses) {
  const totalSpent = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const familyCount = families.length;

  if (familyCount === 0) {
    return { totalSpent, fairShare: 0, nets: [] };
  }

  const fairShare = Math.floor(totalSpent / familyCount);
  const remainder = totalSpent - fairShare * familyCount;

  const ordered = [...families].sort((a, b) => (a.joinedAtMs ?? 0) - (b.joinedAtMs ?? 0));
  const shareById = new Map();
  ordered.forEach((f, i) => {
    shareById.set(f.id, fairShare + (i < remainder ? 1 : 0));
  });

  const paidById = new Map();
  for (const e of expenses) {
    paidById.set(e.paidByFamilyId, (paidById.get(e.paidByFamilyId) ?? 0) + e.amountCents);
  }

  const nets = families.map((f) => {
    const paid = paidById.get(f.id) ?? 0;
    const share = shareById.get(f.id) ?? 0;
    return { id: f.id, name: f.name, paid, share, net: paid - share };
  });

  return { totalSpent, fairShare, nets };
}

export function computeSettlement(nets) {
  const creditors = nets
    .filter((n) => n.net > 0)
    .map((n) => ({ id: n.id, name: n.name, remaining: n.net }))
    .sort((a, b) => b.remaining - a.remaining);

  const debtors = nets
    .filter((n) => n.net < 0)
    .map((n) => ({ id: n.id, name: n.name, remaining: -n.net }))
    .sort((a, b) => b.remaining - a.remaining);

  const transactions = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.remaining, debt.remaining);
    transactions.push({
      fromId: debt.id,
      fromName: debt.name,
      toId: credit.id,
      toName: credit.name,
      amountCents: amount,
    });
    credit.remaining -= amount;
    debt.remaining -= amount;
    if (credit.remaining === 0) ci += 1;
    if (debt.remaining === 0) di += 1;
  }

  return transactions;
}

export function formatCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}$${dollars.toLocaleString()}.${rem.toString().padStart(2, "0")}`;
}

export function parseDollarsToCents(input) {
  const cleaned = String(input).replace(/[^0-9.]/g, "");
  if (!cleaned) return NaN;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}
