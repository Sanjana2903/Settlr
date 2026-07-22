import { supabase } from './supabase';
import type { ExpenseSplit } from './splits';

export type Expense = {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  paid_by: string;
  created_by: string;
  created_at: string;
};

export async function listExpenses(groupId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, group_id, description, amount, paid_by, created_by, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listExpenseSplits(expenseIds: string[]): Promise<
  Record<string, ExpenseSplit[]>
> {
  if (expenseIds.length === 0) return {};

  const { data, error } = await supabase
    .from('expense_splits')
    .select('expense_id, user_id, amount')
    .in('expense_id', expenseIds);
  if (error) throw error;

  const byExpense: Record<string, ExpenseSplit[]> = {};
  for (const row of data) {
    (byExpense[row.expense_id] ??= []).push({ user_id: row.user_id, amount: row.amount });
  }
  return byExpense;
}

export async function createExpense(
  groupId: string,
  description: string,
  amount: number,
  paidBy: string,
  splits: ExpenseSplit[]
): Promise<Expense> {
  const { data, error } = await supabase.rpc('create_expense', {
    p_group_id: groupId,
    p_description: description,
    p_amount: amount,
    p_paid_by: paidBy,
    p_splits: splits,
  });
  if (error) throw error;
  return data;
}
