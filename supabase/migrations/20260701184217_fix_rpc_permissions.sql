-- Postgres grants EXECUTE to PUBLIC by default on newly created functions.
-- Revoking from `anon` alone doesn't undo a PUBLIC grant, which is why the
-- previous migration's revoke didn't fully take. Revoke from PUBLIC, then
-- re-grant only to authenticated (these two RPCs require a signed-in caller).

revoke execute on function public.create_expense(uuid, text, numeric, uuid, jsonb) from public;
revoke execute on function public.join_group_by_invite_code(text) from public;

grant execute on function public.create_expense(uuid, text, numeric, uuid, jsonb) to authenticated;
grant execute on function public.join_group_by_invite_code(text) to authenticated;
