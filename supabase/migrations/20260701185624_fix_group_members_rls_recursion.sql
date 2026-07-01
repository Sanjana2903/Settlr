-- The "Read membership of your groups" policy on group_members queried
-- group_members from within its own USING clause, which re-triggers the same
-- policy on the inner query -- infinite recursion. Fix: move the membership
-- check into a SECURITY DEFINER function, which bypasses RLS internally
-- (it runs as the function owner, same as our other RPCs), breaking the loop.
create function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user_id
  );
$$;

revoke all on function public.is_group_member(uuid, uuid) from public, anon;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;

drop policy "Read membership of your groups" on public.group_members;
create policy "Read membership of your groups" on public.group_members
  for select using (public.is_group_member(group_id, (select auth.uid())));

drop policy "Read groups you belong to" on public.groups;
create policy "Read groups you belong to" on public.groups
  for select using (public.is_group_member(id, (select auth.uid())));

drop policy "Read expenses in your groups" on public.expenses;
create policy "Read expenses in your groups" on public.expenses
  for select using (public.is_group_member(group_id, (select auth.uid())));

drop policy "Read splits in your groups" on public.expense_splits;
create policy "Read splits in your groups" on public.expense_splits
  for select using (
    exists (
      select 1 from public.expenses
      where expenses.id = expense_splits.expense_id
        and public.is_group_member(expenses.group_id, (select auth.uid()))
    )
  );

drop policy "Read settlements in your groups" on public.settlements;
create policy "Read settlements in your groups" on public.settlements
  for select using (public.is_group_member(group_id, (select auth.uid())));

drop policy "Create settlements in your groups" on public.settlements;
create policy "Create settlements in your groups" on public.settlements
  for insert with check (
    from_user = (select auth.uid())
    and public.is_group_member(group_id, (select auth.uid()))
  );
