import { supabase } from './supabase';

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  upi_vpa: string | null;
};

export async function getMyProfile(): Promise<Profile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, upi_vpa')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateMyProfile(updates: {
  display_name?: string | null;
  upi_vpa?: string | null;
}): Promise<Profile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('id, email, display_name, upi_vpa')
    .single();
  if (error) throw error;
  return data;
}

export async function getProfilesByIds(userIds: string[]): Promise<Record<string, Profile>> {
  if (userIds.length === 0) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, upi_vpa')
    .in('id', userIds);
  if (error) throw error;

  return Object.fromEntries(data.map((p) => [p.id, p]));
}
