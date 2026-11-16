-- =============================================================================
-- Migration 3: checklist for the client's own state and route; is_admin only
-- in the SQL Editor
-- =============================================================================
-- Apply ONCE, after migrations 1 and 2, by pasting this whole file into
-- Supabase's SQL Editor and pressing "Run". See supabase/README.md.
--
-- Like the earlier migrations, everything runs inside one transaction
-- (BEGIN ... COMMIT): if any line fails, nothing at all is changed.
--
-- What it changes (decisions of 16 Nov 2026):
--   1. checklist_items: a client only reads the active items for their own
--      state AND their own route. A client with no state or no route reads
--      none. Admins still read everything.
--      Ticking follows from this: the progress policy "progress: tick own
--      visible items" (migration 1) only lets a user tick an item they can
--      read, so it needs no change.
--   2. profiles.is_admin can no longer be changed through the website, by
--      anyone, admins included. It changes only here in the SQL Editor, by
--      user ID (see supabase/README.md).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Checklist: only the client's own state and route
-- -----------------------------------------------------------------------------
-- Helper: the logged-in user's own route (NULL if an admin hasn't set one).
-- Built exactly like private.my_state() in migration 2: it reads profiles with
-- its owner's rights (SECURITY DEFINER), so the checklist policy doesn't run
-- the profiles rules again for every item. It only ever returns the caller's
-- own route.
create function private.my_route()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.route from public.profiles p where p.id = (select auth.uid());
$$;

-- New functions can be run by everyone ("PUBLIC") unless that is taken away.
-- Only logged-in users may run my_route() (the checklist policy needs it).
revoke all on function private.my_route() from public, anon, authenticated;
grant execute on function private.my_route() to authenticated;

drop policy "checklist_items: paid users read active, admins read all"
  on public.checklist_items;

-- Clients see an item only if ALL of these are true:
--   - they have paid access
--   - the item is not archived
--   - they have a state, and the item is for that state
--   - they have a route, and the item is for that route
-- No state or no route = no items at all. Admins see everything (also
-- archived items, and every state and route).
-- (Policy names can be at most 63 characters, hence the short wording.)
create policy "checklist_items: paid read own state and route, admins read all"
  on public.checklist_items for select to authenticated
  using (
    (select private.is_admin())
    or (
      (select private.has_paid_access())
      and not archived
      and (select private.my_state()) is not null
      and state = (select private.my_state())
      and (select private.my_route()) is not null
      and route = (select private.my_route())
    )
  );

-- -----------------------------------------------------------------------------
-- 2. is_admin: only in the SQL Editor
-- -----------------------------------------------------------------------------
-- Migration 1 let the website write is_admin, and the trigger then allowed it
-- for admins. Now nobody may write it through the website. Admins keep
-- changing first_name, last_names, main_state, route and plan as before.
revoke update (is_admin) on public.profiles from authenticated;

-- Same trigger function as migration 2, with one change: is_admin is refused
-- for everyone who comes through the website (anon, authenticated), admins
-- included. This is a second lock: if a later change ever gave the website
-- the right to write is_admin again by mistake, this still stops it.
-- You in the SQL Editor (postgres) can still change it.
-- The other rules are unchanged: plan and route only by an admin; main_state
-- chosen once by the client while it is empty, after that only by an admin.
create or replace function private.protect_profile_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'is_admin can only be changed in the SQL Editor.'
        using errcode = 'insufficient_privilege';
    end if;
    if not private.is_admin() then
      if new.plan  is distinct from old.plan
      or new.route is distinct from old.route then
        raise exception 'Only an admin can change plan or route.'
          using errcode = 'insufficient_privilege';
      end if;
      -- main_state: allowed only from empty to a state.
      if new.main_state is distinct from old.main_state
         and not (old.main_state is null and new.main_state is not null) then
        raise exception 'The state can only be chosen once. Only an admin can change it.'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;
  return new;
end;
$$;

comment on table public.profiles is
  'One per user. Clients may change first_name and last_names, and set main_state '
  'once while it is empty. Admins change plan, route and main_state. is_admin is '
  'changed only in the SQL Editor.';

commit;
