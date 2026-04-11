-- Migration 003: RPC functions
-- Called from SvelteKit via supabase.rpc()
--
-- Conventions enforced in this file:
--   * Every RPC that touches user data checks `auth.uid() is not null` and
--     raises 'Not authenticated' otherwise. The only deliberate exception is
--     `get_group_preview_by_invite_code`, which powers the unauthenticated
--     invite landing page.
--   * Every RPC that accepts a `limit` parameter clamps it to a small upper
--     bound with `least(coalesce(p_limit, <default>), <cap>)`. PostgREST's
--     `max_rows` setting does NOT apply to RPC return values, so the clamp
--     must live inside the function.

--------------------------------------------------------------------------------
-- create_group: create a new group and add the creator as admin atomically
--
-- This RPC is the ONLY supported path for creating groups. The `groups` and
-- `group_members` tables have no INSERT policies, so direct client inserts
-- are blocked; a `security definer` function is therefore required to insert
-- both rows in a single transaction, guaranteeing that every group has at
-- least one admin member.
--------------------------------------------------------------------------------
create or replace function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_user_id uuid := auth.uid();
  v_name text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_name := trim(coalesce(p_name, ''));
  if char_length(v_name) = 0 then
    raise exception 'Group name cannot be empty';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'Group name too long (max 100 characters)';
  end if;

  insert into public.groups (name, created_by)
  values (v_name, v_user_id)
  returning id into v_group_id;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_user_id, 'admin');

  return v_group_id;
end;
$$;

--------------------------------------------------------------------------------
-- join_group_by_invite_code: join a group using its invite code
--------------------------------------------------------------------------------
create or replace function public.join_group_by_invite_code(code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_group_id from public.groups where invite_code = code;

  if v_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  if exists (
    select 1 from public.group_members
    where group_id = v_group_id and user_id = v_user_id
  ) then
    return v_group_id;
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_user_id, 'member');

  return v_group_id;
end;
$$;

--------------------------------------------------------------------------------
-- get_group_preview_by_invite_code: public preview for invite landing page
--
-- This is the ONE RPC that is intentionally callable by anonymous users, so
-- that the /join/[code] page can render the group name and member count
-- before the user signs in. It returns no member IDs or other sensitive data.
--------------------------------------------------------------------------------
create or replace function public.get_group_preview_by_invite_code(code text)
returns table (name text, member_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.name, count(gm.user_id) as member_count
  from public.groups g
  left join public.group_members gm on gm.group_id = g.id
  where g.invite_code = code
  group by g.id, g.name;
$$;

--------------------------------------------------------------------------------
-- get_personalised_cafe_list: home page ranked cafe list
--------------------------------------------------------------------------------
create or replace function public.get_personalised_cafe_list(
  p_area text default null,
  p_sort_by text default 'avg_rating',
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  cafe_id uuid,
  cafe_name text,
  area text,
  lat double precision,
  lng double precision,
  avg_rating numeric,
  num_ratings bigint,
  num_raters bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  with visible as (
    select * from public.visible_user_ids()
  )
  select
    c.id as cafe_id,
    c.name as cafe_name,
    c.area,
    c.lat,
    c.lng,
    round(avg(r.rating), 1) as avg_rating,
    count(r.id) as num_ratings,
    count(distinct r.user_id) as num_raters
  from public.cafes c
  left join public.ratings r
    on r.cafe_id = c.id
    and r.user_id in (select * from visible)
  where (p_area is null or c.area = p_area)
  group by c.id, c.name, c.area, c.lat, c.lng
  order by
    case when p_sort_by = 'avg_rating' then round(avg(r.rating), 1) end desc nulls last,
    case when p_sort_by = 'num_ratings' then count(r.id) end desc nulls last,
    c.name asc
  limit least(coalesce(p_limit, 50), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

--------------------------------------------------------------------------------
-- get_cafe_personalised_average: single cafe stats for visible users
--------------------------------------------------------------------------------
create or replace function public.get_cafe_personalised_average(p_cafe_id uuid)
returns table (
  avg_rating numeric,
  num_ratings bigint,
  num_raters bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    round(avg(r.rating), 1) as avg_rating,
    count(r.id) as num_ratings,
    count(distinct r.user_id) as num_raters
  from public.ratings r
  where r.cafe_id = p_cafe_id
    and r.user_id in (select public.visible_user_ids());
end;
$$;

--------------------------------------------------------------------------------
-- get_activity_feed: cursor-paginated feed of recent ratings
--------------------------------------------------------------------------------
create or replace function public.get_activity_feed(
  p_limit int default 20,
  p_cursor timestamptz default null
)
returns table (
  rating_id uuid,
  user_id uuid,
  display_name text,
  cafe_id uuid,
  cafe_name text,
  area text,
  rating numeric,
  visited_at date,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    r.id as rating_id,
    r.user_id,
    p.display_name,
    c.id as cafe_id,
    c.name as cafe_name,
    c.area,
    r.rating,
    r.visited_at,
    r.created_at
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  join public.cafes c on c.id = r.cafe_id
  where r.user_id in (select public.visible_user_ids())
    and (p_cursor is null or r.created_at < p_cursor)
  order by r.created_at desc
  limit least(coalesce(p_limit, 20), 100);
end;
$$;

--------------------------------------------------------------------------------
-- search_cafes: fuzzy search for cafe autocomplete
-- pg_trgm functions require extensions schema in search_path at definition time
--------------------------------------------------------------------------------
set search_path to public, extensions;

create or replace function public.search_cafes(query text, result_limit int default 10)
returns table (
  id uuid,
  name text,
  area text,
  lat double precision,
  lng double precision,
  similarity real
)
language plpgsql
stable
security definer
set search_path = 'public', 'extensions'
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  return query
  select
    c.id,
    c.name,
    c.area,
    c.lat,
    c.lng,
    public.similarity(c.name, query) as similarity
  from public.cafes c
  where c.name % query or c.name ilike '%' || query || '%'
  order by public.similarity(c.name, query) desc
  limit least(coalesce(result_limit, 10), 50);
end;
$$;
