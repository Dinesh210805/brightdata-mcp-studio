-- Run this once in the Supabase SQL editor.
--
-- One row per signed-in person. Row-level security is what keeps one user's
-- Bright Data key unreadable by every other user: the policies below compare
-- auth.uid() to the row's id, so a leaked anon key still cannot read anyone
-- else's row.
--
-- The key is stored as text. Supabase encrypts the database at rest, but a
-- compromised service_role key would expose these values - encrypting the
-- column with pgsodium is the next hardening step, not something this schema
-- does today.

create table if not exists public.profiles (
    id              uuid primary key references auth.users on delete cascade,
    email           text,
    brightdata_key  text,
    notify_by_email boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile"
    on public.profiles for select
    using (auth.uid() = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile"
    on public.profiles for insert
    with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
    on public.profiles for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Create the profile row the moment someone signs in for the first time, so
-- the app never has to handle a missing row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- One pending Bright Data device-login per user. When someone clicks "Sign in
-- with Bright Data", the dashboard asks Bright Data for a device code and parks
-- it here so a serverless poll (which may land on a different instance) can
-- still claim the token. The row is deleted on success, expiry or failure.
-- The device_code alone cannot mint a key -- the human still has to approve the
-- code on Bright Data's website -- and it is readable only by its owner, but a
-- compromised service_role key would expose it, the same trade-off the
-- profiles table documents above.
create table if not exists public.device_flows (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null references auth.users on delete cascade,
    device_code      text not null,
    user_code        text not null,
    verification_uri text not null,
    interval_seconds integer not null default 5,
    expires_at       timestamptz not null,
    -- The browser drives the polling, so the server has to be the thing that
    -- enforces the interval. Without this a stuck tab can rate-limit Bright
    -- Data for every user on the deployment, not just its own.
    last_polled_at   timestamptz,
    created_at       timestamptz not null default now(),
    unique (user_id)
);

alter table public.device_flows enable row level security;

drop policy if exists "read own device flow" on public.device_flows;
create policy "read own device flow"
    on public.device_flows for select
    using (auth.uid() = user_id);

drop policy if exists "insert own device flow" on public.device_flows;
create policy "insert own device flow"
    on public.device_flows for insert
    with check (auth.uid() = user_id);

drop policy if exists "update own device flow" on public.device_flows;
create policy "update own device flow"
    on public.device_flows for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "delete own device flow" on public.device_flows;
create policy "delete own device flow"
    on public.device_flows for delete
    using (auth.uid() = user_id);
