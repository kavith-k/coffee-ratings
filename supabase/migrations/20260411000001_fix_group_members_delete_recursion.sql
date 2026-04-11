-- Migration 004: Fix infinite-recursion in the group_members DELETE policy.
--
-- The original "Admin or self can remove" policy in migration 002 used an
-- inline subquery on public.group_members inside its USING clause:
--
--   using (
--     user_id = auth.uid()
--     or group_id in (
--       select group_id from public.group_members gm
--       where gm.user_id = auth.uid() and gm.role = 'admin'
--     )
--   );
--
-- Postgres raises "infinite recursion detected in policy for relation
-- group_members" at runtime because the subquery re-queries the same table
-- whose policy is being evaluated, and there is no security-definer barrier
-- to stop the recursion. The matching SELECT policy already avoids this by
-- going through public.user_group_ids() (a `security definer` helper).
--
-- Fix: add an equivalent helper that returns admin-only group IDs and
-- rewrite the DELETE policy to reference it. This mirrors the existing
-- pattern and keeps the whole "all cross-table RLS lookups go through a
-- security-definer helper" invariant consistent.
--
-- No data changes, no schema changes -- just policy + new helper.

create or replace function public.admin_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select group_id
  from public.group_members
  where user_id = auth.uid() and role = 'admin'
$$;

drop policy if exists "Admin or self can remove" on public.group_members;

create policy "Admin or self can remove"
  on public.group_members for delete
  using (
    user_id = auth.uid()
    or group_id in (select public.admin_group_ids())
  );
