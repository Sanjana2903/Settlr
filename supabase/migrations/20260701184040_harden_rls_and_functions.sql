-- Addresses findings from `supabase db advisors`:
-- 1. check_expense_split_total was missing a pinned search_path.
-- 2. handle_new_user is a trigger function and should not be directly callable via RPC.
-- 3. create_expense / join_group_by_invite_code should not be callable by anon (signed-out) users.
-- 4. RLS policies should wrap auth.uid() in (select ...) so it's evaluated once per query, not per row.
-- 5. profiles had two permissive SELECT policies; merged into one.

create or replace function public.check_expense_split_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  target_expense_id uuid := coalesce(new.expense_id, old.expense_id);
  expense_amount numeric(12, 2);
  split_total numeric(12, 2);
begin
  select amount into expense_amount from public.expenses where id = target_expense_id;
  select coalesce(sum(amount), 0) into split_total
    from public.expense_splits where expense_id = target_expense_id;

  if expense_amount is not null and split_total <> expense_amount then
    raise exception 'Expense splits (%) must sum to the expense amount (%)', split_total, expense_amount;
  end if;

  return null;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_expense(uuid, text, numeric, uuid, jsonb) from anon;
revoke execute on function public.join_group_by_invite_code(text) from anon;

drop policy "Read own profile" on public.profiles;
drop policy "Read profiles of shared-group members" on public.profiles;
drop policy "Update own profile" on public.profiles;
drop policy "Read groups you belong to" on public.groups;
drop policy "Create a group" on public.groups;
drop policy "Read membership of your groups" on public.group_members;
drop policy "Join a group yourself" on public.group_members;
drop policy "Read expenses in your groups" on public.expenses;
drop policy "Read splits in your groups" on public.expense_splits;
drop policy "Read settlements in your groups" on public.settlements;
drop policy "Create settlements in your groups" on public.settlements;
drop policy "Update settlements you're party to" on public.settlements;

create policy "Read own or shared-group profiles" on public.profiles
  for select using (
    id = (select auth.uid())
    or exists (
      select 1 from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );

create policy "Update own profile" on public.profiles
  for update using (id = (select auth.uid()));

create policy "Read groups you belong to" on public.groups
  for select using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id and user_id = (select auth.uid())
    )
  );

create policy "Create a group" on public.groups
  for insert with check (created_by = (select auth.uid()));

create policy "Read membership of your groups" on public.group_members
  for select using (
    exists (
      select 1 from public.group_members my_membership
      where my_membership.group_id = group_members.group_id
        and my_membership.user_id = (select auth.uid())
    )
  );

create policy "Join a group yourself" on public.group_members
  for insert with check (user_id = (select auth.uid()));

create policy "Read expenses in your groups" on public.expenses
  for select using (
    exists (
      select 1 from public.group_members
      where group_id = expenses.group_id and user_id = (select auth.uid())
    )
  );

create policy "Read splits in your groups" on public.expense_splits
  for select using (
    exists (
      select 1 from public.expenses
      join public.group_members on group_members.group_id = expenses.group_id
      where expenses.id = expense_splits.expense_id
        and group_members.user_id = (select auth.uid())
    )
  );

create policy "Read settlements in your groups" on public.settlements
  for select using (
    exists (
      select 1 from public.group_members
      where group_id = settlements.group_id and user_id = (select auth.uid())
    )
  );

create policy "Create settlements in your groups" on public.settlements
  for insert with check (
    from_user = (select auth.uid())
    and exists (
      select 1 from public.group_members
      where group_id = settlements.group_id and user_id = (select auth.uid())
    )
  );

create policy "Update settlements you're party to" on public.settlements
  for update using (
    from_user = (select auth.uid()) or to_user = (select auth.uid())
  );
