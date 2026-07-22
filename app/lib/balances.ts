export type LedgerExpense = {
  paid_by: string;
  amount: number;
  splits: { user_id: string; amount: number }[];
};

export type LedgerSettlement = {
  from_user: string;
  to_user: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
};

// Positive balance = the group owes this person; negative = they owe the group.
export function computeNetBalances(
  memberIds: string[],
  expenses: LedgerExpense[],
  settlements: LedgerSettlement[]
): Record<string, number> {
  const balances: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));

  for (const expense of expenses) {
    balances[expense.paid_by] = (balances[expense.paid_by] ?? 0) + expense.amount;
    for (const split of expense.splits) {
      balances[split.user_id] = (balances[split.user_id] ?? 0) - split.amount;
    }
  }

  for (const settlement of settlements) {
    if (settlement.status !== 'confirmed') continue;
    // A settlement is the debtor paying the creditor directly, so it moves
    // the payer's balance up (less owed) and the payee's balance down
    // (already received, so less owed to them).
    balances[settlement.from_user] = (balances[settlement.from_user] ?? 0) + settlement.amount;
    balances[settlement.to_user] = (balances[settlement.to_user] ?? 0) - settlement.amount;
  }

  // Guard against float drift accumulating across many expenses/settlements.
  for (const id of Object.keys(balances)) {
    balances[id] = Math.round(balances[id] * 100) / 100;
  }

  return balances;
}

export type SettlementSuggestion = { from: string; to: string; amount: number };

// Greedy largest-debtor-vs-largest-creditor matching: minimizes the number of
// settling transactions needed to bring every balance to zero.
export function simplifyDebts(balances: Record<string, number>): SettlementSuggestion[] {
  const entries = Object.entries(balances)
    .map(([user_id, amount]) => ({ user_id, cents: Math.round(amount * 100) }))
    .filter((e) => e.cents !== 0);

  const creditors = entries.filter((e) => e.cents > 0).sort((a, b) => b.cents - a.cents);
  const debtors = entries.filter((e) => e.cents < 0).sort((a, b) => a.cents - b.cents);

  const suggestions: SettlementSuggestion[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amountCents = Math.min(-debtor.cents, creditor.cents);

    if (amountCents > 0) {
      suggestions.push({ from: debtor.user_id, to: creditor.user_id, amount: amountCents / 100 });
    }

    debtor.cents += amountCents;
    creditor.cents -= amountCents;

    if (debtor.cents === 0) i++;
    if (creditor.cents === 0) j++;
  }

  return suggestions;
}
