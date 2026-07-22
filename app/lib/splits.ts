export type ExpenseSplit = { user_id: string; amount: number };

// Work in integer cents throughout so rounding is exact and predictable;
// floating point cents (e.g. 33.33 x 3) would drift away from the total.
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

// Distributes remainder cents to the first N shares so the sum always
// matches the total exactly, instead of leaving a rounding gap.
function distributeRemainder(baseShares: number[], remainderCents: number): number[] {
  return baseShares.map((share, i) => share + (i < remainderCents ? 1 : 0));
}

export function computeEqualSplit(amount: number, memberIds: string[]): ExpenseSplit[] {
  if (memberIds.length === 0) {
    throw new Error('Select at least one person to split with');
  }

  const totalCents = toCents(amount);
  const baseShare = Math.floor(totalCents / memberIds.length);
  const remainder = totalCents - baseShare * memberIds.length;
  const shares = distributeRemainder(
    memberIds.map(() => baseShare),
    remainder
  );

  return memberIds.map((user_id, i) => ({ user_id, amount: fromCents(shares[i]) }));
}

export function computeExactSplit(
  amount: number,
  entries: { user_id: string; amount: number }[]
): ExpenseSplit[] {
  const totalCents = toCents(amount);
  const entryCents = entries.map((e) => toCents(e.amount));
  const sumCents = entryCents.reduce((sum, c) => sum + c, 0);

  if (sumCents !== totalCents) {
    throw new Error(
      `Splits add up to ${fromCents(sumCents).toFixed(2)}, but the expense is ${amount.toFixed(2)}`
    );
  }

  return entries.map((e, i) => ({ user_id: e.user_id, amount: fromCents(entryCents[i]) }));
}

export function computePercentageSplit(
  amount: number,
  entries: { user_id: string; percentage: number }[]
): ExpenseSplit[] {
  const totalPercentage = entries.reduce((sum, e) => sum + e.percentage, 0);
  if (Math.round(totalPercentage * 100) !== 10000) {
    throw new Error(`Percentages add up to ${totalPercentage}%, but should add up to 100%`);
  }

  const totalCents = toCents(amount);
  const rawShares = entries.map((e) => (totalCents * e.percentage) / 100);
  const baseShares = rawShares.map(Math.floor);
  const allocated = baseShares.reduce((sum, c) => sum + c, 0);
  const remainderCents = totalCents - allocated;

  // Largest-remainder method: give the leftover cents to whoever's raw share
  // was rounded down the most, so the split stays as fair as possible.
  const order = rawShares
    .map((share, i) => ({ i, fraction: share - baseShares[i] }))
    .sort((a, b) => b.fraction - a.fraction);

  const shares = [...baseShares];
  for (let k = 0; k < remainderCents; k++) {
    shares[order[k].i] += 1;
  }

  return entries.map((e, i) => ({ user_id: e.user_id, amount: fromCents(shares[i]) }));
}
