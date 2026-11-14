# Database setup (Supabase)

This folder holds the database for the client area, as plain SQL files. You
apply them by hand in Supabase's **SQL Editor**. Nothing here needs a key,
and Claude Code never connects to Supabase.

| File | What it is |
|---|---|
| `migrations/20261113120000_initial_schema.sql` | **Migration 1.** Creates the tables, switches on Row Level Security, and adds the access rules and the automatic profile. Run it **once**. |
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

## 2. Make yourself and your cousin admins

Accounts are only created by admins, through **Invite user**. Public sign-ups
are disabled in Supabase (**Authentication** settings, "Allow new users to
sign up" is off), so nobody can register themselves. Keep that setting off.

1. **Authentication → Users → Invite user**, with your own email. A profile
   row is created automatically. You can see it in Table Editor → `profiles`.
2. In the SQL Editor, run this (with the right email):

   ```sql
   update public.profiles set is_admin = true
   where email = 'your-email@example.com';
   ```

   It should say **"1 row affected"** (or "Success"). If it says 0 rows, the
   email doesn't match the invite exactly.
3. Do the same for your cousin.

`plan` and `is_admin` can only be changed by an admin (later through the
admin screens) or by you here in the SQL Editor. A client can never change
them, not even on their own profile.

## 3. Run the RLS test

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
- **Setup:** it creates three fake logins (client A on the free plan, client
  B on the paid plan, and an admin), plus test routes, checklist items and
  news. Their names all start with `rls-test` / `[rls-test]`.
- **Checks:** it pretends to be each of them, the same way the website does
  after a login, and runs 46 checks.
- **Clean-up:** it deletes everything it created.
- **Your data:** it only looks at its own test rows, so it's safe to run on
  the real project. Just never give real data names that start with
  `rls-test`.

**Run it again** after every future migration that changes tables, grants
or policies.

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
| `profiles` | read their own; change only `full_name` | read all; change `full_name`, `main_state`, `route`, `plan`, `is_admin` |
| `followed_states` | read, add and remove their own | read everyone's |
| `routes` | read all | add and change (never delete; use `archived`) |
| `checklist_items` | read active items, **only on the paid plan** | read all (also archived); add and change (never delete; use `archived`) |
| `progress` | read, tick and untick their own (paid only, active items only) | read everyone's (but not tick for them) |
| `news_posts` | read published posts whose date has come; `paid_only` posts only on the paid plan | read all (drafts too); add, change, delete |

**Other things built in:**
- **News for all states:** a news post with an empty `state` is for all
  states.
- **`paid_only`:** it starts ticked on every new post, so remember to untick
  it for free news.
- **Profiles:** a profile is created automatically when someone is invited,
  and its `email` copy follows the login email if it changes.
- **Deleting an account** in **Authentication → Users** also deletes their
  profile, followed states and progress.
- **State codes:** states are stored as the 16 short codes the map uses
  (`by` = Bayern, `nw` = Nordrhein-Westfalen, `th` = Thüringen…). Anything
  else is refused.

## Handy SQL until the admin screens exist

Add a route (the values below are placeholders). The code is permanent, so
choose it carefully: lowercase letters, digits and hyphens only.

```sql
insert into public.routes (code, name, sort_order)
values ('route-code', 'Nombre de la ruta', 1);
```

Set a client's plan, main state and route:

```sql
update public.profiles
set plan = 'paid', main_state = 'by', route = 'route-code'
where email = 'client@example.com';
```

Retire a checklist item. Never delete it, and never reuse its ID or code:

```sql
update public.checklist_items set archived = true where code = 'by-route-code-010';
```
