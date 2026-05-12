-- Run in Supabase SQL Editor (Dashboard → SQL) after creating a project.
-- Free tier: https://supabase.com — Auth + Postgres + RLS.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.public_opinions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  country_id text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint public_opinions_body_len check (char_length(body) >= 8 and char_length(body) <= 2000)
);

create index if not exists public_opinions_country_created_idx on public.public_opinions (country_id, created_at desc);
create index if not exists public_opinions_user_created_idx on public.public_opinions (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.public_opinions enable row level security;

drop policy if exists "profiles_select_auth" on public.profiles;
create policy "profiles_select_auth" on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);

drop policy if exists "opinions_select_auth" on public.public_opinions;
create policy "opinions_select_auth" on public.public_opinions for select to authenticated using (true);

drop policy if exists "opinions_insert_own" on public.public_opinions;
create policy "opinions_insert_own" on public.public_opinions for insert to authenticated with check (auth.uid() = user_id);

-- Auto-create profile on signup (username from email local-part + disambiguation).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  uname text;
  n int := 0;
begin
  base := regexp_replace(lower(split_part(coalesce(new.email, 'user'), '@', 1)), '[^a-z0-9_]', '', 'g');
  if base is null or length(base) < 2 then
    base := 'user';
  end if;
  uname := base;
  while exists (select 1 from public.profiles p where p.username = uname) loop
    n := n + 1;
    uname := base || '_' || n::text;
  end loop;
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    uname,
    nullif(trim(split_part(coalesce(new.email, ''), '@', 1)), '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
