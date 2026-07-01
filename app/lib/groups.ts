import { supabase } from './supabase';

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

export type GroupMember = {
  user_id: string;
  joined_at: string;
  profile: { id: string; email: string; display_name: string | null } | null;
};

export async function listMyGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, invite_code, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getGroup(groupId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, invite_code, created_at')
    .eq('id', groupId)
    .single();
  if (error) throw error;
  return data;
}

export async function createGroup(name: string): Promise<Group> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('groups')
    .insert({ name, created_by: userId })
    .select('id, name, invite_code, created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function joinGroupByInviteCode(inviteCode: string): Promise<Group> {
  const { data, error } = await supabase.rpc('join_group_by_invite_code', {
    p_invite_code: inviteCode.trim().toLowerCase(),
  });
  if (error) throw error;
  return data;
}

export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, joined_at, profile:profiles(id, email, display_name)')
    .eq('group_id', groupId);
  if (error) throw error;
  return data as unknown as GroupMember[];
}
