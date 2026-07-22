import { computeNetBalances, simplifyDebts, type LedgerExpense, type LedgerSettlement } from '../balances';

function sumBalances(balances: Record<string, number>) {
  return Math.round(Object.values(balances).reduce((a, b) => a + b, 0) * 100) / 100;
}

describe('computeNetBalances', () => {
  it('credits the payer and debits each split for a single expense', () => {
    const expenses: LedgerExpense[] = [
      { paid_by: 'a', amount: 100, splits: [{ user_id: 'a', amount: 50 }, { user_id: 'b', amount: 50 }] },
    ];
    const balances = computeNetBalances(['a', 'b'], expenses, []);
    expect(balances).toEqual({ a: 50, b: -50 });
  });

  it('always sums to zero across a group, regardless of expense count', () => {
    const expenses: LedgerExpense[] = [
      { paid_by: 'a', amount: 90, splits: [{ user_id: 'a', amount: 30 }, { user_id: 'b', amount: 30 }, { user_id: 'c', amount: 30 }] },
      { paid_by: 'b', amount: 45, splits: [{ user_id: 'a', amount: 15 }, { user_id: 'b', amount: 15 }, { user_id: 'c', amount: 15 }] },
      { paid_by: 'c', amount: 10, splits: [{ user_id: 'a', amount: 10 }] },
    ];
    const balances = computeNetBalances(['a', 'b', 'c'], expenses, []);
    expect(sumBalances(balances)).toBe(0);
  });

  it('moves balance from payer to payee for a confirmed settlement', () => {
    const settlements: LedgerSettlement[] = [{ from_user: 'b', to_user: 'a', amount: 50, status: 'confirmed' }];
    const balances = computeNetBalances(['a', 'b'], [], settlements);
    expect(balances).toEqual({ a: -50, b: 50 });
  });

  it('ignores pending and cancelled settlements', () => {
    const settlements: LedgerSettlement[] = [
      { from_user: 'b', to_user: 'a', amount: 50, status: 'pending' },
      { from_user: 'b', to_user: 'a', amount: 20, status: 'cancelled' },
    ];
    const balances = computeNetBalances(['a', 'b'], [], settlements);
    expect(balances).toEqual({ a: 0, b: 0 });
  });

  it('nets an expense against a settlement back to zero', () => {
    const expenses: LedgerExpense[] = [
      { paid_by: 'a', amount: 100, splits: [{ user_id: 'a', amount: 50 }, { user_id: 'b', amount: 50 }] },
    ];
    const settlements: LedgerSettlement[] = [{ from_user: 'b', to_user: 'a', amount: 50, status: 'confirmed' }];
    const balances = computeNetBalances(['a', 'b'], expenses, settlements);
    expect(balances).toEqual({ a: 0, b: 0 });
  });
});

describe('simplifyDebts', () => {
  it('produces one transaction for a simple two-person debt', () => {
    const suggestions = simplifyDebts({ a: 50, b: -50 });
    expect(suggestions).toEqual([{ from: 'b', to: 'a', amount: 50 }]);
  });

  it('produces zero transactions once everyone is settled', () => {
    expect(simplifyDebts({ a: 0, b: 0 })).toEqual([]);
  });

  it('minimizes transactions for a three-person group (2 debtors, 1 creditor)', () => {
    const suggestions = simplifyDebts({ a: -10, b: -5, c: 15 });
    expect(suggestions).toHaveLength(2);
    expect(suggestions.every((s) => s.to === 'c')).toBe(true);
    expect(suggestions.reduce((sum, s) => sum + s.amount, 0)).toBe(15);
  });

  it('nets out a three-way cycle to zero real transactions', () => {
    // a owes b owes c owes a the same amount -- everyone's net balance is 0.
    const suggestions = simplifyDebts({ a: 0, b: 0, c: 0 });
    expect(suggestions).toEqual([]);
  });

  it('every suggestion, once applied, brings all balances to exactly zero', () => {
    const balances = { a: -30, b: -20, c: 25, d: 25 };
    const suggestions = simplifyDebts(balances);

    const result = { ...balances };
    for (const s of suggestions) {
      result[s.from as keyof typeof result] += s.amount;
      result[s.to as keyof typeof result] -= s.amount;
    }

    for (const amount of Object.values(result)) {
      expect(amount).toBe(0);
    }
  });
});
