-- =============================================================================
-- Migration 4: chat per Bundesland, "Equipo MNL" label, posting speed limit
-- =============================================================================
-- Apply ONCE, after migrations 1, 2 and 3, by pasting this whole file into
-- Supabase's SQL Editor and pressing "Run". See supabase/README.md.
--
-- Like the earlier migrations, everything runs inside one transaction
-- (BEGIN ... COMMIT): if any line fails, nothing at all is changed.
--
-- What it changes (decisions of 17 Nov 2026, see DECISIONS.md "State chat"):
--   1. community_posts gets a "state" field. Empty = the general board; a
--      state code = that state's chat. Same table, same rules for names,
--      length and deleting.
--   2. community_posts gets an "is_staff" field ("Equipo MNL"): true when the
--      author was an admin at posting time. Only the database sets it.
--   3. Reading: paid members read the board plus their own state's chat.
--      Admins read everything. Free members read nothing, as before.
--   4. Posting: the website may send only the text and the state. A member
--      posts to the board or to their own state's chat; admins to any.
--   5. Speed limit: at most 5 posts a minute and 100 in 24 hours per member,
--      board and chats together. Admins are exempt.
--   6. Supabase's own public.rls_auto_enable() can no longer be run by the
--      website's roles.
--
-- The site that is live before this migration keeps working: it only sends
-- the text (so its posts go to the board) and reads the columns it knows.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. New fields: state and is_staff
-- -----------------------------------------------------------------------------
-- state uses the same 16-codes rule as everywhere else (public.state_code,
-- migration 1), so anything that isn't a real state is refused. Every post
-- that already exists keeps an empty state: it stays on the board.
alter table public.community_posts
  add column state     public.state_code,                 -- NULL = the general board
  add column is_staff  boolean not null default false;    -- true = "Equipo MNL"

comment on table public.community_posts is
  'Community board (state empty) and the chat of each Bundesland (state filled in). '
  'author_id, author_name, is_staff and created_at are set by the database.';
comment on column public.community_posts.state is
  'NULL means the general board. A state code means that state''s chat.';
comment on column public.community_posts.is_staff is
  'True when the author was an admin at posting time ("Equipo MNL"). Set by the database only.';

-- Posts written before this migration: mark the ones whose author is an admin
-- today, so the label is the same on old and new posts.
update public.community_posts p
   set is_staff = true
  from public.profiles pr
 where pr.id = p.author_id
   and pr.is_admin;

-- An "index" is a sorted lookup list that lets the database find rows
-- without reading the whole table.
-- This one serves "the posts of one state (or of the board), newest first":
-- the same order the website asks for (created_at, then id for posts with the
-- very same time).
create index community_posts_state_created_at_idx
  on public.community_posts (state, created_at desc, id desc);

-- This one serves the speed limit in section 4: "this author's posts in the
-- last minute / the last 24 hours".
create index community_posts_author_created_at_idx
  on public.community_posts (author_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 2. "Equipo MNL": the database marks posts written by an admin
-- -----------------------------------------------------------------------------
-- Same trigger function as migration 2, with one added line: is_staff is set
-- to "is the author an admin right now?". Whatever arrives in is_staff is
-- overwritten, and the website has no right to send it anyway (section 3), so
-- a member can't pass themselves off as staff.
-- The state is left exactly as it was sent: the posting rule in section 3
-- decides whether that state is allowed.
create or replace function private.set_community_post_author()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  first_word  text;
  initial     text;
begin
  select substring(coalesce(p.first_name, '') from '\S+'),  -- first word
         upper(substring(coalesce(p.last_names, '') from '\S'))  -- first letter
    into first_word, initial
    from public.profiles p
   where p.id = (select auth.uid());

  new.body       := btrim(new.body, E' \t\r\n');
  new.author_id  := (select auth.uid());
  new.created_at := now();
  new.is_staff   := private.is_admin();
  new.author_name := case
    when first_word is null then 'Miembro'
    when initial    is null then first_word
    else first_word || ' ' || initial || '.'
  end;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Who reads and who posts
-- -----------------------------------------------------------------------------
-- Grants: the website may now send the state as well as the body. Nothing
-- else: not is_staff, not the author, not the name, not the date.
grant insert (state) on public.community_posts to authenticated;

drop policy "community_posts: paid members read" on public.community_posts;

-- A member sees a post only if ALL of these are true:
--   - they have paid access
--   - the post is on the board (state empty), or they have a state and the
--     post is for that state
-- A paid member with no state sees only the board. Free members see nothing.
-- Admins see everything: the board and all 16 chats.
create policy "community_posts: paid read board and own state, admins read all"
  on public.community_posts for select to authenticated
  using (
    (select private.is_admin())
    or (
      (select private.has_paid_access())
      and (
        state is null
        or (
          (select private.my_state()) is not null
          and state = (select private.my_state())
        )
      )
    )
  );

drop policy "community_posts: paid members post as themselves" on public.community_posts;

-- Post: paid members and admins, always as themselves.
--   - a member: to the board (state empty), or to their own state's chat if
--     they have a state. Nothing else.
--   - an admin: to the board or to any state's chat.
create policy "community_posts: paid post to board or own state, admins to any"
  on public.community_posts for insert to authenticated
  with check (
    (select private.has_paid_access())
    and author_id = (select auth.uid())
    and (
      (select private.is_admin())
      or state is null
      or (
        (select private.my_state()) is not null
        and state = (select private.my_state())
      )
    )
  );

-- Deleting is unchanged (migration 2): your own posts; admins delete any.

-- -----------------------------------------------------------------------------
-- 4. Speed limit: 5 posts a minute, 100 in 24 hours
-- -----------------------------------------------------------------------------
-- A second trigger function, run before every new post, on the board and in
-- the chats alike. It counts the posts the author already has from the last
-- minute and from the last 24 hours, and refuses the new one when either
-- limit is reached. Admins are exempt.
--
-- "SECURITY DEFINER" (it runs with its owner's rights) is needed here: the
-- count must include ALL of the author's own posts, also ones the reading
-- rule above no longer shows them, such as posts in their old state's chat
-- after an admin moved them to another state. It takes no user ID: it only
-- ever counts the posts of the person who is posting.
--
-- The "lock" line makes two posts sent by the same person at the same
-- instant wait for each other, so they can't both be counted as "the 5th".
-- It is released by itself when the post is saved or refused.
--
-- The error has its own code, 'PT429'. Supabase's API turns a code of the
-- form 'PTxyz' into the HTTP answer xyz, here "429 Too Many Requests", and
-- the website (src/lib/dataErrors.ts) turns that code into Spanish.
create function private.limit_community_post_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  me         uuid := (select auth.uid());
  in_minute  bigint;
  in_day     bigint;
begin
  -- Nobody logged in (you in the SQL Editor) or an admin: no limit.
  if me is null or private.is_admin() then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('community_posts:' || me::text, 0));

  select count(*) filter (where p.created_at > now() - interval '1 minute'),
         count(*)
    into in_minute, in_day
    from public.community_posts p
   where p.author_id = me
     and p.created_at > now() - interval '24 hours';

  if in_minute >= 5 or in_day >= 100 then
    raise exception 'Too many posts: at most 5 a minute and 100 in 24 hours.'
      using errcode = 'PT429';
  end if;
  return new;
end;
$$;

-- Triggers on the same table run in alphabetical order, so this one
-- ("limit...") runs before "set_community_post_author".
create trigger limit_community_post_rate
  before insert on public.community_posts
  for each row execute function private.limit_community_post_rate();

-- New functions can be run by everyone ("PUBLIC") unless that is taken away.
-- Nobody may call the trigger function directly.
revoke all on function private.limit_community_post_rate() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Supabase's rls_auto_enable(): no execute for the website's roles
-- -----------------------------------------------------------------------------
-- "Automatic RLS" is a Supabase setting that switches Row Level Security on
-- for every new table. Supabase does it with its own function,
-- public.rls_auto_enable(), which the database runs by itself whenever a
-- table is created. Like every new function, it could be run by everyone,
-- which the Security Advisor warns about. The website never needs to run it,
-- and the database doesn't need this right to run it by itself.
-- The "if" makes this step do nothing where the function doesn't exist (the
-- local test database, or a project with "Automatic RLS" off).
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

commit;
