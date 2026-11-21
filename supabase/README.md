# Database setup (Supabase)

This folder holds the database for the client area, as plain SQL files. You
apply them by hand in Supabase's **SQL Editor**. Nothing here needs a key,
and Claude Code never connects to Supabase.

| File | What it is |
|---|---|
| `migrations/20261113120000_initial_schema.sql` | **Migration 1.** Creates the tables, switches on Row Level Security, and adds the access rules and the automatic profile. Run it **once**. Applied 14 Nov 2026. |
| `migrations/20261115120000_one_state_news_community.sql` | **Migration 2.** One state per user, news by state, first name and last names instead of one name field, and the community board. Removes `followed_states`. Run it **once**, after migration 1. |
| `migrations/20261116120000_checklist_own_state_route.sql` | **Migration 3.** Clients only read and tick the checklist for their own state and route. `is_admin` is changed only in the SQL Editor. Run it **once**, after migration 2. |
| `migrations/20261117120000_state_chat.sql` | **Migration 4.** The chat per Bundesland (a `state` field on `community_posts`), the "Equipo MNL" mark on admin posts, the posting speed limit, and no execute rights on Supabase's `rls_auto_enable()` for the website. Run it **once**, after migration 3. |
| `migrations/20261118120000_news_attachments.sql` | **Migration 5.** Photos and PDFs in Novedades posts: the table `news_attachments` and the private storage bucket `news-files`, with their rules. Run it **once**, after migration 4. |
| `migrations/20261118180000_news_thumbnails.sql` | **Migration 6.** Small copies of the photos in Novedades posts (`news_attachments.thumb_path`), readable exactly when their photo is. Run it **once**, after migration 5. |
| `migrations/20261120120000_checklist_templates.sql` | **Migration 7.** The checklist built from the owner's templates: the four routes, new step fields on `checklist_items`, and the tables `checklist_templates`, `client_item_settings` (the client layer), `client_details` and `client_dudas` ("Mis dudas"), with their rules. Run it **once**, after migration 6. |
| `content/` | **Checklist templates as SQL.** One file per Bundesland + route (e.g. `content/bw-medico_drittstaat.sql`), made by `npm run checklist-sql` from the owner's JSON in `content/checklists/`. Safe to run again (see section 10). Never edit these by hand. |
| `tests/rls_check.sql` | **The RLS test.** Proves that clients can't see or change each other's data and that admins can do their job. Run it as often as you like. |
| `templates/` | **Login emails and settings.** The Spanish invite and reset-password emails, plus the guide (`templates/README.md`) to the URL, password and email settings that logins need. |

A **migration** is one SQL file that changes the database one step forward.
They're numbered by date and time, and you apply them in that order. Once a
migration has been applied, never edit it. Any later change goes in a new
file with a newer date.

---

## 1. Apply migration 1 (once)

1. Open the Supabase dashboard and pick the project **mnl-client-area**.
2. In the left menu, open **SQL Editor**, then click **New query**.
3. In the repository, open
   `supabase/migrations/20261113120000_initial_schema.sql` and copy **all**
   of it. On GitHub, the "Copy raw file" button does this.
4. Paste it into the editor and click **Run**.
5. You should see **"Success. No rows returned"**.

If Supabase shows a warning about the query before running it, read it, and
then confirm to run it. The migration doesn't delete anything.

**If you get an error:** nothing was changed, because the whole file runs as
one unit: either everything is applied, or nothing is. Copy the error
message and send it to me. If the error says something **"already exists"**,
the migration was already applied before. Don't run it again.

**Check:** open **Table Editor**. You should see 6 tables: `checklist_items`,
`followed_states`, `news_posts`, `profiles`, `progress` and `routes`. None
of them should be marked "RLS disabled" / "Unrestricted".

## 2. Apply migration 2 (once)

Migration 2 makes these changes:
- `profiles`: `full_name` is replaced by `first_name` (nombre/s) and
  `last_names` (apellidos). A name already saved in `full_name` is moved into
  `first_name`; fix it by hand afterwards if needed (see "Handy SQL" below).
- A client may choose their state (`main_state`) **once**, while it is empty.
  After that, only an admin can change or clear it.
- News: clients only see posts for their own state, plus "all states" posts.
  A client with no state sees **no news at all**.
- `followed_states` is removed. The website never used it.
- New table `community_posts`: the community board.

Steps:
1. SQL Editor → **New query**.
2. Open `supabase/migrations/20261115120000_one_state_news_community.sql`
   and copy **all** of it ("Copy raw file" on GitHub).
3. Paste it and click **Run**. Supabase warns that the query deletes
   something (the `followed_states` table and the `full_name` column). That's
   expected, so confirm.
4. You should see **"Success. No rows returned"**.

**If you get an error:** nothing was changed (the whole file runs as one
unit). Send me the message. If it says something **"already exists"** or
**"column full_name does not exist"**, migration 2 was already applied. Don't
run it again.

**Check:** open **Table Editor**. You should see 6 tables: `checklist_items`,
`community_posts`, `news_posts`, `profiles`, `progress` and `routes`
(`followed_states` is gone). None of them should be marked "RLS disabled" /
"Unrestricted". `profiles` has the columns `first_name` and `last_names`
and no `full_name`.

Then **run the RLS test again** (section 9). It should still end with
`ALL RLS TESTS PASSED`.

## 3. Apply migration 3 (once)

Migration 3 makes these changes:
- **Checklist:** a client only reads the active items for their own state
  **and** their own route. A client with no state or no route sees no items.
  Ticking follows the same rule, because a client can only tick an item they
  can read. Admins still read every item.
- **`is_admin`:** it can no longer be changed through the website, by
  anyone, admins included. It changes only here in the SQL Editor, by user ID
  (see section 8). Admins keep changing plan, state and route from the admin
  screens.
- A new private helper, `my_route()`, gives the checklist rule the user's own
  route (like `my_state()` does for news).

Steps:
1. SQL Editor → **New query**.
2. Open `supabase/migrations/20261116120000_checklist_own_state_route.sql`
   and copy **all** of it ("Copy raw file" on GitHub).
3. Paste it and click **Run**. Supabase may warn that the query is
   destructive, because it removes the old checklist rule before adding the
   new one. No data is deleted, so confirm.
4. You should see **"Success. No rows returned"**.

**If you get an error:** nothing was changed (the whole file runs as one
unit). Send me the message. If it says something **"already exists"**,
migration 3 was already applied. Don't run it again.

Then **run the RLS test** (section 9), with the newest `tests/rls_check.sql`
from the repository. It should end with `ALL RLS TESTS PASSED`.

**Before real clients use the checklist:** every paid client needs both a
state and a route, or their checklist is empty.

## 4. Apply migration 4 (once)

Migration 4 makes these changes:
- **State chat:** `community_posts` gets a `state` field. Empty = the general
  board; a state code = that state's chat. Posts that already exist stay on
  the board.
- **Reading:** paid members read the board plus their own state's chat, and
  only if they have a state. Admins read everything. Free members read
  nothing, as before.
- **Posting:** the website may send only the text and the state. A member
  posts to the board or to their own state's chat; admins to any.
- **"Equipo MNL":** a new field, `is_staff`, set only by the database: true
  when the author is an admin at posting time. Old posts by today's admins
  are marked too.
- **Speed limit:** at most 5 posts a minute and 100 in 24 hours per member,
  board and chats together. Admins are exempt. A refused post gets the
  error code `PT429`, which the website shows in Spanish.
- **`rls_auto_enable()`:** Supabase's own function behind the "Automatic RLS"
  setting can no longer be run by the website's roles. The database still
  runs it by itself for every new table.

The site that is live before this migration keeps working with it, so apply
the migration **before** merging the website change.

Steps:
1. SQL Editor → **New query**.
2. Open `supabase/migrations/20261117120000_state_chat.sql` and copy **all**
   of it ("Copy raw file" on GitHub).
3. Paste it and click **Run**. Supabase may warn that the query is
   destructive, because it removes the two old community rules before adding
   the new ones. No data is deleted, so confirm.
4. You should see **"Success. No rows returned"**.

**If you get an error:** nothing was changed (the whole file runs as one
unit). Send me the message. If it says something **"already exists"**,
migration 4 was already applied. Don't run it again.

**Check that "Automatic RLS" still works** (after the migration). Paste this
into a new query and run it. It creates a test table, notes whether Row Level
Security was switched on for it, and undoes the table again inside the same
block, so nothing is left behind:

```sql
-- Check: does "Automatic RLS" still switch Row Level Security on for a new
-- table? Safe to run: the test table is undone inside the block, so nothing
-- is left behind. Read the one result row at the end.
do $check$
declare
  was_on boolean;
begin
  begin
    create table public.zz_rls_auto_check (id integer);
    select c.relrowsecurity into was_on
      from pg_class c
     where c.oid = 'public.zz_rls_auto_check'::regclass;
    raise exception 'undo the test table' using errcode = 'ZZ001';
  exception when sqlstate 'ZZ001' then
    null;  -- the error above undid the "create table"; was_on keeps its value
  end;
  perform set_config('mnl.rls_auto_check', coalesce(was_on::text, 'unknown'), false);
end;
$check$;

select current_setting('mnl.rls_auto_check', true)              as rls_was_on,
       to_regclass('public.zz_rls_auto_check') is not null      as left_behind,
       not has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
         and not has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')
                                                                 as website_cannot_run_it;
```

The one result row must say `rls_was_on` = **true**, `left_behind` =
**false** and `website_cannot_run_it` = **true**. If any of the three is
different, send me the row.

Then **run the RLS test** (section 9), with the newest `tests/rls_check.sql`
from the repository. It should end with `ALL RLS TESTS PASSED`.

## 5. Apply migration 5 (once)

Migration 5 makes these changes:
- **New table `news_attachments`:** one row per photo or PDF of a news
  post: the post, the kind (`image` or `pdf`), the file's path in storage,
  its original name (plain text, shown for PDFs) and, for photos, an
  optional description (the alt text). Deleting a post deletes its rows.
- **New storage bucket `news-files`** (a bucket is a folder in Supabase
  Storage): private, at most 10 MB per file, only JPEG, PNG, WebP and PDF.
  Each file's path is `<post id>/<random uuid>.<ending>`.
- **Who sees a file:** a client reads a file only when it has a
  `news_attachments` row and they can see that row's post (same state,
  paid-only and publish-date rules as the news). A file without a row is
  invisible to clients, also when listing a folder. Admins read every file
  in the bucket.
- **Who writes:** only admins add, change or delete rows and files.

The site that is live before this migration keeps working with it, so apply
the migration **before** merging the website change.

Steps:
1. SQL Editor → **New query**.
2. Open `supabase/migrations/20261118120000_news_attachments.sql` and copy
   **all** of it ("Copy raw file" on GitHub).
3. Paste it and click **Run**. Nothing is deleted, so if Supabase warns
   about the query, read the warning and confirm.
4. You should see **"Success. No rows returned"**.

**If you get an error:** nothing was changed (the whole file runs as one
unit, the storage part included). Send me the message. If it says something
**"already exists"**, migration 5 was already applied. Don't run it again.

Then **run the RLS test** (section 9), with the newest `tests/rls_check.sql`
from the repository. It should end with `ALL RLS TESTS PASSED`.

**Check the bucket and the rules** with these three queries (each in a new
query, or all three one after another):

```sql
-- 1. The bucket: one row
select id, public, file_size_limit, allowed_mime_types
  from storage.buckets
 where id = 'news-files';
```

Expected: `news-files` | `false` | `10485760` |
`{image/jpeg,image/png,image/webp,application/pdf}`.

```sql
-- 2. The four rules on stored files
select policyname, cmd, roles
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname like 'news-files:%'
 order by policyname;
```

Expected, four rows, each with `roles` = `{authenticated}`:
`news-files: admins delete` (DELETE), `news-files: admins update` (UPDATE),
`news-files: admins upload` (INSERT),
`news-files: read attached files, admins read all` (SELECT).

```sql
-- 3. Row Level Security is on for storage.objects and news_attachments
select c.oid::regclass as table_name, c.relrowsecurity as rls_on
  from pg_class c
 where c.oid in ('storage.objects'::regclass, 'public.news_attachments'::regclass);
```

Expected: two rows, both with `rls_on` = `true`.

## 6. Apply migration 6 (once)

Migration 6 makes these changes:
- **New column `news_attachments.thumb_path`:** where a photo's **small
  copy** is stored (about 480 px, JPEG). The admin form makes it by itself
  when a photo is uploaded; the Novedades list shows it in each post's
  preview tiles, so the list never loads the full photos. It may be empty:
  PDFs never have one, and photos uploaded before this migration have none
  (they show a "Foto" tile).
- **Its rule:** a small copy belongs only to a photo, sits in its own
  post's folder as `<post id>/<random uuid>.jpg` (lowercase), is never the
  photo itself, and no two rows share one. It can be set when a row is
  added, never changed afterwards.
- **Who sees a small copy:** the read rule on stored files is changed (same
  name) so a client reads a file when a row they can see has it as its
  photo or PDF (`path`) **or** as its small copy (`thumb_path`). So a small
  copy is visible exactly when its photo is. Admins still read every file.
  Upload, change and delete rules stay as they are.

The site that is live before this migration keeps working with it, but the
**new** site asks for `thumb_path`, so apply the migration **before** merging
the website change.

Steps:
1. SQL Editor → **New query**.
2. Open `supabase/migrations/20261118180000_news_thumbnails.sql` and copy
   **all** of it ("Copy raw file" on GitHub).
3. Paste it and click **Run**.
4. You should see **"Success. No rows returned"**.

**If you get an error:** nothing was changed (the whole file runs as one
unit). Send me the message. If it says **"column "thumb_path" of relation
"news_attachments" already exists"**, migration 6 was already applied.
Don't run it again.

Then **run the RLS test** (section 9), with the newest `tests/rls_check.sql`
from the repository. It should end with `ALL RLS TESTS PASSED`.

**Check the change** with these four queries (each in a new query, or all
four one after another):

```sql
-- 1. The new column
select column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public' and table_name = 'news_attachments'
   and column_name = 'thumb_path';
```

Expected: one row, `thumb_path` | `text` | `YES`.

```sql
-- 2. Its two rules (the format check, and "no two rows share one")
select conname
  from pg_constraint
 where conrelid = 'public.news_attachments'::regclass
   and conname like '%thumb_path%'
 order by conname;
```

Expected, two rows: `news_attachments_thumb_path_format` and
`news_attachments_thumb_path_key`.

```sql
-- 3. The website may send it when adding a row, never change it
select has_column_privilege('authenticated', 'public.news_attachments', 'thumb_path', 'INSERT') as can_add,
       has_column_privilege('authenticated', 'public.news_attachments', 'thumb_path', 'UPDATE') as can_change;
```

Expected: `can_add` = `true`, `can_change` = `false`.

```sql
-- 4. The read rule on stored files now knows the small copies
select policyname, qual like '%thumb_path%' as reads_small_copies
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'news-files: read attached files, admins read all';
```

Expected: one row, with `reads_small_copies` = `true`.

## 7. Apply migration 7 (once)

Migration 7 makes these changes (decisions of 20 Nov 2026, see DECISIONS.md):
- **Codes may contain `_`** as well as `-`, for routes and checklist items
  (the owner's route keys, e.g. `medico_drittstaat`, and step codes, e.g.
  `bw_via`, need it). Every code allowed before is still allowed.
- **The four routes** are added, with these permanent codes:
  `medico_drittstaat`, `medico_ue`, `dentista_drittstaat`, `dentista_ue`.
- **`checklist_items` gets the template's step fields:** `block` (1–5),
  `official_number` (display text, e.g. "6", "pág. 4", "—"), `sobre_order`
  (its place in the envelope, empty when it isn't in it), `donde`,
  `plazo`, `aviso`, `caduca`, `na_default` ("no aplica" by default),
  `na_reason` and `source_code` (the owner's code, e.g. `bw8`). When
  `source_code` is filled in, the readable `code` must be
  `<state>-<route>-<source_code>`, e.g. `bw-medico_drittstaat-bw8`. Clients
  read these fields under the existing rule (paid, their own state and
  route, not archived); only admins write them.
- **New table `checklist_templates`:** one row per Bundesland + route with
  the template's name, the block titles, the cover texts and the info
  cards. Same read rule as the checklist items. Admins write; nobody
  deletes.
- **New table `client_item_settings`, the client layer:** per client and
  step, `applies` (true = "aplica", false = "no aplica", empty = the
  template's default), a `reason` (up to 500 characters) and a personal
  `note` (up to 2,000). Admins write. A paid client reads only their own
  rows, and only for steps they can read.
- **New table `client_details`:** the client's `country` (fills `{pais}`)
  and an optional `header_line`. Admins write; a paid client reads their
  own. (Not in `profiles`, because clients may change their own profile
  row.)
- **New table `client_dudas`, "Mis dudas":** one text per client, up to
  4,000 characters. A paid client reads and writes only their own (the
  website may send only `user_id`, which must be their own, and `body`).
  Admins read all and can't write a client's. Nobody deletes.
- The database trims the texts of the three client tables (spaces and line
  breaks at both ends) and sets their `updated_at` date. Deleting a login
  deletes its rows in them.

The site that is live before this migration keeps working with it.

Steps:
1. **Before you start**, check that no route exists yet with one of the
   four codes (normally the table is still empty):

   ```sql
   select code, name from public.routes order by sort_order;
   ```

   If one of the four codes is already there, stop and send me the list.
   (If you run the migration anyway, it stops with an error and changes
   nothing.)
2. SQL Editor → **New query**.
3. Open `supabase/migrations/20261120120000_checklist_templates.sql` and
   copy **all** of it ("Copy raw file" on GitHub).
4. Paste it and click **Run**. Supabase may warn that the query is
   destructive, because it replaces the two code-format rules. No data is
   deleted, so confirm.
5. You should see **"Success. No rows returned"**.

**If you get an error:** nothing was changed (the whole file runs as one
unit). Send me the message. If it says **"relation "checklist_templates"
already exists"** or **"duplicate key value … routes_pkey"**, migration 7
was already applied. Don't run it again.

Then **run the RLS test** (section 9), with the newest `tests/rls_check.sql`
from the repository. It should end with `ALL RLS TESTS PASSED`.

**Check the change** with these five queries (each in a new query, or all
five one after another):

```sql
-- 1. The four routes
select code, name, sort_order from public.routes order by sort_order;
```

Expected, four rows in this order: `medico_drittstaat` | `Médico · título
de fuera de la UE` | `1`, `medico_ue` | `Médico · título de la UE, el EEE o
Suiza` | `2`, `dentista_drittstaat` | `Dentista · título de fuera de la UE`
| `3`, `dentista_ue` | `Dentista · título de la UE, el EEE o Suiza` | `4`.

```sql
-- 2. The ten new fields on checklist_items
select count(*) as new_fields
  from information_schema.columns
 where table_schema = 'public' and table_name = 'checklist_items'
   and column_name in ('block', 'official_number', 'sobre_order', 'donde', 'plazo',
                       'aviso', 'caduca', 'na_default', 'na_reason', 'source_code');
```

Expected: `new_fields` = `10`.

```sql
-- 3. The four new tables, each with RLS on and three rules
select c.relname as table_name, c.relrowsecurity as rls_on,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as rules
  from pg_class c
 where c.relnamespace = 'public'::regnamespace
   and c.relname in ('checklist_templates', 'client_item_settings', 'client_details', 'client_dudas')
 order by c.relname;
```

Expected, four rows, each with `rls_on` = `true` and `rules` = `3`:
`checklist_templates`, `client_details`, `client_dudas`,
`client_item_settings`.

```sql
-- 4. Nobody may delete from the new tables, and a client's dudas can
--    never be moved to another user
select has_table_privilege('authenticated', 'public.checklist_templates', 'DELETE')  as templates_delete,
       has_table_privilege('authenticated', 'public.client_item_settings', 'DELETE') as layer_delete,
       has_table_privilege('authenticated', 'public.client_details', 'DELETE')       as details_delete,
       has_table_privilege('authenticated', 'public.client_dudas', 'DELETE')         as dudas_delete,
       has_column_privilege('authenticated', 'public.client_dudas', 'user_id', 'UPDATE') as dudas_move,
       has_column_privilege('authenticated', 'public.client_dudas', 'body', 'UPDATE')    as dudas_write;
```

Expected: every column `false`, except `dudas_write` = `true`.

```sql
-- 5. Logged-out visitors have no rights on the new tables
select count(*) as anon_rights
  from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public'
   and table_name in ('checklist_templates', 'client_item_settings', 'client_details', 'client_dudas');
```

Expected: `anon_rights` = `0`.

## 8. Make yourself and your cousin admins

Accounts are only created by admins, through **Invite user**. Public sign-ups
are disabled in Supabase (**Authentication** settings, "Allow new users to
sign up" is off), so nobody can register themselves. Keep that setting off.

An admin is made **only here in the SQL Editor, by user ID, never by
email**. The ID is permanent and unique; an email can be mistyped, changed
later, or belong to the wrong account.

1. **Authentication → Users → Invite user**, with your own email. A profile
   row is created automatically.
2. In the SQL Editor, list the accounts to find the right **user ID** (the
   long code in the `id` column):

   ```sql
   select id, email, first_name, last_names, is_admin
   from public.profiles
   order by created_at;
   ```

   You can also copy the ID from **Authentication → Users** (the "User UID").
3. Run this, with that exact ID between the quotes:

   ```sql
   update public.profiles set is_admin = true
   where id = '00000000-0000-0000-0000-000000000000';
   ```

   It must say **"1 row affected"**. If it says 0 rows, the ID is wrong.
   Nothing was changed; copy the ID again.
4. Do the same for your cousin.

To take admin away from someone, run the same line with `false` instead of
`true`.

`is_admin` can't be changed through the website at all, not even by an
admin. `plan`, `route` and the state can be changed by an admin in the admin
screens, or by you here in the SQL Editor. A client can never change
`plan`, `route` or `is_admin`, not even on their own profile.

## 9. Run the RLS test

1. SQL Editor → **New query**. Paste **all** of `tests/rls_check.sql`, then
   click **Run**.
   - Supabase may warn that the query contains `DELETE`. That's the clean-up
     step, which only removes the test's own rows, so confirm.
2. Read the result:
   - **`ALL RLS TESTS PASSED`**: everything works.
   - **An error starting with `FAIL:`**: a rule isn't working. The message
     says which one. The test data has already been thrown away, so nothing
     is left behind. Send me the message.
   - **Any other error** (for example "permission denied for table users"):
     the test itself couldn't run. Send me the message.

**What the test does:**
- **Setup:** it creates eight fake logins (client A on the free plan,
  clients B to G on the paid plan, and an admin), plus test routes,
  checklist items, news and community posts, and (migration 7) test
  templates, client-layer rows, client details and dudas. Client G has the
  same state and route as client B, to prove two clients on the same
  checklist still never see each other's notes, details or dudas. The test admin also adds a few test files
  to the `news-files` bucket, small copies of photos included (only their storage rows, no real content). Their names all start with `rls-test` /
  `[rls-test]`, or they belong to a fake login.
- **Safety nets:** before that, it checks the whole database: every table
  has RLS on, logged-out visitors have no rights on any table, every
  `SECURITY DEFINER` function (one that runs with its owner's rights) has a
  fixed `search_path`, and there are no views in `public`.
- **Checks:** it pretends to be each of them, the same way the website does
  after a login, and runs 210 checks. (Before migration 7 there were 158,
  before migration 6 there were 147,
  before migration 5 there were 124, before migration 4 there were 93,
  before migration 3 there were 75, and before migration 2 there were 46.
  The new version only works once migration 7 is applied.)
- **Clean-up:** it deletes everything it created, the test files included.
  Supabase may refuse plain-SQL deletes on stored files ("use the Storage
  API instead"); the test switches that guard off for its own run only
  (`storage.allow_delete_query`).
- **Your data:** it only looks at its own test rows, so it's safe to run on
  the real project. Just never give real data names that start with
  `rls-test`.

**Run it again** after every future migration that changes tables, grants
or policies.

## 10. Load a checklist template

Each of the owner's checklist templates is one JSON file in
`content/checklists/`, named `<state>-<route>.json`
(e.g. `bw-medico_drittstaat.json`). A script turns it into one SQL file in
`supabase/content/` that you paste here. Do this **after migration 7**.

**Making the SQL** (on your computer, in the project folder; Claude Code can
do it too):

```bash
npm run checklist-sql -- content/checklists/bw-medico_drittstaat.json
```

It checks the JSON first (blocks 1–5, every step's fields, unique codes,
only the known placeholders `{pais}`, `{genero:x|y}`, `{nota_personal}`,
`{nombre}`, `{perfil}`, every envelope entry matching one step) and stops
with a list of problems if anything is wrong. Otherwise it writes
`supabase/content/bw-medico_drittstaat.sql`. It removes the inline
`{nota_personal}` markers (personal notes are their own box on the site)
and leaves out the cards about the old device-only file.

**Loading it:**
1. SQL Editor → **New query**.
2. Open the file in `supabase/content/` (e.g.
   `supabase/content/bw-medico_drittstaat.sql`) and copy **all** of it.
3. Paste it and click **Run**.
4. The result shows two numbers. For Baden-Württemberg
   `medico_drittstaat`: `pasos_activos` = `26`, `pasos_archivados` = `0`.

**Running it again is safe** (for example after the owner sends a new
version of the same template). It runs as one unit:
- the template's blocks, cover and cards are replaced
- a step whose code already exists is **updated in place**, so clients'
  ticks stay; a step that had been archived and is back is un-archived
- a new step is added
- a step of this Bundesland + route that came from a template but is
  missing from the new JSON gets `archived = true`. Nothing is ever
  deleted, and items without a `source_code` are never touched.

If a new version of a template uses one of the owner's codes for a step
that now **means something else**, give that step a new code in the JSON
before making the SQL (the old step is then archived by itself). Ticks
belong to the step, not to its wording.

**If you get an error:** nothing was changed. If it says **"Apply migration
7 first"**, do section 7 first. Otherwise send me the message.

**Check** what is loaded:

```sql
select code, block, official_number, sobre_order, na_default, archived, title
  from public.checklist_items
 where state = 'bw' and route = 'medico_drittstaat'
 order by sort_order;
```

Expected for Baden-Württemberg `medico_drittstaat`: 26 rows, from
`bw-medico_drittstaat-n1` to `bw-medico_drittstaat-b5`, none archived;
`bw4`, `bw5` and `bw16` have `na_default` = `true`.

---

## How the rules work, in short

There are two layers, and both must allow something before it works.

1. **Grants** say which actions the website may use on a table at all.
   - Before login (role `anon`): nothing.
   - After login (role `authenticated`): only what each table needs. For
     example, nobody can delete checklist items, and the website can't
     send the date of a tick (the database sets it).
2. **RLS policies** (Row Level Security) say *which rows* each logged-in
   person may touch.

| Table | A client can… | An admin can also… |
|---|---|---|
| `profiles` | read their own; change `first_name` and `last_names`; choose `main_state` once, while it is empty | read all; change `first_name`, `last_names`, `main_state` (also change or clear it), `route`, `plan`. **Nobody** changes `is_admin` through the website (only in the SQL Editor). |
| `routes` | read all | add and change (never delete; use `archived`) |
| `checklist_items` | read active items for **their own state and route**, **only on the paid plan** (no state or no route = no items) | read all (also archived); add and change (never delete; use `archived`) |
| `progress` | read, tick and untick their own (paid only; ticking only for active items of their own state and route) | read everyone's (but not tick for them) |
| `news_posts` | read published posts whose date has come, for their own state or for all states, **only once they have a state**; `paid_only` posts only on the paid plan | read all (drafts too); add, change, delete |
| `news_attachments` | read the rows of the posts they can see (same rules as `news_posts`) | read all; add, change the order (`sort_order` only) and delete |
| files in the `news-files` bucket | read (download, signed links, listing) a file only when it has a `news_attachments` row they can read | read every file, also one without a row; upload (only to `<post id>/<uuid>.<jpg/png/webp/pdf>`), change and delete |
| `checklist_templates` | read the template of **their own state and route**, **only on the paid plan** | read all; add and change (never delete) |
| `client_item_settings` (client layer) | **paid plan only:** read their own rows, for steps they can read | read all; add and change (never delete; reset by emptying `applies`, `reason` and `note`) |
| `client_details` | **paid plan only:** read their own | read all; add and change (never delete) |
| `client_dudas` ("Mis dudas") | **paid plan only:** read, add and change their own (only `user_id`, which must be their own, and `body`); never delete | read all (but not write a client's) |
| `community_posts` | **paid plan only:** read the board (posts with an empty `state`) and **their own state's chat**; post there (only the text and the state); delete their own. At most 5 posts a minute and 100 in 24 hours. Nobody edits posts. | read all (the board and all 16 chats); post anywhere, with no speed limit; delete any post |

**Other things built in:**
- **News for all states:** a news post with an empty `state` is for all
  states.
- **`paid_only`:** it starts ticked on every new post, so remember to untick
  it for free news.
- **Profiles:** a profile is created automatically when someone is invited,
  and its `email` copy follows the login email if it changes.
- **Community posts:** the website only sends the text (and, in a chat, the
  state). The database marks posts by an admin as `is_staff` ("Equipo MNL");
  nobody can send that field. The database removes
  spaces and line breaks at the start and end, refuses empty posts and posts
  over 2,000 characters, and fills in the author, the date and the author
  name. The name is the first word of `first_name` plus the first letter of
  `last_names` ("José" + "Pérez García" → "José P."), just the first word if
  `last_names` is empty ("María"), or "Miembro" if `first_name` is empty. It
  is fixed when the post is written; changing the profile later doesn't
  change old posts. It is the only thing about another member a client can
  see.
- **Deleting an account** in **Authentication → Users** also deletes their
  profile, progress and community posts, and their client layer, details
  and dudas.
- **State codes:** states are stored as the 16 short codes the map uses
  (`by` = Bayern, `nw` = Nordrhein-Westfalen, `th` = Thüringen…). Anything
  else is refused.

## Handy SQL until the admin screens exist

Add a route (the values below are placeholders). The code is permanent, so
choose it carefully: lowercase letters and digits, with single hyphens or
underscores between them (since migration 7).

```sql
insert into public.routes (code, name, sort_order)
values ('route-code', 'Nombre de la ruta', 1);
```

Set a client's name (nombre/s and apellidos):

```sql
update public.profiles
set first_name = 'María Fernanda', last_names = 'García López'
where email = 'client@example.com';
```

When inviting someone through the API instead of the dashboard, the same two
values can be sent as invite metadata (`first_name`, `last_names`); the
profile picks them up automatically.

Set a client's plan, main state and route (here in the SQL Editor you can
also change a state the client already chose):

```sql
update public.profiles
set plan = 'paid', main_state = 'by', route = 'route-code'
where email = 'client@example.com';
```

Retire a checklist item. Never delete it, and never reuse its ID or code:

```sql
update public.checklist_items set archived = true where code = 'by-route-code-010';
```
