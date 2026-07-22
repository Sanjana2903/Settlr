import { supabase } from './supabase';

export type Settlement = {
  id: string;
  group_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  created_at: string;
  confirmed_at: string | null;
};

export async function listSettlements(groupId: string): Promise<Settlement[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select('id, group_id, from_user, to_user, amount, status, created_at, confirmed_at')
    .eq('group_id', groupId);
  if (error) throw error;
  return data as Settlement[];
}

// MVP: recording a settlement just marks it confirmed immediately (no UPI
// deep-link handoff or two-way confirmation yet -- that's a Phase 2 feature).
export async function recordSettlement(
  groupId: string,
  fromUser: string,
  toUser: string,
  amount: number
): Promise<Settlement> {
  const { data, error } = await supabase
    .from('settlements')
    .insert({
      group_id: groupId,
      from_user: fromUser,
      to_user: toUser,
      amount,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .select('id, group_id, from_user, to_user, amount, status, created_at, confirmed_at')
    .single();
  if (error) throw error;
  return data as Settlement;
}
