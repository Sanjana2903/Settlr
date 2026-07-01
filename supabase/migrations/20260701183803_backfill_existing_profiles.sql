-- Users who signed up before the profiles trigger existed need a profile row too.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
