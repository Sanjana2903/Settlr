import { computeEqualSplit, computeExactSplit, computePercentageSplit } from '../splits';

function sum(splits: { amount: number }[]) {
  return Math.round(splits.reduce((total, s) => total + s.amount, 0) * 100) / 100;
}

describe('computeEqualSplit', () => {
  it('splits evenly when it divides cleanly', () => {
    const splits = computeEqualSplit(100, ['a', 'b']);
    expect(splits).toEqual([
      { user_id: 'a', amount: 50 },
      { user_id: 'b', amount: 50 },
    ]);
  });

  it('distributes the remainder cent-by-cent so the sum matches exactly', () => {
    const splits = computeEqualSplit(100, ['a', 'b', 'c']);
    expect(sum(splits)).toBe(100);
    expect(splits.map((s) => s.amount)).toEqual([33.34, 33.33, 33.33]);
  });

  it('throws when no members are given', () => {
    expect(() => computeEqualSplit(100, [])).toThrow();
  });
});

describe('computeExactSplit', () => {
  it('accepts entries that sum to the total', () => {
    const splits = computeExactSplit(100, [
      { user_id: 'a', amount: 60 },
      { user_id: 'b', amount: 40 },
    ]);
    expect(sum(splits)).toBe(100);
  });

  it('rejects entries that do not sum to the total', () => {
    expect(() =>
      computeExactSplit(100, [
        { user_id: 'a', amount: 60 },
        { user_id: 'b', amount: 30 },
      ])
    ).toThrow();
  });
});

describe('computePercentageSplit', () => {
  it('splits proportionally when percentages divide cleanly', () => {
    const splits = computePercentageSplit(100, [
      { user_id: 'a', percentage: 50 },
      { user_id: 'b', percentage: 50 },
    ]);
    expect(splits).toEqual([
      { user_id: 'a', amount: 50 },
      { user_id: 'b', amount: 50 },
    ]);
  });

  it('handles a three-way split that does not divide evenly', () => {
    const splits = computePercentageSplit(100, [
      { user_id: 'a', percentage: 33.33 },
      { user_id: 'b', percentage: 33.33 },
      { user_id: 'c', percentage: 33.34 },
    ]);
    expect(sum(splits)).toBe(100);
  });

  it('rejects percentages that do not add up to 100', () => {
    expect(() =>
      computePercentageSplit(100, [
        { user_id: 'a', percentage: 40 },
        { user_id: 'b', percentage: 40 },
      ])
    ).toThrow();
  });
});
