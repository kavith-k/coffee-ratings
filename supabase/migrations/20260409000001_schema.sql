-- Migration 001: Core schema
-- Tables: profiles, groups, group_members, cafes, ratings
-- Extensions: pg_trgm for fuzzy search
-- Trigger: auto-create profile on auth.users insert

-- Enable trigram extension for fuzzy cafe search
create extension if not exists pg_trgm;

-- pgcrypto is pre-installed on Supabase in the `extensions` schema. We rely
-- on `extensions.gen_random_bytes()` below; keep the function call schema-
-- qualified so it resolves regardless of the connection's search_path.
create extension if not exists pgcrypto with schema extensions;

--------------------------------------------------------------------------------
-- profiles
--------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

--------------------------------------------------------------------------------
-- groups
--------------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_by uuid not null references public.profiles (id) on delete cascade,
  -- 16 random bytes = 128 bits of entropy. Hex-encoded for URL-safe, 32-char invite codes.
  invite_code text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create index idx_groups_invite_code on public.groups (invite_code);

alter table public.groups enable row level security;

--------------------------------------------------------------------------------
-- group_members
--------------------------------------------------------------------------------
create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index idx_group_members_user_id on public.group_members (user_id);

alter table public.group_members enable row level security;

--------------------------------------------------------------------------------
-- cafes
--------------------------------------------------------------------------------
create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  area text check (area is null or char_length(area) between 1 and 100),
  lat double precision check (lat is null or (lat between -90 and 90)),
  lng double precision check (lng is null or (lng between -180 and 180)),
  -- Nullable so `on delete set null` is consistent: when a user who added a cafe
  -- deletes their account, the cafe stays (it's shared data) with an orphaned creator.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_cafes_name_trgm on public.cafes using gin (name gin_trgm_ops);

alter table public.cafes enable row level security;

--------------------------------------------------------------------------------
-- ratings
--------------------------------------------------------------------------------
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  rating numeric(2,1) not null check (rating >= 0 and rating <= 7),
  visited_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index idx_ratings_cafe_id on public.ratings (cafe_id);
create index idx_ratings_user_id on public.ratings (user_id);
create index idx_ratings_created_at on public.ratings (created_at desc);

alter table public.ratings enable row level security;

--------------------------------------------------------------------------------
-- Trigger: auto-create profile on new auth user
--------------------------------------------------------------------------------
-- The display_name is sanitised here because `raw_user_meta_data` is entirely
-- user-controlled at signup. We trim whitespace, clamp to 50 characters to
-- match the check constraint on `profiles.display_name`, and fall back to a
-- generic value if the result would be empty.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := trim(
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  );

  if v_display_name is null or char_length(v_display_name) = 0 then
    v_display_name := 'user';
  end if;

  v_display_name := left(v_display_name, 50);

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
