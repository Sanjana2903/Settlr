-- Core schema for groups, expenses, and settlements.
-- Balances are computed client-side from these raw ledger rows (see lib/balances.ts),
-- not stored redundantly, so there is a single source of truth for "who owes what."

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Every auth user gets a matching profile row automatically.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  paid_by uuid not null references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.expense_splits (
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  amount numeric(12, 2) not null check (amount >= 0),
  primary key (expense_id, user_id)
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user uuid not null references public.profiles (id),
  to_user uuid not null references public.profiles (id),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- A row-level invariant checked at COMMIT time (not per-row) so a multi-row
-- insert of splits for one expense can complete before the sum is validated.
create function public.check_expense_split_total()
returns trigger
language plpgsql
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

create constraint trigger expense_splits_total_check
  after insert or update or delete on public.expense_splits
  deferrable initially deferred
  for each row execute function public.check_expense_split_total();

-- Atomically creates an expense and its splits, so a client can never end up
-- with an expense that has no splits or splits that don't sum to the total.
create function public.create_expense(
  p_group_id uuid,
  p_description text,
  p_amount numeric,
  p_paid_by uuid,
  p_splits jsonb -- [{"user_id": "...", "amount": 12.50}, ...]
)
returns public.expenses
language plpgsql
security definer
set search_path = public
as $$
declare
  new_expense public.expenses;
begin
  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this group';
  end if;

  insert into public.expenses (group_id, description, amount, paid_by, created_by)
  values (p_group_id, p_description, p_amount, p_paid_by, auth.uid())
  returning * into new_expense;

  insert into public.expense_splits (expense_id, user_id, amount)
  select new_expense.id, (item ->> 'user_id')::uuid, (item ->> 'amount')::numeric
  from jsonb_array_elements(p_splits) as item;

  return new_expense;
end;
$$;

create function public.join_group_by_invite_code(p_invite_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group public.groups;
begin
  select * into target_group from public.groups where invite_code = p_invite_code;

  if not found then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id)
  values (target_group.id, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return target_group;
end;
$$;

-- Row Level Security: every table is scoped to the caller's own group memberships.

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;

create policy "Read own profile" on public.profiles
  for select using (id = auth.uid());

create policy "Read profiles of shared-group members" on public.profiles
  for select using (
    exists (
      select 1 from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );

create policy "Update own profile" on public.profiles
  for update using (id = auth.uid());

create policy "Read groups you belong to" on public.groups
  for select using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id and user_id = auth.uid()
    )
  );

create policy "Create a group" on public.groups
  for insert with check (created_by = auth.uid());

create policy "Read membership of your groups" on public.group_members
  for select using (
    exists (
      select 1 from public.group_members my_membership
      where my_membership.group_id = group_members.group_id
        and my_membership.user_id = auth.uid()
    )
  );

create policy "Join a group yourself" on public.group_members
  for insert with check (user_id = auth.uid());

create policy "Read expenses in your groups" on public.expenses
  for select using (
    exists (
      select 1 from public.group_members
      where group_id = expenses.group_id and user_id = auth.uid()
    )
  );

create policy "Read splits in your groups" on public.expense_splits
  for select using (
    exists (
      select 1 from public.expenses
      join public.group_members on group_members.group_id = expenses.group_id
      where expenses.id = expense_splits.expense_id and group_members.user_id = auth.uid()
    )
  );

create policy "Read settlements in your groups" on public.settlements
  for select using (
    exists (
      select 1 from public.group_members
      where group_id = settlements.group_id and user_id = auth.uid()
    )
  );

create policy "Create settlements in your groups" on public.settlements
  for insert with check (
    from_user = auth.uid()
    and exists (
      select 1 from public.group_members
      where group_id = settlements.group_id and user_id = auth.uid()
    )
  );

create policy "Update settlements you're party to" on public.settlements
  for update using (from_user = auth.uid() or to_user = auth.uid());
