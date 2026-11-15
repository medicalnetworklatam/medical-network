-- =============================================================================
-- Migration 2: one state per user, news by state, names, community board
-- =============================================================================
-- Apply ONCE, after migration 1, by pasting this whole file into Supabase's
-- SQL Editor and pressing "Run". See supabase/README.md.
--
-- Like migration 1, everything runs inside one transaction (BEGIN ... COMMIT):
-- if any line fails, nothing at all is changed.
--
-- What it changes (decisions of 15 Nov 2026, see DECISIONS.md):
--   1. profiles: full_name is replaced by first_name and last_names.
--   2. profiles: a client may set main_state once, while it is still empty.
--   3. news_posts: clients only see news for their own state, plus "all
--      states" posts; a client with no state sees no news at all.
--   4. followed_states is removed (the website never used it).
--   5. community_posts: the new community board.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Names: first_name and last_names instead of full_name
-- -----------------------------------------------------------------------------
-- Latin American members usually have two surnames, so the board's
-- "María G." name needs to know which part is the surname. Guessing from one
-- full_name field gets it wrong too often.
alter table public.profiles
  add column first_name text check (char_length(first_name) <= 100),  -- nombre/s
  add column last_names text check (char_length(last_names) <= 100);  -- apellidos

-- Keep any name already saved: it moves into first_name (cut to 100
-- characters, the new limit; full_name allowed 200).
update public.profiles
   set first_name = left(full_name, 100)
 where full_name is not null;

-- Dropping the column also removes its grants.
alter table public.profiles drop column full_name;

-- Clients may change their own first_name and last_names, exactly like
-- full_name before. (The other columns keep their grants from migration 1.)
grant update (first_name, last_names) on public.profiles to authenticated;

comment on table public.profiles is
  'One per user. Clients may change first_name and last_names, and set main_state '
  'once while it is empty; everything else is admin-only.';

-- New logins: read first_name and last_names from the invite's extra data
-- ("metadata") instead of full_name. Same function name, so the trigger from
-- migration 1 keeps using it.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, first_name, last_names)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_names', '')
  );
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. main_state: a client may set it once, while it is empty
-- -----------------------------------------------------------------------------
-- Same trigger function as migration 1, with one change: a non-admin may now
-- change main_state from empty (NULL) to a state. Once it is set, only an
-- admin (or you in the SQL Editor) can change or clear it. This stops one
-- payment from unlocking all 16 states. The 16-codes rule on the column
-- already refuses anything that isn't a real state.
create or replace function private.protect_profile_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not private.is_admin() then
    if new.plan     is distinct from old.plan
    or new.is_admin is distinct from old.is_admin
    or new.route    is distinct from old.route then
      raise exception 'Only an admin can change plan, is_admin or route.'
        using errcode = 'insufficient_privilege';
    end if;
    -- main_state: allowed only from empty to a state.
    if new.main_state is distinct from old.main_state
       and not (old.main_state is null and new.main_state is not null) then
      raise exception 'The state can only be chosen once. Only an admin can change it.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. News: only the client's own state (and "all states" if they have one)
-- -----------------------------------------------------------------------------
-- Helper: the logged-in user's own main_state (NULL if not chosen yet).
-- Same settings as has_paid_access() in migration 1: it reads profiles with
-- its owner's rights, so the news policy doesn't run the profiles rules
-- again for every news row. It only ever returns the caller's own state.
create function private.my_state()
returns public.state_code
language sql
stable
security definer
set search_path = ''
as $$
  select p.main_state from public.profiles p where p.id = (select auth.uid());
$$;

drop policy "news_posts: read published, admins read all" on public.news_posts;

-- Clients see a post only if ALL of these are true:
--   - it is published and its date has come
--   - it is free, or the client has paid access
--   - the client has chosen a state, and the post is for that state or for
--     all states (state empty). No state chosen = no news at all.
-- Admins see everything.
create policy "news_posts: read own state's published posts, admins read all"
  on public.news_posts for select to authenticated
  using (
    (select private.is_admin())
    or (
      published
      and published_at <= now()
      and (not paid_only or (select private.has_paid_access()))
      and (select private.my_state()) is not null
      and (state is null or state = (select private.my_state()))
    )
  );

-- -----------------------------------------------------------------------------
-- 4. Remove followed_states
-- -----------------------------------------------------------------------------
-- Replaced by the one main_state per user. Dropping the table also removes
-- its policies and grants. (No "cascade": if anything unexpected still used
-- the table, this stops with an error instead of removing that too.)
drop table public.followed_states;

-- -----------------------------------------------------------------------------
-- 5. Community board
-- -----------------------------------------------------------------------------
-- One board for all paid members, text only. The website only ever sends the
-- body; the trigger below fills in the author, their display name and the
-- date. Nobody can edit a post (no UPDATE grant). Deleting a login deletes
-- its profile and, with it, its posts ("on delete cascade").
create table public.community_posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles (id) on delete cascade,
  author_name  text not null,               -- e.g. 'María G.', fixed at posting time
  body         text not null                -- plain text, never shown as HTML
               check (body = btrim(body, E' \t\r\n')
                      and char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now()
);
comment on table public.community_posts is
  'Community board. author_id, author_name and created_at are set by the database.';
comment on column public.community_posts.author_name is
  'First word of first_name + initial of last_names, at posting time. Never email or full name.';

-- Newest posts first.
create index community_posts_created_at_idx
  on public.community_posts (created_at desc);

-- Trigger function: runs before every new post.
--   - trims spaces and line breaks at both ends of the body, so a post of
--     only spaces becomes empty and is refused by the check above
--   - author_id  = the logged-in user
--   - created_at = now
--   - author_name from the author's profile:
--       first word of first_name + " " + first letter of last_names + "."
--       ('María Fernanda' + 'García López' -> 'María G.')
--       no last_names  -> just the first word of first_name ('María')
--       no first_name  -> 'Miembro'
-- It runs with the caller's rights (not SECURITY DEFINER): it only reads the
-- author's own profile, which they are allowed to read anyway.
create function private.set_community_post_author()
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
  new.author_name := case
    when first_word is null then 'Miembro'
    when initial    is null then first_word
    else first_word || ' ' || initial || '.'
  end;
  return new;
end;
$$;

create trigger set_community_post_author
  before insert on public.community_posts
  for each row execute function private.set_community_post_author();

alter table public.community_posts enable row level security;

-- Grants: read, post (only the body can be sent) and delete. No update.
-- Nothing at all for logged-out visitors.
revoke all on public.community_posts from public, anon, authenticated;
grant select, delete    on public.community_posts to authenticated;
grant insert (body)     on public.community_posts to authenticated;

-- Read: paid members and admins (has_paid_access() includes admins).
create policy "community_posts: paid members read"
  on public.community_posts for select to authenticated
  using ((select private.has_paid_access()));
-- Post: paid members and admins, always as themselves.
create policy "community_posts: paid members post as themselves"
  on public.community_posts for insert to authenticated
  with check (
    (select private.has_paid_access())
    and author_id = (select auth.uid())
  );
-- Delete: your own posts; admins delete any post.
create policy "community_posts: delete own, admins delete any"
  on public.community_posts for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));

-- -----------------------------------------------------------------------------
-- 6. Who may run the new functions
-- -----------------------------------------------------------------------------
-- New functions can be run by everyone ("PUBLIC") unless that is taken away;
-- migration 1's revoke only covered the functions that existed then.
-- Only logged-in users may run my_state() (the news policy needs it).
-- Nobody may call the trigger function directly.
revoke all on function private.my_state()                  from public, anon, authenticated;
revoke all on function private.set_community_post_author() from public, anon, authenticated;
grant execute on function private.my_state() to authenticated;

commit;
