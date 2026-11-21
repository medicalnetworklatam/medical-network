# CLAUDE.md: Medical Network client area (read every session)

Private client area for medicalnetworklatam.com (Medical Network LATAM): Latin American doctors track their German licensure checklist and read news for their Bundesland. **DECISIONS.md is the source of truth. Read it before planning a feature, and update it when a decision changes.**

## How the owner works
- Ivan is the developer, a computer science student who is new to backend work. Explain every technical term in plain words the first time you use it. Write to him in English.
- He reviews results in plain language, often on an iPad. He also works from a Windows PC: run `git pull` there first, or the iPad's changes look "lost".
- Stay strictly in scope: no refactors or renames he didn't ask for, and no "while I was here" changes. Keep changes small and easy to check.
- For anything bigger than a small fix, propose a short plan and wait for his approval before writing code.
- Commit or push only when he asks.

## Stack
- The website is a React + Vite single-page app, deployed to Cloudflare Pages (which builds it automatically on every push).
- The backend is Supabase, project region Central EU (Frankfurt, eu-central-1): Postgres database, Auth for logins, and Row Level Security.
- The browser uses only Supabase's public (anon/publishable) key.
- The old plain-HTML mock-up lives in `design-mockup/` as a visual reference only. Don't edit it or build on it.
- The owner's original CV tool lives in `design-reference/curriculum-original.html`, also as a reference only.

## Hard rules
- **Row Level Security:**
  - Every table has Row Level Security switched on, with explicit policies.
  - After any policy change, test as a normal (non-admin) user that they can't read another client's data.
- **Secret keys:**
  - The Supabase secret (service-role) key never goes in website code and is never committed.
  - Secrets only live in environment variables.
- **Checklist progress:**
  - Progress is stored by each item's permanent ID, never by its position in the list.
  - Never reuse or rename an item ID. Retire items with `archived = true`.
- **Roles:** `profiles.plan` and `profiles.is_admin` can only be changed by admins, never through a client's own forms.
- **Data in the EU:**
  - Keep all data in the EU.
  - Fonts, scripts and images are served from our own site. No Google Fonts or similar external servers (a GDPR risk in Germany), and no analytics, without asking Ivan.
- **Domain and email:** never change the domain's DNS or email settings. Ivan does that by hand at IONOS.
- **Safe text:** show anything from the database or user input as plain text. Never insert it as raw HTML.
- **Limits on what users see:** any limit on what a user may see (their state, paid features) is enforced by RLS in the database, never only by the website. User-written text is always rendered as plain text.

## First version scope
In scope:
- accounts with paid profiles (free stays possible in the data, unused for now), created by admin invite (email and password)
- the client's checklist for their main state (always the latest version, progress saved to the account)
- news for the client's one Bundesland, published through an admin form
- a community board (text posts from all members)
- a chat per Bundesland at `/chat` (the board's table and code with a state field; refreshes every 20 seconds, no real-time connection; see "State chat" in DECISIONS.md)
- an admin overview of every client's progress

The calendar appears as a **non-working preview only**.

Out of scope:
- payment inside the site
- file uploads
- a real-time connection for the state chat
- private messages between members
- automatic account creation on payment
- legal texts (handled by a law firm)

## Look & feel
Every screen uses one look (DECISIONS.md, "Changes on 18 Nov 2026"), first built for the home page (`/`) and Novedades (`/novedades`). The palette is **Flatline**: black `#050505` on cream `#F3F0E9`.

- **Read first:** `design-hero/HERO-NOTES.md` (the look, the motion, the home page section by section) and `design-hero/DESIGN-RULES.md` (hard rules). `design-hero/` is Ivan's plain-HTML prototype, kept as a reference only: don't edit it or build on it.
- **Colours:** only the tokens in `src/styles/redesign.css`, never a hard-coded colour.
  - Three base values: `--paper` (dark hero background), `--ink` (hero words, circles, light section backgrounds), `--accent-rgb` (text and lines on light sections, inverted cells, see-through words over photos).
  - Five colours with a meaning (Alerta, Dato, Hecho, Para ti, Para todos): the tokens `--alerta`, `--dato`, `--hecho`, `--para-ti`, `--para-todos` in `src/styles/redesign.css`; where each one goes is in DECISIONS.md, "Changes on 21 Nov 2026 (late): colour with meaning". They are only backgrounds, always with their `--on-…` text colour (e.g. `--on-alerta`), and their hex values are never hard-coded anywhere else.
  - Derived from them: `--accent`, `--tint`, `--rule`.
  - `global.css` makes the light sections' colours (`--ink` background, `--accent` text) and Space Grotesk the default for every page. The home page swaps in its dark background and Albert Sans while it's open (a class on `<body>`, see `Home.tsx`).
  - Secondary text (hints, emails, "Sin estado") uses `color-mix(in srgb, var(--accent) 72%, transparent)`, never lighter, so it keeps at least 4.5:1 contrast.
- **Fonts** (self-hosted, open licence; files and licences in `src/assets/fonts/`):
  - **Albert Sans** (`--font`) for the big headlines and the chips, standing in for Aaux Next (commercial, needs a web licence first; its `@font-face` block is commented out in `redesign.css`)
  - **Space Grotesk** (`--font-grotesk`) for everything else
- **Ruled cells:** cells split by thin 1px lines (`--rule`), square corners, a small spaced uppercase label over a big bold lowercase title that ends with a full stop ("mi / historia.", "las 3 / fases."). Inverted cells ("después", "resultado") swap the colours.
  - Page titles: the `<h1>` keeps its own words; lowercase and the full stop (`aria-hidden`) come from CSS and markup. Label words: "tu" over "comunidad." and over "chat." (no state), "mis" over "documentos.", "chat de" over the state name, "administración" over the admin titles; the login screens split their title (INICIAR / sesión.). A client's name in the admin titles keeps its own capitals and has no full stop.
  - On dark cells (`--paper` background), draw the lines in the words' colour (`color-mix(in srgb, var(--ink) 28%, transparent)`, as Novedades' column does), not `--rule`, which is made from the accent and would disappear on a dark background.
- **Buttons and messages:** square dark blocks for the main action, square outlines for the others, chips (`SessionButton`, "Menú") in `--paper` and `--ink`. Errors are inverted cells (dark background, light text); red (`--alerta`) means "Alerta", never an error. Notices are ruled cells.
- **Long names in big titles** (state names, e.g. "mecklenburg- / vorpommern."): the size comes from the name's longest word, passed as a CSS variable from React's `style` prop (never a `style="..."` attribute, which the CSP blocks), measured with container query units (`cqi`) on the title's cell. Hyphenated names break after the hyphen. Every state name must fit at 375px (see `Novedades.tsx` and `.title-name` in `Novedades.module.css`).
- **Design rules:** no photo is ever cut off by the edge of the screen at the scroll point where it's meant to be seen (crop photos to frames, let frames resize); grids of cells fit on one screen (split long ones into several screens).
- **Motion** is tied to the scroll, reverses cleanly when scrolling up, and respects `prefers-reduced-motion`.
- **Rejected directions** (never go back to them): ruled "expediente" cards with D-DIN Condensed + Figtree; rounded white cards with petrol blue and numbered circles.
- **CSS that can't leak:** the site loads every page's CSS at once. A page's `.module.css` never targets `html`, `body`, `*` or `:root`; body-level rules go in `global.css`, or under a class the page adds to `<body>` while it's open (only the home page does, see `Home.tsx`). `redesign.css` holds only custom properties and `@font-face` rules.
- `:focus-visible` outlines use the tokens: a ring in the text colour, inside dark chips and inverted cells in `--ink`.
- **Responsive:** phone layout at `max-width: 700px`, designed for iPad landscape and desktop too. Tap targets at least 44px. Hidden scrollbars.
- **Language:** all text users see is in **Spanish**, and state names are in **German** (Bayern, Nordrhein-Westfalen, Thüringen…). Other German terms stay German too (Approbation, Hospitationen…), marked with `lang="de"`. Content in `[corchetes]` in the mock-up is placeholder text.
- **Accessibility:** keep the roles and ARIA labels, keyboard support (Tab, Space/Enter, arrow keys in lists), and `aria-live` announcements in Spanish. Respect `prefers-reduced-motion`.

## The mock-up and the state map
- **`design-mockup/MOCKUP-NOTES.md` is the old CLAUDE.md of the plain-HTML mock-up, kept word for word.**
  - Read it when porting or changing a mock-up page. It has the page flow, every detail of the map (sizes, settings, animations, city search) and the saved-choice behaviour.
  - Its behaviour and accessibility notes still apply. Its look doesn't (since 18 Nov 2026 the state map uses the site's colours and fonts).
  - Its stack rules no longer apply: no framework, no build, ES5 style, Google Fonts, opening the files directly.
- **Map rules that always apply:**
  - Never hand-edit the SVG path `d` attributes. The scripts that generated them are gone, so copy them exactly.
  - Neighbouring states must keep sharing exactly the same border.
  - The map's size formula (`--map-*` in `Estados.module.css`), animation timings, city search and confirmation step stay as they are.
  - On phones the "Siguiente" actions sit under the map, not stuck to the bottom of the screen, so they never cover the map.
- **Saving the choice:** in the mock-up, chosen states were saved only in the browser (`localStorage`). In the app: one Bundesland per user, chosen once on the map, saved to the account.

## Commands and checks
- Commands (run them in the project folder; they need Node.js 22, see `.node-version`):
  - `npm install`: downloads the tools listed in `package.json` into `node_modules/`. Run it after cloning, and after a `git pull` that changed `package.json`.
  - `npm run dev`: starts the live preview at http://localhost:5173. Pages reload as you save. For logins to work, first copy `.env.example` to `.env.local` and fill in the two Supabase values.
  - `npm run build`: checks the TypeScript types, then makes the final website files in `dist/`. Cloudflare Pages runs this on every push.
  - `npm run preview`: serves the built `dist/` folder at http://localhost:4173, to check what will go online.
  - `npm run lint`: runs oxlint, which warns about common code mistakes.
  - `npm run checklist-sql -- content/checklists/<state>-<route>.json`: checks one of the owner's checklist templates and writes `supabase/content/<state>-<route>.sql` for Ivan to paste (see `scripts/checklistTemplate.ts` and section 11 of `supabase/README.md`). Never edit that SQL by hand.
  - Tests: `npm test` checks the admin sums and German time (`tests/adminLogic.test.ts`, no database needed), the safe "return to the page they wanted" address after login (`tests/safePath.test.ts`), which web addresses in posts and chat messages become links (`tests/linkify.test.ts`, for `src/lib/linkParts.ts`), the rules for photos and PDFs in news (`tests/newsFiles.test.ts`, for `src/lib/newsFiles.ts`), the browser checks for Mis documentos (PDF type and "%PDF-" start, size, name shortening, path; `tests/clientFiles.test.ts`, for `src/lib/clientFiles.ts`), the checklist template script (`tests/checklistTemplate.test.ts`, with a made-up template in `tests/fixtures/`), the checklist placeholders (`tests/placeholders.test.ts`, for `src/lib/placeholders.ts`), Mi expediente's sums ("no aplica", the milestone bar, "Ahora mismo", the cards; `tests/expediente.test.ts`, for `src/lib/expediente.ts`), the CV tool's gap check and produced text (`tests/curriculum.test.ts`, for `src/lib/curriculum.ts`), and the initials on community posts (`tests/initials.test.ts`, for `src/lib/initials.ts`); it fails if any file fails. No other website tests yet. Database: `supabase/tests/rls_check.sql`, run by Ivan in Supabase's SQL Editor (see `supabase/README.md`).
- Cloudflare Pages settings: build command `npm run build`, output folder `dist`.
- Where things are:
  - `src/main.tsx` starts the app and lists the pages.
  - `src/pages/`: one `.tsx` file per page, plus its own `.module.css`.
  - `src/pages/AreaLayout.tsx`: the dark column shared by Novedades, Mi expediente, Mis documentos, Comunidad, Chat and Contacto (Mi perfil, Novedades, Mi expediente, Mis documentos, Comunidad MNL, Chat de <Bundesland>, Administración for admins, Calendario, Contacto, Cerrar sesión; the current page is marked), the phone's "Menú" bar and the floating chat link (not on Chat). `src/pages/CalendarPreview.tsx`: the non-working calendar in that column (current month and today in German time, example webinars in the "Para todos" colour, `--para-todos`).
  - `src/content/contact.ts`: the values shown on the contact page (`src/pages/Contacto.tsx`, `/contacto`, open to every logged-in user): WhatsApp number, how it's shown, contact email, website-problems email. An empty value hides its row. No form, nothing stored.
  - `src/pages/Curriculum.tsx` (`/curriculum`) and `src/lib/curriculum.ts`: the owner's CV and cover letter tool, ported from `design-reference/curriculum-original.html`. In `AreaLayout` with no row of its own (opened from Mi expediente); paid clients and admins only (a website check: nothing is stored in the database). The draft is saved only in this browser, under `mnl-cv-v1:<user id>`. The produced text keeps the original's exact format, because the owner's Claude reads it: don't change `cvText()` without asking Ivan.
  - `src/pages/PostBoard.tsx`: the list and form shared by the community board (`Comunidad.tsx`, posts with an empty state) and the state chat (`Chat.tsx`, one state's messages, refreshed every 20 seconds). The board is drawn there as a feed (the post box, then one card per post with the author's initials from `src/lib/initials.ts`); the chat by `ChatView.tsx`. Both use the styles in `Comunidad.module.css`, which other pages share too: change only the board's own classes (`feed`, `composer…`, `post-…`, `avatar`, `text-btn`) for the board.
  - Mi expediente: `src/pages/Expediente.tsx` (`/expediente`, styles in `Expediente.module.css`), the client's checklist from the template of their Bundesland + route plus the client layer, in 8 screens: Resumen (`/expediente`), Bloque 1–5 (`/expediente/1` … `/5`), El sobre (`/expediente/sobre`) and Mis dudas (`/expediente/dudas`); any other address under `/expediente` shows the Resumen. Ticks use `progress` by item ID. Reads and sums in `src/lib/expediente.ts`; `{pais}`, `{nombre}`, `{perfil}` and `{genero:x|y}` are filled by `src/lib/placeholders.ts`. Links to the CV tool, `/curriculum`, at the top and in step `p2`.
  - Mis documentos (migration 8): `src/pages/Documentos.tsx` (`/documentos`, styles in `Documentos.module.css`), the PDFs the team uploaded for the logged-in client, newest first, with "Abrir PDF" through one request of signed links (1 hour); free clients get a message and no request. `src/pages/AdminDocumentos.tsx` is the "Documentos" section on a client's admin screen ("Subir PDF", "Eliminar" with an in-page confirmation; file first then row, row first then file). Shared rules in `src/lib/clientFiles.ts` (reusing `newsFiles.ts`). Files live in the private bucket `client-files` at `<client id>/<uuid>.pdf`, table `client_documents`.
  - `src/estados/`: map shapes, city search data and map animations.
  - `src/pages/Home.tsx` and `src/pages/home/`: the home page. `HomeMenu.tsx` is "Menú" (Calendly link, plus "Entrar", or "Mi área" and "Cerrar sesión"). Its scroll motion is in `src/pages/home/` (`fit.ts`, `reveal.ts`, `push.ts`, `phases.ts`, `story.ts`, one per prototype script). Each one runs only while the page is open and removes its listeners and animation frames when it's left. They find elements by the CSS module's class names, so a class used only by them must still be listed in `Home.module.css`.
  - `src/styles/redesign.css`: the fonts and colour tokens. `src/styles/global.css`: box-sizing, hidden scrollbars, the default `body` colours and font, `.sr-only`.
  - `src/lib/profile.ts` and `ProfileProvider.tsx`: the logged-in user's own profile (name, state, plan, admin), loaded once after login and shared with every page.
  - `src/lib/supabase.ts`: the one connection to Supabase. `src/lib/auth.ts` and `AuthProvider.tsx` share who is logged in; `src/pages/RequireLogin.tsx` guards the pages that need a login, and sends users without a first name to `/perfil` first.
  - `src/pages/Admin*.tsx` and `RequireAdmin.tsx`: the admin screens, drawn only when the loaded profile is an admin, as a set of simple screens (DECISIONS.md, "Changes on 21 Nov 2026 (night, later)"). Each page has one back link in the dark top bar (`AdminLayout.tsx`, which also draws the big link-buttons, `BigLinks`). They never offer `is_admin`, and each save of state, route or plan sends only the one column it changes. Browser tab titles never hold a client's name.
    - `/admin` (`AdminHome.tsx`): "Clientes" and "Publicar".
    - `/admin/clientes` (`AdminClientes.tsx`): the client overview.
    - `/admin/clientes/<id>` (`AdminCliente.tsx`, also for any other address under it): the client's name and three big buttons, each with a status line (a count-only read of `client_documents`).
    - `/admin/clientes/<id>/estado` (`AdminClienteEstado.tsx`): state, route and plan, each with an in-page confirmation.
    - `/admin/clientes/<id>/expediente` (`AdminClienteExpediente.tsx`, with `DetailsForm` and `StepLayer` from `AdminExpediente.tsx`): the country, the header line and, per step, the client layer, each with its own "Guardar"; the client's ticks and dudas are read-only there.
    - `/admin/clientes/<id>/documentos` (`AdminClienteDocumentos.tsx` around `AdminDocumentos.tsx`): upload and delete the client's PDFs.
    - `/admin/novedades` (`AdminNovedades.tsx`): "Nueva novedad" and every post as a table.
    - `/admin/novedades/nueva` (`AdminNovedadNueva.tsx`): the news form (`AdminNewsForm.tsx`) for a new post; once saved, its "Fotos y PDF" page opens.
    - `/admin/novedades/<id>` (`AdminNovedad.tsx`, also for any other address under it): the post's title and two big buttons with status lines (counts of `news_attachments`).
    - `/admin/novedades/<id>/texto` (`AdminNovedadTexto.tsx`, the same form) and `/admin/novedades/<id>/archivos` (`AdminNovedadArchivos.tsx` around `AdminNewsFiles.tsx`).
    - The four client pages load the client through `AdminClientPage.tsx` only: a valid ID in the address, `CLIENT_COLUMNS` and `.eq('is_admin', false)`; the page's section is drawn only once that client has loaded. The three post pages do the same through `AdminNewsPage.tsx`.
    - Section pages use `AdminLayout`'s low title cell (`compact`, with "Actualizar" as its `action`). Estado is three columns; Expediente, Documentos, Fotos y PDF and the news form are two, stacked up to 900px.
  - Photos and PDFs in Novedades posts (migration 5): `src/lib/newsFiles.ts` (file types, shrinking photos, paths, order, Spanish upload errors) and `src/pages/AdminNewsFiles.tsx` (a post's "Fotos y PDF" page in Administración). Files live in the private bucket `news-files` and are shown through signed links.
  - Novedades list and full post: `src/pages/Novedades.tsx` shows each post as a preview (title, the start of the text, a square file area filled by the number of files; on phones, a box above the tag with the number of files instead) that opens `src/pages/NovedadPost.tsx`, the full post at `/novedades/<id>` (same filters as the list, "No encontramos esta novedad." for anything it can't show). Both use `Novedades.module.css` and `NewsMeta.tsx` (the date and tag cell). `src/lib/listScroll.ts` brings the reader back to the same place in the list. Photos get a small copy (about 480 px, migration 6, `thumb_path`), made by the admin form; the list shows only the small copies.
  - `src/lib/adminData.ts` and `berlinTime.ts`: the admin reads (in pages of 1,000 rows, ordered by primary key), progress % (leaving out "no aplica" steps of both kinds, whose ticks never count), last activity, the Alerta rule for a paid client without a state or route (`setupMissing`), the documents and news-files count texts, and German-time conversion. Their pure functions are tested by `tests/adminLogic.test.ts`; never put test rows in the live database.
  - `public/_headers`: the security headers Cloudflare Pages sends with every page (Content-Security-Policy and others). When the site starts using a new outside address (script, font, image or API), add it there, or the browser blocks it.
  - `supabase/templates/`: the Spanish login emails and the guide to Supabase's login settings.
  - `supabase/`: database migrations (SQL files Ivan pastes into the SQL Editor), the RLS test and a guide. Never edit a migration that's already applied; add a new one.
- Check every visual change at phone width (375px), iPad landscape and desktop.
