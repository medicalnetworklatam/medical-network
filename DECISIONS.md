# MNL client area: decisions log

Last updated: 15 Nov 2026. This is the source of truth for the project. When a decision changes, update this file in the Claude project knowledge and in the code repository.

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

## Changes on 15 Nov 2026

- **Legal work goes to a law firm** hired by the owner. Ivan and Claude don't write or choose legal texts (see "For the law firm").
- **One state per user.** This replaces the 13 Nov "follow several states" decision (see "States per user").
- **Community board** for all members, now part of the prototype (see "Community").
- **Chat per Bundesland:** confirmed, but it waits until the board is done. If time runs short, it moves past the prototype.
- **Free users:** no real use right now. The `free` plan stays in the database; nothing new is designed for free users.

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
  - The state chat is a non-working preview until it is built (after the community board).
- **States per user** (confirmed 15 Nov 2026, replaces 13 Nov):
  - Each user has exactly one Bundesland (`profiles.main_state`). It decides their checklist, their news and, later, their state chat.
  - A client only ever sees one state's news.
  - The client picks it once on the state map. After that, only an admin can change it. This stops one payment from unlocking all 16 states.
  - **No state chosen = no news:**
    - A client may skip choosing ("No lo sé").
    - Until they choose, they see NO news at all, not even "all states" posts.
    - They still see the community board, with a reminder to pick a state.
  - The route is still set by an admin.
  - If an admin changes a client's state, the old state's progress stays saved but isn't shown.
  - `followed_states` is removed in migration 2. The state map becomes single-choice and saves to the account, not to the browser.
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
- There is no check that a user is a doctor.
- **Roles:**
  - free client (no real use right now; kept for later)
  - paid client
  - admin (Ivan and his cousin)
- **Profile privacy:**
  - Other users can't see profiles. The only exception is the "María G." author name on community posts (see "Community").
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
  - It waits until the board is done.
- **Author name:**
  - First name + initial of the last name (e.g. "María G."), produced by the database. A client can't type a different name.
  - Never the email, full name, state or progress.
- **Moderation:**
  - Posts appear immediately; admins can delete any post afterwards.
  - No approval before a post appears.

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
  - `profiles`: name, email (a copy of the login email, kept in sync), main Bundesland, route, plan (free/paid), is_admin, created date. Created automatically when a user is invited.
  - `routes`: permanent short code, Spanish name, sort order, archived. Starts empty; Ivan will give the route names later.
  - `followed_states`: user_id, Bundesland, for news. **Removed in migration 2 (15 Nov decision).**
  - `checklist_items`: permanent automatic ID (what progress uses), optional unique readable code (like `by-kp-010`, for humans and spreadsheet imports), Bundesland, route, title, text, sort order, archived
  - `progress`: user_id, item_id, done_at (set by the database)
  - `news_posts`: title, body (plain text), Bundesland (empty = all states), publish date, published, paid_only (ticked by default)
  - Bundesländer are stored as the map's 16 short codes (`by`, `nw`, `th`…); the database refuses anything else.
  - Adding tables or columns later is normal. Restructuring is cheap until real clients have data.
- **Migration 2** (planned 15 Nov 2026):
  - removes `followed_states`
  - lets a client set `main_state` once, while it is still empty
  - news: only posts for the client's state, or for all states if the client has chosen a state; a client with no state sees no news at all
  - adds `community_posts`: author, author name (made by the database), body (plain text), created date. Posts are deleted together with the author's account.
  - extends `rls_check.sql` to cover all of this
  - the state chat may later reuse `community_posts` with an added Bundesland column; decide when it's built
- **Who can do what** (confirmed 13 Nov 2026, updated 15 Nov 2026, enforced by grants and RLS, proven by `supabase/tests/rls_check.sql`):
  - The 15 Nov changes take effect when migration 2 is applied; until then the database follows the 13 Nov rules.
  - Logged-out visitors can read nothing.
  - Clients read and change only their own rows. On their profile they can change their name, and set their Bundesland once while it is empty.
  - Route, plan, is_admin, and the Bundesland once set, are changed only by admins.
  - **Paid unlocks the checklist:** only paid users and admins can read checklist items, and only they can tick them.
  - News: free users only see posts with `paid_only = false`. Clients only see published posts whose date has come, for their own Bundesland or for all states. A client with no Bundesland sees no news at all.
  - **Community board:** only paid users and admins read and write. Clients delete their own posts; admins delete any post. Nobody edits posts in the first version.
  - The client ticks their own items; admins can only view progress.
  - Only admins write routes, checklist items and news. Checklist items and routes are never deleted, not even by admins (retire them with `archived = true`).
  - Admin overview "last activity" = the client's most recent tick.
- **Progress is saved by each item's permanent ID,** never by its position in the list.
  - Never reuse or rename an ID once it's live.
  - To retire an item, set `archived = true` instead of deleting it.
  - This is the hardest decision to reverse once clients have saved progress.
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
  - The admin account is web@medicalnetworklatam.com (shared for now). Suggested: separate admin logins for Ivan and his cousin before real clients arrive.
- **Database changes are written as SQL files** in `supabase/migrations/` in the repository. Ivan applies them by pasting them into Supabase's SQL Editor, so no Supabase keys are ever given to Claude Code.
- **Two-factor login for admins:** not needed for now (Ivan's decision, 13 Nov 2026). Suggested to revisit before the first real client's data goes in.
- **Admin client overview:**
  - one row per client: name, Bundesland, plan, progress %, last activity
  - opening a client shows their checklist read-only

## First version scope

**Deliverables:**
1. A new site that keeps the company email working
2. Accounts with paid profiles (free stays possible in the data, unused for now)
3. The checklist always in its latest version
4. Progress saved to the account, the same on every device
5. An admin screen showing every client's progress
6. News for the client's one Bundesland
7. The community board for all members (added 15 Nov 2026)

**Checklist content:** 6 of the 16 Bundesländer, 4 routes each. The cousin is researching the other 10, which isn't urgent.

**Out of the first version:**
- payment inside the site (clients pay through an external link; an admin switches the plan to paid by hand)
- file uploads (users will never upload files, not even in the community)
- private messages between members
- automatic account creation on payment
- legal texts (the law firm's job)

**Later:**
- Next, as soon as the board is done: the chat per Bundesland (moves past the prototype if time runs short)
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
- **Maximum length of a community post** (2,000 characters)
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
