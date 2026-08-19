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
