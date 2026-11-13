-- =============================================================================
-- Migration 1: first database setup for the MNL client area
-- =============================================================================
-- Apply ONCE, by pasting this whole file into Supabase's SQL Editor and
-- pressing "Run". See supabase/README.md.
--
-- Everything runs inside one transaction (BEGIN ... COMMIT): if any line
-- fails, nothing at all is changed, and you can fix the problem and run the
-- whole file again.
--
-- Who is who:
--   anon           the website before anyone logs in. Gets NO access at all.
--   authenticated  any logged-in user (clients AND admins). Gets only the
--                  actions each table needs; the RLS policies below then
--                  decide which rows each person may touch.
--   postgres       you, in the SQL Editor. Owns the tables, so RLS does not
--                  apply to it.
--
-- "Automatically expose new tables" is OFF in this project, so a table is
-- invisible to the website until it gets an explicit GRANT. Every table below
-- has its GRANTs written out. "Automatic RLS" is ON, but every table still
-- switches RLS on explicitly.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. State codes
-- -----------------------------------------------------------------------------
-- A "domain" is a reusable column type with a rule attached. state_code only
-- accepts the 16 short codes the map already uses (src/estados/mapShapes.ts),
-- so a typo such as 'bayren' is refused by the database.
create domain public.state_code as text
  check (value in (
    'bw', -- Baden-Württemberg
    'by', -- Bayern
    'be', -- Berlin
    'bb', -- Brandenburg
    'hb', -- Bremen
    'hh', -- Hamburg
    'he', -- Hessen
    'mv', -- Mecklenburg-Vorpommern
    'ni', -- Niedersachsen
    'nw', -- Nordrhein-Westfalen
    'rp', -- Rheinland-Pfalz
    'sl', -- Saarland
    'sn', -- Sachsen
    'st', -- Sachsen-Anhalt
    'sh', -- Schleswig-Holstein
    'th'  -- Thüringen
  ));

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

-- routes: the ways to the Approbation (starts empty; admins add them).
-- "code" is permanent: it can't be changed after creation (no UPDATE grant on
-- it) and routes are never deleted, only archived.
create table public.routes (
  code        text primary key
              check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),  -- e.g. 'kp' or 'fsp-kp'
  name        text not null,                            -- Spanish name shown to users
  sort_order  integer not null default 0,
  archived    boolean not null default false
);
comment on table public.routes is
  'Routes to the Approbation. Code is permanent; retire with archived = true.';

-- profiles: one row per user, created automatically on invite (section 4).
-- id is the same ID as the login in auth.users. Deleting the login in
-- Supabase deletes the profile too ("on delete cascade").
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,               -- copy of the login email, kept in sync automatically
  full_name   text check (char_length(full_name) <= 200),
  main_state  public.state_code,  -- the state of the checklist; set by an admin
  route       text references public.routes (code),  -- set by an admin
  plan        text not null default 'free' check (plan in ('free', 'paid')),
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);
comment on table public.profiles is
  'One per user. Clients may only change full_name; everything else is admin-only.';

-- followed_states: the states a user follows for news. One row per state.
create table public.followed_states (
  user_id  uuid not null default auth.uid()
           references public.profiles (id) on delete cascade,
  state    public.state_code not null,
  primary key (user_id, state)    -- the same state can't be followed twice
);

-- checklist_items: the checklist content. Only paid users and admins can read it.
-- id:   automatic, permanent ID. Progress points to it. Can never be changed.
-- code: optional readable code for humans and spreadsheet imports
--       (e.g. 'by-kp-010'). Must be unique when filled in.
-- Items are NEVER deleted (nobody has delete permission); retire them with
-- archived = true.
create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  code        text unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  state       public.state_code not null,
  route       text not null references public.routes (code),
  title       text not null,
  body        text not null default '',
  sort_order  integer not null default 0,
  archived    boolean not null default false
);
comment on table public.checklist_items is
  'Never delete or reuse an id. Retire items with archived = true.';

-- progress: one row = one ticked item. Unticking deletes the row.
-- done_at is always set by the database (the website can't send it).
create table public.progress (
  user_id  uuid not null default auth.uid()
           references public.profiles (id) on delete cascade,
  item_id  uuid not null references public.checklist_items (id),
  done_at  timestamptz not null default now(),
  primary key (user_id, item_id)  -- an item can only be ticked once per user
);

-- news_posts: written by admins. state empty (NULL) = a post for all states.
-- paid_only starts as true, so a post is paid-only unless the admin unticks it.
create table public.news_posts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text not null default '',  -- plain text, never shown as HTML
  state         public.state_code,         -- NULL = all states
  published_at  timestamptz not null default now(),
  published     boolean not null default false,
  paid_only     boolean not null default true
);
comment on column public.news_posts.state is 'NULL means the post is for all states.';

-- -----------------------------------------------------------------------------
-- 3. Helper functions (in a "private" schema the website's API can't call)
-- -----------------------------------------------------------------------------
-- The Data API only exposes the "public" schema, so nothing in "private" can
-- be called from the browser directly. The RLS policies still use these
-- functions, so logged-in users need permission to run them.
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- "SECURITY DEFINER" means the function runs with its owner's rights instead
-- of the caller's. That lets it read profiles without going through the RLS
-- policies of profiles (which would call the function again, in a loop).
-- "set search_path = ''" fixes where the function looks up names, so nobody
-- can trick it by creating a look-alike table elsewhere. Every name inside is
-- therefore written in full (public.profiles, auth.uid()).

-- Is the logged-in user an admin?
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- Does the logged-in user have paid access (paid plan, or admin)?
create function private.has_paid_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin or p.plan = 'paid'
       from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

-- Trigger function: blocks non-admins from changing plan, is_admin,
-- main_state or route on a profile (also their own).
-- A "trigger" is code the database runs automatically on every change.
-- This one runs with the caller's rights (not SECURITY DEFINER), because it
-- needs to know who is making the change: the website ("authenticated") or
-- you in the SQL Editor ("postgres"), which is always allowed.
create function private.protect_profile_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not private.is_admin() then
    if new.plan       is distinct from old.plan
    or new.is_admin   is distinct from old.is_admin
    or new.main_state is distinct from old.main_state
    or new.route      is distinct from old.route then
      raise exception 'Only an admin can change plan, is_admin, main_state or route.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile_admin_fields
  before update on public.profiles
  for each row execute function private.protect_profile_admin_fields();

-- Trigger function: create a profile when a user is invited (a new row in
-- Supabase's own login table, auth.users).
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Trigger function: keep profiles.email in sync if a login email changes.
create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- Only logged-in users may run the two helpers used in the policies.
-- Nobody gets to call the trigger functions directly.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin()        to authenticated;
grant execute on function private.has_paid_access() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Switch on Row Level Security on every table
-- -----------------------------------------------------------------------------
alter table public.routes          enable row level security;
alter table public.profiles        enable row level security;
alter table public.followed_states enable row level security;
alter table public.checklist_items enable row level security;
alter table public.progress        enable row level security;
alter table public.news_posts      enable row level security;

-- -----------------------------------------------------------------------------
-- 5. Grants: which actions the website may use on each table at all
-- -----------------------------------------------------------------------------
-- Start from nothing, then give "authenticated" only what it needs.
-- Lists in brackets are column-level grants: only those columns can be
-- written. Columns not listed (like ids, email, done_at) can't be set from
-- the website at all.
revoke all on public.routes, public.profiles, public.followed_states,
              public.checklist_items, public.progress, public.news_posts
  from public, anon, authenticated;

grant select                                           on public.routes to authenticated;
grant insert (code, name, sort_order, archived)        on public.routes to authenticated;
grant update (name, sort_order, archived)              on public.routes to authenticated;

grant select                                                     on public.profiles to authenticated;
grant update (full_name, main_state, route, plan, is_admin)      on public.profiles to authenticated;
-- No insert (the trigger creates profiles) and no delete (delete the login
-- in Supabase instead, which removes the profile too).

grant select, delete              on public.followed_states to authenticated;
grant insert (user_id, state)     on public.followed_states to authenticated;

grant select on public.checklist_items to authenticated;
grant insert (code, state, route, title, body, sort_order, archived)
  on public.checklist_items to authenticated;
grant update (code, state, route, title, body, sort_order, archived)
  on public.checklist_items to authenticated;
-- No delete for anyone: retire items with archived = true.

grant select, delete              on public.progress to authenticated;
grant insert (user_id, item_id)   on public.progress to authenticated;
-- No update: a tick is either there or not.

grant select, delete on public.news_posts to authenticated;
grant insert (title, body, state, published_at, published, paid_only)
  on public.news_posts to authenticated;
grant update (title, body, state, published_at, published, paid_only)
  on public.news_posts to authenticated;

-- -----------------------------------------------------------------------------
-- 6. RLS policies: which rows each logged-in user may touch
-- -----------------------------------------------------------------------------
-- "using" filters which existing rows a user can see/change/delete.
-- "with check" decides which new or changed rows are allowed.
-- Writing "(select auth.uid())" instead of "auth.uid()" makes the database
-- work it out once per query instead of once per row.

-- routes: everyone logged in reads; only admins add or change.
create policy "routes: logged-in users read"
  on public.routes for select to authenticated
  using (true);
create policy "routes: admins add"
  on public.routes for insert to authenticated
  with check ((select private.is_admin()));
create policy "routes: admins change"
  on public.routes for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- profiles: own row, or admins see and change every row.
-- (The trigger above stops clients from changing plan, is_admin,
-- main_state and route, even on their own row.)
create policy "profiles: read own, admins read all"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));
create policy "profiles: change own, admins change all"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- followed_states: clients manage their own; admins can read all.
create policy "followed_states: read own, admins read all"
  on public.followed_states for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "followed_states: add own"
  on public.followed_states for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "followed_states: remove own"
  on public.followed_states for delete to authenticated
  using (user_id = (select auth.uid()));

-- checklist_items: paid users read non-archived items; admins read all and
-- are the only ones who add or change items.
create policy "checklist_items: paid users read active, admins read all"
  on public.checklist_items for select to authenticated
  using (
    (select private.is_admin())
    or ((select private.has_paid_access()) and not archived)
  );
create policy "checklist_items: admins add"
  on public.checklist_items for insert to authenticated
  with check ((select private.is_admin()));
create policy "checklist_items: admins change"
  on public.checklist_items for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- progress: users tick and untick their own items; admins can only read.
-- A user can only tick an item they are allowed to see (paid, not archived):
-- the check below looks the item up under the user's own rules.
create policy "progress: read own, admins read all"
  on public.progress for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "progress: tick own visible items"
  on public.progress for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.checklist_items i where i.id = item_id)
  );
create policy "progress: untick own"
  on public.progress for delete to authenticated
  using (user_id = (select auth.uid()));

-- news_posts: users see published posts whose date has come; paid_only posts
-- only for paid users. Admins see everything and are the only writers.
-- (Showing only the followed states is done by the website's query.)
create policy "news_posts: read published, admins read all"
  on public.news_posts for select to authenticated
  using (
    (select private.is_admin())
    or (
      published
      and published_at <= now()
      and (not paid_only or (select private.has_paid_access()))
    )
  );
create policy "news_posts: admins add"
  on public.news_posts for insert to authenticated
  with check ((select private.is_admin()));
create policy "news_posts: admins change"
  on public.news_posts for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "news_posts: admins delete"
  on public.news_posts for delete to authenticated
  using ((select private.is_admin()));

commit;
