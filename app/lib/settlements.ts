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

// The payer records this after completing the UPI payment ("I've paid"), but
// it doesn't count toward balances until the payee confirms they received it.
export async function createPendingSettlement(
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
      status: 'pending',
    })
    .select('id, group_id, from_user, to_user, amount, status, created_at, confirmed_at')
    .single();
  if (error) throw error;
  return data as Settlement;
}

export async function confirmSettlement(settlementId: string): Promise<Settlement> {
  const { data, error } = await supabase
    .from('settlements')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', settlementId)
    .select('id, group_id, from_user, to_user, amount, status, created_at, confirmed_at')
    .single();
  if (error) throw error;
  return data as Settlement;
}
