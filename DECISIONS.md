# MNL client area: decisions log

Last updated: 17 Nov 2026. This is the source of truth for the project. When a decision changes, update this file in the Claude project knowledge and in the code repository.

## Context

- **Company:** Medical Network LATAM (MNL). Medical Network Ecuador and MNL are the same company, registered in Germany. It guides Latin American doctors through German medical licensure.
- **Owner:** Ivan's cousin, a doctor. The company owns the code.
- **Developer:** Ivan, a computer science student who builds with AI help. Paid €1,200. He maintains the site for one year.
- **Deadline:** a prototype that works decently before the end of 2026.
- **Website:** medicalnetworklatam.com. The domain, its DNS (the domain's address book) and the company email are at IONOS.
- **Users:**
  - Latin American doctors going through German licensure
  - about 25 accounts in the first 12 months
  - Spanish only, web only
- **Admins:** Ivan and his cousin.

## Changes on 17 Nov 2026

- **Look and feel is unfinished and gets its own phase.** The current look is the first mock-up carried into React. The design pass happens after the main features work and before the test with friendly clients, starting from real brand material from the owner, so the site doesn't look generic or AI-made. Until then, new screens reuse the existing styles so the redesign changes styles, not structure.
- **State chat scope decided** (see "State chat"): same table as the board with a Bundesland field, refresh every 20 seconds, paid members only, admins can read and post in any state, "Equipo MNL" label on admin posts, a posting speed limit. Built in migration 4.

## Changes on 16 Nov 2026

- Admin screens scope decided (see "Admin screens"): the news form creates, edits, unpublishes and schedules posts; an admin can clear a client's state; the route is set on the same client screen; no history of admin changes in the prototype.
- **Checklist limited to the client's own Bundesland and route** (option A, Ivan's decision after a security review). A client with no state or no route sees no checklist items. Enforced by the database in migration 3, not by the website. Reversible with one small migration.
- **`is_admin` can no longer be changed through the website**, not even by an admin (migration 3). An admin is made only in Supabase's SQL Editor, by user ID.
- **Security headers** on every page (`public/_headers`, PR #13): a strict Content-Security-Policy (only our own site and the Supabase project; no inline scripts or styles), plus X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy. HSTS comes with the custom domain. Any new outside address (for example the state chat's live connection) must be added to `_headers`.
- **Security review of 16 Nov** (details in the project doc `docs/security-review-2026-11-16.md`, kept out of the public repository): H1, M1, M2, L1 and L6 fixed in PRs #12 and #13; migration 3 applied on 16 Nov 2026, rls_check.sql showed ALL RLS TESTS PASSED (93 checks).
- **Supabase settings checked by hand (16–17 Nov):** sign-ups and anonymous sign-ins off, confirm email and secure email change on, secure password change turned on (password reset tested afterwards), only `public` and `graphql_public` exposed, no tables in realtime, RLS on every table, no rights for logged-out visitors.
- **Security Advisor warnings accepted for now:** 24-hour email links (chosen so invites don't expire overnight); leaked password protection (Pro plan only, turned on when switching to Pro). Supabase's own `public.rls_auto_enable()` gets its execute rights removed in the next small migration.

## Changes on 15 Nov 2026

- **Legal work goes to a law firm** hired by the owner. Ivan and Claude don't write or choose legal texts (see "For the law firm").
- **One state per user.** This replaces the 13 Nov "follow several states" decision (see "States per user").
- **Community board** for all members, now part of the prototype (see "Community").
- **Chat per Bundesland:** confirmed, but it waits until the board is done. If time runs short, it moves past the prototype. (Decided and built on 17 Nov 2026: see "State chat".)
- **Free users:** no real use right now. The `free` plan stays in the database; nothing new is designed for free users.
- **Names are split** into first name (nombre/s) and last names (apellidos), replacing the single full name. Most members have two surnames, so a single field gives the wrong initial in "María G." (see "Community").

## Confirmed decisions (13 Nov 2026)

### Stack

- **Backend: Supabase,** a managed database with logins built in.
  - Region: Central EU (Frankfurt, eu-central-1), not the general "Europe" group.
  - Use the Free plan while building. Switch to Supabase Pro ($25/month) the day the first real client gets an invite.
- **Website: Cloudflare Pages,** with free static hosting.
- **Website code: React + Vite** (confirmed 13 Nov 2026).
  - React builds screens from reusable pieces. Vite turns the code into files the browser can run.
  - The plain-HTML design mock-up in the repository `pinatryingtocode/medical-network` was a test. Its look gets carried into React: colours, fonts, layouts and the state map.
  - Chosen because the first version is app-like: about 10 screens that depend on data.
- **Chat and calendar:**
  - The calendar is a non-working preview.
  - The state chat is a working page, `/chat` (see "State chat"). The chat preview on Novedades is now a link to it.
- **States per user** (confirmed 15 Nov 2026, replaces 13 Nov):
  - Each user has exactly one Bundesland (`profiles.main_state`). It decides their checklist, their news and their state chat (see "State chat").
  - A client only ever sees one state's news.
  - The client picks it once on the state map. After that, only an admin can change it. This stops one payment from unlocking all 16 states.
  - **No state chosen = no news:**
    - A client may skip choosing ("No lo sé").
    - Until they choose, they see NO news at all, not even "all states" posts.
    - They still see the community board, with a reminder to pick a state.
  - The route is still set by an admin.
  - If an admin changes a client's state, the old state's progress stays saved but isn't shown.
  - `followed_states` is removed in migration 2. The state map becomes single-choice and saves to the account, not to the browser.
  - **Confirming the state** (decided 15 Nov 2026):
    - Before saving, the map asks: "¿Confirmas <Bundesland>? Para cambiarlo después tendrás que contactarnos." Only "Sí, confirmar" saves `main_state`; then the client goes to Novedades.
    - "No lo sé" saves nothing and goes to Novedades.
    - Once a state is saved, the map only shows it (highlighted, nothing to choose) with "Tu estado es <Bundesland>. Para cambiarlo, contáctanos."
    - If the database refuses the save because a state was already saved (for example from another device), the page says so in Spanish and reloads the profile.
- **Website code is written in TypeScript** (confirmed 13 Nov 2026), JavaScript with type labels that catch mistakes before the site is built.
- **Fonts are self-hosted** (confirmed 13 Nov 2026). The font files are served from our own site, never from Google's servers (a GDPR risk in Germany).
  - **Figtree** for all text, except **Anton** for the big uppercase page titles. The mock-up's home page used Archivo for body text; that is dropped.
- **State names are shown in German** (confirmed 13 Nov 2026): Bayern, Nordrhein-Westfalen, Thüringen… All other text users see is in Spanish.
- **Domain and email stay at IONOS for the first version.**
  - Add only one CNAME record, a pointer such as `app.` or `www.`, aimed at Cloudflare Pages.
  - Never touch the MX, SPF, DKIM, DMARC or autodiscover records.
  - Moving DNS to Cloudflare can be revisited after launch, copying every email record exactly.

### Accounts and sign-in

- Accounts are created by hand with Supabase's "Invite user". The client gets an email and sets their own password.
- Only admins create accounts. Public sign-ups are disabled in Supabase, so nobody can register themselves.
- Sign-in is email and password, with a "Forgot password" link.
- **Login screens** (built 14 Nov 2026):
  - addresses: `/iniciar-sesion` (log in), `/recuperar-contrasena` (forgot password), `/nueva-contrasena` (set password; invite and reset links land here)
  - default access: the home page and the three login screens are public; every other page needs a login and sends logged-out visitors to `/iniciar-sesion`
  - after logging in, people return to the page they wanted, but only to an address on this site (a path starting with a single `/`, never a full URL or `//`), to prevent open redirects; otherwise they go to `/novedades`, as do logged-in people who open `/iniciar-sesion`
  - an "Entrar" / "Cerrar sesión" pill is in the header of the home page and the state picker, and at the bottom of the green column on Novedades. "Cerrar sesión" logs out this device only.
  - the one-time code in invite and reset links is only used when the person presses "Guardar contraseña", so email scanners can't use it up
  - passwords need at least 8 characters, set in Supabase too so the server enforces it
  - email links are valid for 24 hours (one setting for invite and reset links)
  - invite links always go to the Site URL (production); reset links go back to the site where the form was used (production, a Cloudflare preview or localhost)
  - emails are Spanish templates in `supabase/templates/`; the setup steps are in `supabase/templates/README.md`
  - the website reads two environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, set in Cloudflare Pages for Production and Preview
- **Name step** (decided 15 Nov 2026):
  - After logging in, a user whose first name is empty goes to `/perfil` ("Completa tu perfil") before any other login-only page, then on to the page they wanted (same safe-address rule as the login).
  - Two required fields, "Nombre(s)" and "Apellidos", up to 100 characters each, with spaces at the start and end removed. The page saves only `first_name` and `last_names`.
  - The page explains that other members see "Nombre I." on community posts, and shows how the user's own name will look.
  - The same page is used later to change the name (the profile button on Novedades links to it).
  - If a logged-in user has no profile row (it should never happen; the database creates it on invite), the site shows "Tu cuenta no está lista. Contáctanos." with "Cerrar sesión".
- There is no check that a user is a doctor.
- **Roles:**
  - free client (no real use right now; kept for later)
  - paid client
  - admin (Ivan and his cousin)
- **Profile privacy:**
  - Other users can't see profiles. The only exception is the "María G." author name on community posts (see "Community").
  - Community posts also carry the author's user ID (`author_id`), readable by other members. It's a random ID that can't be used to look anything up, and the website needs it to show "Eliminar" only on your own posts (confirmed 15 Nov 2026).
  - Admins can see every client's data and progress.

### News

- The cousin, who isn't technical, writes all the news. He publishes through a small admin form that we build ourselves (no separate CMS).
- Clients see only the posts for their one Bundesland, plus "all states" posts (confirmed again 15 Nov 2026).
- A client with no Bundesland sees no news at all, not even "all states" posts.
- The admin news form keeps the "all states" option.
- From migration 2, the database enforces this, not the website.

### Community (confirmed 15 Nov 2026)

- **Board:**
  - One board for all members, regardless of state.
  - Text only: no files, no photos.
  - Built in the prototype.
- **State chat:**
  - One per Bundesland. Members see only their own state's chat.
  - Decided and built after the board: see "State chat (decided 17 Nov 2026)" below.
- **Author name:**
  - Produced by the database from the profile, when the post is written. A client can't type a different name, and a later name change doesn't change old posts.
  - Rule: first word of `first_name` + " " + first letter of `last_names` in uppercase + "." ("José" + "Pérez García" → "José P."; "María Fernanda" + "García López" → "María G.").
  - No last names: just the first word of `first_name` ("María"). No first name: "Miembro".
  - Never the email, full name, state or progress.
- **Post text:** plain text, 1 to 2,000 characters. The database removes spaces and line breaks at the start and end, so a post of only spaces counts as empty and is refused (confirmed 15 Nov 2026).
- **Moderation:**
  - Posts appear immediately; admins can delete any post afterwards.
  - No approval before a post appears.
- **Board page** (built 15 Nov 2026):
  - Address `/comunidad` ("Comunidad"), login only. Linked from the green column on Novedades (the menu on a phone), with a "← Novedades" link back.
  - Members with no state can open it. They see "Aún no has elegido tu estado." with an "Elegir mi estado" link above the board.
  - Free users see only "La comunidad es para miembros con el paquete completo." The page makes no request for posts (the database refuses them anyway).
  - Posts are listed newest first, 30 at a time, with "Ver más" for older ones. "Ver más" asks for posts older than the last one shown (by `created_at`, then `id` for posts with the very same time), using `created_at` exactly as the database sent it, so no post is skipped or shown twice.
  - No realtime: the list loads when the page opens, after publishing, and with an "Actualizar" button. After publishing, the new post shows at the top and the list goes back to the newest 30.
  - Each post shows the author name, the date and time in the reader's own time zone (news dates stay in German time), and the body as plain text with its line breaks. No automatic links.
  - The form's counter ("0 / 2000") follows the database's rule exactly: it removes only spaces, tabs, carriage returns and line breaks at both ends, and counts an emoji as one character. "Publicar" is disabled when the text is empty, over 2,000 characters, or while sending. The page sends only the body.
  - "Eliminar" is shown on the user's own posts, and on every post for admins. It asks for confirmation inside the post ("¿Eliminar esta publicación?" with "Sí, eliminar" and "Cancelar"), not with the browser's own pop-up, so every word stays in Spanish.

### State chat (decided 17 Nov 2026)

- **Storage:** the same table as the board (`community_posts`), with a new Bundesland field. Empty = the general board; a state code = that state's chat. Same rules for names, length, deleting and moderation.
- **Who:** paid members see only their own state's chat. A paid member with no state sees "Elige tu estado" with a link to the map. Free members get no access to the state chat (same message as on the board). The database enforces all of this.
- **Admins:** a state picker to read any state's chat and post in it.
- **"Equipo MNL":** the database marks posts written by an admin, on the board and in the chats, so members can't pass themselves off as staff (security review L4).
- **Speed limit:** at most 5 posts a minute and 100 a day per member, board and chats together, enforced by the database (security review L5). Admins are exempt.
- **Live updates:** no real-time connection. The page refreshes by itself every 20 seconds while it is open and visible, plus an "Actualizar" button. Real-time can be added later (it would need the table in Supabase's realtime list and a new address in `_headers`).
- **Page:** `/chat`, login only. The chat preview on Novedades becomes a link to it.
- **Messages:** plain text, 1 to 2,000 characters, members delete their own, admins delete any, no editing.
- **Migration 4** also removes execute rights on Supabase's `public.rls_auto_enable()` from the website's roles.

### Admin screens (decided 16 Nov 2026)

- **Who sees them:** admins only. The website hides the admin pages from everyone else, but the database rules (RLS) are what actually protect the data.
- **No database change expected.** Migrations 1 and 2 already let admins read every profile, progress and checklist item, write news, and change a client's plan, route and state (checked 16 Nov 2026). If the build turns out to need one, it comes as migration 3 with new checks in `rls_check.sql`.
- **News form:**
  - create, edit, unpublish (untick "published") and schedule (a publish date in the future)
  - the publish date is entered and shown in German time (Europe/Berlin), like the news dates clients see
  - keeps the "all states" option and the paid-only box (ticked by default)
  - no deleting posts from the form in the prototype; unpublish instead
  - title and body are plain text, shown as plain text
- **Client overview:**
  - one row per account that isn't an admin, free accounts marked as free; the `+prueba` test account shows until it's deleted before launch
  - columns: name ("first_name last_names"), Bundesland, route, plan, progress %, last activity (the client's most recent tick)
  - a client who hasn't done the name step shows "Sin nombre" with their email in small text
  - progress % = ticked items ÷ non-archived items for the client's current Bundesland and route; "—" when the client has no state, no route, or there are no items yet
  - last activity is shown in German time (Europe/Berlin)
- **One client's screen:**
  - their checklist, read-only
  - change the Bundesland, including back to "no state". After clearing, the client can choose once more on the map. Progress for the old state stays saved but isn't shown.
  - set the route; while the routes table is empty it shows "Sin rutas todavía"
  - the route can be set back to "Sin ruta" to undo a mistake
  - switch the plan between free and paid (back to free is there to undo mistakes)
  - every change asks for confirmation inside the page, in Spanish, never with the browser's own pop-up
- **Never offered in the website:** changing `is_admin`. The database would let an admin do it, so the website must not offer it. Admins are made by hand in Supabase (see `supabase/README.md`).
- **No history** of who changed what in the prototype.
- **No test rows in the live database.** There is only one Supabase project. Routes and checklist items are never deleted and route codes are permanent, so the progress calculation is tested in code instead (16 Nov 2026).

### Data and security (confirmed 13 Nov 2026)

- **Login emails go through Brevo's free plan** ("for now"), connected to Supabase as custom SMTP (the standard way of sending email). Supabase's built-in sender is for testing only.
  - Easy to switch later: it's one setting in Supabase.
  - Fallback: the IONOS mailbox, untested.
  - Setup: Brevo's DKIM record is added at IONOS, and Brevo is merged into the existing SPF record. A domain must have only one SPF record.
  - **Status (14 Nov 2026):**
    - Brevo is connected to Supabase as custom SMTP; the sender web@medicalnetworklatam.com is verified.
    - The Spanish Invite and Reset templates are pasted in. Supabase only allows editing templates once custom SMTP is set up.
    - Tested on the live site: log in, log out, forgot password and invite all work, emails included.
    - Still to do before real clients: authenticate the domain in Brevo (DKIM records at IONOS), and fix DMARC. The domain already has a DMARC record without a "rua" tag; edit it, never add a second one. This needs the IONOS login.
- **Data design** (built in migration 1, `supabase/migrations/20261113120000_initial_schema.sql`, 13 Nov 2026):
  - `profiles`: first name (`first_name`, nombre/s) and last names (`last_names`, apellidos), each up to 100 characters; email (a copy of the login email, kept in sync), main Bundesland, route, plan (free/paid), is_admin, created date. Created automatically when a user is invited; the names can come from the invite's `first_name` and `last_names` metadata.
    - Migration 2 replaced the single `full_name` with `first_name` and `last_names`. An existing `full_name` was moved into `first_name`.
  - `routes`: permanent short code, Spanish name, sort order, archived. Starts empty; Ivan will give the route names later.
  - `followed_states`: user_id, Bundesland, for news. **Removed in migration 2 (15 Nov decision).**
  - `community_posts` (migration 2): id, author_id (deleted together with the author's account), author_name, body (plain text, 1 to 2,000 characters, trimmed), created date. The website sends only the body; the database sets everything else. Listed newest first. Migration 4 adds `state` (the Bundesland; empty = the board, sent by the website for chat messages) and `is_staff` ("Equipo MNL", set by the database): see "State chat".
  - `checklist_items`: permanent automatic ID (what progress uses), optional unique readable code (like `by-kp-010`, for humans and spreadsheet imports), Bundesland, route, title, text, sort order, archived
  - `progress`: user_id, item_id, done_at (set by the database)
  - `news_posts`: title, body (plain text), Bundesland (empty = all states), publish date, published, paid_only (ticked by default)
  - Bundesländer are stored as the map's 16 short codes (`by`, `nw`, `th`…); the database refuses anything else.
  - Adding tables or columns later is normal. Restructuring is cheap until real clients have data.
- **Migration 2** (applied 15 Nov 2026, `supabase/migrations/20261115120000_one_state_news_community.sql`):
  - removes `followed_states`
  - replaces `profiles.full_name` with `first_name` and `last_names`
  - lets a client set `main_state` once, while it is still empty
  - news: only posts for the client's state, or for all states if the client has chosen a state; a client with no state sees no news at all. A private helper, `my_state()`, gives the policy the user's own state.
  - adds `community_posts`: author, author name (made by the database), body (plain text), created date. Posts are deleted together with the author's account.
  - new functions get no access for anyone by default; only logged-in users may run `my_state()`, and nobody may call trigger functions directly
  - extends `rls_check.sql` to cover all of this (75 checks; all passed on a local Postgres 16 with a small stand-in for Supabase's login parts, before handing over)
  - the state chat reuses `community_posts` with an added Bundesland column (decided 17 Nov 2026, built in migration 4: see "State chat")
- **Who can do what** (confirmed 13 Nov 2026, updated 15 Nov 2026, enforced by grants and RLS, proven by `supabase/tests/rls_check.sql`):
  - The 15 Nov changes are in force since migration 2 was applied (15 Nov 2026).
  - Logged-out visitors can read nothing.
  - Clients read and change only their own rows. On their profile they can change their first name and last names, and set their Bundesland once while it is empty.
  - Route, plan, is_admin, and the Bundesland once set, are changed only by admins.
  - **Paid unlocks the checklist:** only paid users and admins can read checklist items, and only they can tick them.
  - **Checklist by state and route** (decided 16 Nov 2026, migration 3): a paid client reads and ticks only non-archived items for their own Bundesland and their own route. No state or no route = no items. Admins read all.
  - **`is_admin`** (decided 16 Nov 2026, migration 3): not writable through the website by anyone, admins included. Changed only in the SQL Editor, by user ID.
  - News: free users only see posts with `paid_only = false`. Clients only see published posts whose date has come, for their own Bundesland or for all states. A client with no Bundesland sees no news at all.
  - **Community board:** only paid users and admins read and write. Clients delete their own posts; admins delete any post. Nobody edits posts in the first version. A client with no Bundesland still sees the board.
  - The client ticks their own items; admins can only view progress.
  - Only admins write routes, checklist items and news. Checklist items and routes are never deleted, not even by admins (retire them with `archived = true`).
  - Admin overview "last activity" = the client's most recent tick.
- **Progress is saved by each item's permanent ID,** never by its position in the list.
  - Never reuse or rename an ID once it's live.
  - To retire an item, set `archived = true` instead of deleting it.
  - This is the hardest decision to reverse once clients have saved progress.
- **No function, view or table may ever take a user ID and return information about another user.**
- **Row Level Security (RLS) is on for every table.** RLS is the set of database rules that decide who can read or change each row. It's required by the stack, because the website talks to the database directly with a public key.
- **Any rule that limits what a user may see** (their state, paid features) must be enforced by RLS, never only by the website.
- **Text written by users is always shown as plain text,** never as HTML.
- **The secret (service-role) key never goes into the website code.**
- **Supabase project settings** (13 Nov 2026):
  - project `mnl-client-area`, Frankfurt, Free plan
  - Data API on
  - "Automatically expose new tables" **off**: every migration must grant table access explicitly
  - "Automatic RLS" **on**, as a safety net. Migrations still enable RLS explicitly.
  - Public sign-ups **disabled** (Authentication settings, "Allow new users to sign up" off). Accounts are only created by admins.
  - No GitHub link in Supabase; changes are applied by hand.
  - Migration 1 was applied on 14 Nov 2026. rls_check.sql showed ALL RLS TESTS PASSED.
  - Migration 2 was applied on 15 Nov 2026. rls_check.sql showed ALL RLS TESTS PASSED.
  - Migration 3 (`20261116120000_checklist_own_state_route.sql`, checklist by state and route, `is_admin` only in the SQL Editor) was applied on 16 Nov 2026. rls_check.sql showed ALL RLS TESTS PASSED (93 checks).
  - Before the first real client: switch to Pro and turn on leaked password protection; remove the preview and localhost redirect URLs or move testing to a separate project; delete old preview deployments (14 on 17 Nov 2026).
  - The admin account is web@medicalnetworklatam.com (shared for now). Suggested: separate admin logins for Ivan and his cousin before real clients arrive.
- **Database changes are written as SQL files** in `supabase/migrations/` in the repository. Ivan applies them by pasting them into Supabase's SQL Editor, so no Supabase keys are ever given to Claude Code.
- **Two-factor login for admins:** not needed for now (Ivan's decision, 13 Nov 2026). Suggested to revisit before the first real client's data goes in.
- **Admin client overview:** see "Admin screens (decided 16 Nov 2026)", which adds the route column and the rules for progress %.

## First version scope

**Deliverables:**
1. A new site that keeps the company email working
2. Accounts with paid profiles (free stays possible in the data, unused for now)
3. The checklist always in its latest version
4. Progress saved to the account, the same on every device
5. An admin screen showing every client's progress
6. News for the client's one Bundesland
7. The community board for all members (added 15 Nov 2026)
8. The chat per Bundesland (added 17 Nov 2026, see "State chat")

**Checklist content:** 6 of the 16 Bundesländer, 4 routes each. The cousin is researching the other 10, which isn't urgent.

**Out of the first version:**
- payment inside the site (clients pay through an external link; an admin switches the plan to paid by hand)
- file uploads (users will never upload files, not even in the community)
- private messages between members
- automatic account creation on payment
- legal texts (the law firm's job)

**Later:**
- real-time updates in the chat per Bundesland (the chat itself is built: see "State chat")
- possibly a calendar and alerts
- features for free users, if a use for them appears

## Open decisions (suggested default in brackets)

- **Repository:**
  - The repository is public and owned by the company's GitHub organization.
  - Ivan's decision (13 Nov 2026): it stays public for now.
  - The plain-HTML mock-up now lives in `design-mockup/`.
  - The React + Vite + TypeScript version is merged into `main` (pull request #3) and live on Cloudflare Pages. GitHub Pages is turned off.

- **What a news post can include:** the fields are decided (see Data design). Still open: links inside the text (suggested: the site turns web addresses into links safely); no comments, likes or photos. The same safe link rule would apply to community posts too.
- **Replies to community posts** (none in the prototype; replies can be added later)
- **Alerts** (none in the first version)
- **Calendar** (deferred)
- **Students and doctors already working in Germany** (treat them as another route)
- **Accounts** for GitHub, Supabase, Cloudflare and Brevo, all under the company email.
  - The company email now exists (13 Nov 2026).
  - Done (13 Nov 2026):
    - a company GitHub account owns a GitHub organization, with Ivan's personal account as a second owner, and the repository has been transferred into it
    - Cloudflare Pages has been recreated in a company Cloudflare account, and the old project in Ivan's personal account is deleted
  - Supabase and Brevo were created with the company email (13 to 14 Nov 2026).

## For the law firm

The owner will hire a law firm for all legal work (decided 15 Nov 2026). Ivan and Claude don't write or choose these texts.

- Impressum
- Datenschutzerklärung (Spanish and German)
- data processing agreements (AVVs) with Supabase, Cloudflare, Brevo and IONOS
- terms of sale (AGB) for the lifetime package
- **Data retention for lifetime accounts.** Current suggestion, as a starting point: keep while active; delete on request; after 3 years without login, warn by email and delete 30 days later.
- **Community:**
  - rules for members
  - how a post is reported and removed
  - showing "María G." names to other members
- **Timing** (suggested by Claude, not yet confirmed): done before the first real client gets an invite.
