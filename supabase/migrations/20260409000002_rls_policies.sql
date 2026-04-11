-- Migration 002: RLS policies and visible_user_ids() helper
-- All authorisation happens at the database level.

--------------------------------------------------------------------------------
-- Core helper: returns group IDs the current user belongs to
-- Security definer to bypass RLS on group_members (avoids circular policies)
--------------------------------------------------------------------------------
create or replace function public.user_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select group_id
  from public.group_members
  where user_id = auth.uid()
$$;

--------------------------------------------------------------------------------
-- Core helper: returns all user IDs who share at least one group with caller
--------------------------------------------------------------------------------
create or replace function public.visible_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct gm2.user_id
  from public.group_members gm1
  join public.group_members gm2 on gm1.group_id = gm2.group_id
  where gm1.user_id = auth.uid()
$$;

--------------------------------------------------------------------------------
-- profiles policies
--------------------------------------------------------------------------------
create policy "View own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "View connected profiles"
  on public.profiles for select
  using (id in (select public.visible_user_ids()));

create policy "Update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

--------------------------------------------------------------------------------
-- groups policies
--
-- NOTE: there is deliberately no INSERT policy on `groups`. Group creation goes
-- through the `create_group()` SECURITY DEFINER RPC, which atomically inserts
-- the group row AND the creator's admin membership. Allowing direct inserts
-- would let a client create a group without an accompanying membership row
-- (orphaned group), or create the group without also becoming admin.
--------------------------------------------------------------------------------
create policy "Members can view their groups"
  on public.groups for select
  using (id in (select public.user_group_ids()));

create policy "Admin can update group"
  on public.groups for update
  using (id in (
    select group_id from public.group_members
    where user_id = auth.uid() and role = 'admin'
  ))
  with check (id in (
    select group_id from public.group_members
    where user_id = auth.uid() and role = 'admin'
  ));

create policy "Admin can delete group"
  on public.groups for delete
  using (id in (
    select group_id from public.group_members
    where user_id = auth.uid() and role = 'admin'
  ));

--------------------------------------------------------------------------------
-- group_members policies
--
-- NOTE: there is deliberately no INSERT policy on `group_members`. All joins
-- go through SECURITY DEFINER RPCs:
--   * `create_group()` inserts the creator as admin when a group is first made
--   * `join_group_by_invite_code()` inserts a new member after verifying the
--     caller knows the group's invite code
-- Allowing a direct insert policy like `user_id = auth.uid()` would let any
-- authenticated user join any group whose UUID they happen to learn, bypassing
-- the invite-code requirement entirely.
--------------------------------------------------------------------------------
create policy "View fellow group members"
  on public.group_members for select
  using (group_id in (select public.user_group_ids()));

create policy "Admin or self can remove"
  on public.group_members for delete
  using (
    user_id = auth.uid()
    or group_id in (
      select group_id from public.group_members gm
      where gm.user_id = auth.uid() and gm.role = 'admin'
    )
  );

--------------------------------------------------------------------------------
-- cafes policies
--------------------------------------------------------------------------------
create policy "Authenticated users can view cafes"
  on public.cafes for select
  using (auth.uid() is not null);

create policy "Authenticated users can add cafes"
  on public.cafes for insert
  with check (auth.uid() is not null and auth.uid() = created_by);

--------------------------------------------------------------------------------
-- ratings policies
--------------------------------------------------------------------------------
create policy "View own ratings"
  on public.ratings for select
  using (user_id = auth.uid());

create policy "View connected users ratings"
  on public.ratings for select
  using (user_id in (select public.visible_user_ids()));

create policy "Insert own ratings"
  on public.ratings for insert
  with check (user_id = auth.uid());

create policy "Update own ratings"
  on public.ratings for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Delete own ratings"
  on public.ratings for delete
  using (user_id = auth.uid());
