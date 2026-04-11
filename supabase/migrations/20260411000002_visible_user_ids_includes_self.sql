-- Migration 005: visible_user_ids() always includes the caller
--
-- The original definition (migration 002) was a self-join on group_members
-- scoped to the caller's rows. For a user who is not yet in any group this
-- returns the empty set, which means:
--
--   * get_personalised_cafe_list excludes the user's own ratings
--   * get_cafe_personalised_average returns "no ratings from your groups yet"
--     even on cafes the user has rated themselves
--   * get_activity_feed hides the user's own ratings
--
-- None of this is a security issue -- the ratings RLS "View own ratings"
-- policy still lets the user select their own rows directly -- but the
-- personalised views are user-visible and the inconsistency is confusing
-- (see: rating a cafe, then seeing "No ratings from your groups yet" on the
-- very same page).
--
-- Fix: union in auth.uid() so the caller is always visible to themselves,
-- regardless of group membership. This does not change what the caller can
-- see of other users. For anonymous callers, auth.uid() is null and the
-- where-clause strips that row, so the function still returns the empty
-- set (matching the prior behaviour).

create or replace function public.visible_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid()
  where auth.uid() is not null
  union
  select distinct gm2.user_id
  from public.group_members gm1
  join public.group_members gm2 on gm1.group_id = gm2.group_id
  where gm1.user_id = auth.uid()
$$;
