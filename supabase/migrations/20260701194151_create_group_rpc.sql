-- The on_group_created AFTER INSERT trigger doesn't work: AFTER triggers fire
-- at the very end of the statement, *after* RETURNING's RLS-based row
-- visibility check already ran -- so the group's own creator could never
-- satisfy the "must be a member" SELECT policy in time, and every group
-- creation failed with "new row violates row-level security policy".
--
-- Fix: do the whole thing inside one SECURITY DEFINER RPC (same pattern as
-- create_expense), which bypasses RLS internally and controls ordering
-- explicitly, instead of relying on trigger timing.

drop trigger on_group_created on public.groups;
drop function public.add_creator_as_member();
drop policy "Create a group" on public.groups;

create function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group public.groups;
begin
  insert into public.groups (name, created_by)
  values (p_name, auth.uid())
  returning * into new_group;

  insert into public.group_members (group_id, user_id)
  values (new_group.id, auth.uid());

  return new_group;
end;
$$;

revoke all on function public.create_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;
