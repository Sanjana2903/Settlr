-- Without this, a newly created group would be invisible to its own creator,
-- since the "Read groups you belong to" policy requires group_members membership.
create function public.add_creator_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id)
  values (new.id, new.created_by)
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.add_creator_as_member();

revoke all on function public.add_creator_as_member() from public, anon, authenticated;
