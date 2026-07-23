-- A user's own UPI VPA (e.g. "name@okhdfcbank"), needed to build a UPI
-- payment deep link when someone else owes them money.
alter table public.profiles
  add column upi_vpa text;

alter table public.profiles
  add constraint upi_vpa_format check (
    upi_vpa is null or upi_vpa ~ '^[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.\-_]+$'
  );
