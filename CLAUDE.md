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
During the redesign, two looks exist side by side (DECISIONS.md, "Changes on 17 Nov 2026 (evening)"): the **new look** on redesigned screens, the **old look** on all the others until each one is redesigned. A screen uses one look, never a mix. Redesigned so far: the home page (`/`) and Novedades (`/novedades`). Next: not decided yet.

### New look (redesigned screens)
- **Read first:** `design-hero/HERO-NOTES.md` (the look, the motion, the home page section by section) and `design-hero/DESIGN-RULES.md` (hard rules). `design-hero/` is Ivan's plain-HTML prototype, kept as a reference only: don't edit it or build on it.
- **Colours:** only the tokens in `src/styles/redesign.css`, never a hard-coded colour.
  - Three values make every palette: `--paper` (dark hero background), `--ink` (hero words, circles, light section backgrounds), `--accent-rgb` (text and lines on light sections, inverted cells, see-through words over photos).
  - Derived from them: `--accent`, `--tint`, `--rule`.
  - The palette isn't chosen yet. **Temporary:** the home page's "Menú" button cycles the five candidates (`src/lib/palette.ts`, `src/pages/home/PaletteMenu.tsx`), set as `data-palette` on `<html>` and remembered in the browser, so it applies to every redesigned screen. Once one is chosen, it becomes the `:root` default and the switcher is removed.
- **Fonts** (self-hosted, open licence; files and licences in `src/assets/fonts/`):
  - **Albert Sans** (`--font`) for the big headlines, standing in for Aaux Next (commercial, needs a web licence first; its `@font-face` block is commented out in `redesign.css`)
  - **Space Grotesk** (`--font-grotesk`) for everything else
- **Ruled cells:** cells split by thin 1px lines (`--rule`), square corners, a small spaced uppercase label over a big bold lowercase title that ends with a full stop ("mi / historia.", "las 3 / fases."). Inverted cells ("después", "resultado") swap the colours.
  - On dark cells (`--paper` background), draw the lines in the words' colour (`color-mix(in srgb, var(--ink) 28%, transparent)`, as Novedades' column does): `--rule` is made from the accent, which equals `--paper` in some palettes and would disappear.
- **Long names in big titles** (state names, e.g. "mecklenburg- / vorpommern."): the size comes from the name's longest word, passed as a CSS variable from React's `style` prop (never a `style="..."` attribute, which the CSP blocks), measured with container query units (`cqi`) on the title's cell. Hyphenated names break after the hyphen. Every state name must fit at 375px (see `Novedades.tsx` and `.title-name` in `Novedades.module.css`).
- **Design rules:** no photo is ever cut off by the edge of the screen at the scroll point where it's meant to be seen (crop photos to frames, let frames resize); grids of cells fit on one screen (split long ones into several screens).
- **Motion** is tied to the scroll, reverses cleanly when scrolling up, and respects `prefers-reduced-motion`.
- **Rejected directions** (never go back to them): ruled "expediente" cards with D-DIN Condensed + Figtree; rounded white cards with petrol blue and numbered circles.
- **CSS that can't leak:** the site loads every page's CSS at once. A page's `.module.css` never targets `html`, `body`, `*` or `:root`; body-level rules go under a class the page adds to `<body>` while it's open (see `Home.tsx`). `redesign.css` holds only custom properties and `@font-face` rules.
- `:focus-visible` outlines use the tokens (a ring in `--ink` inside the dark chips).

### Old look (screens not redesigned yet, carried over from the mock-up)
- **Colours:**
  - page `#EEF9F5`, text `#121413`
  - green `#489E85` (borders, sidebar), bright green `#7CDC92` (selected)
  - pale teal `#CAE8E6`, dark green text `#2F7A64`, muted text `#3D4A46`
  - cards and rows white `#FFFFFF`
- **Fonts** (self-hosted files, open licence):
  - **Anton** only for the big uppercase page titles
  - **Figtree** for everything else
  - Small section titles: Figtree 13px, weight 700, uppercase, `letter-spacing: 0.1em`
- **Shapes:** rounded corners (12–20px), pill buttons, `:focus-visible` outlines in `#489E85`.
- Both state maps stay exactly as they are.

### Both looks
- **Responsive:** phone layout at `max-width: 700px`, designed for iPad landscape and desktop too. Tap targets at least 44px. Hidden scrollbars.
- **Language:** all text users see is in **Spanish**, and state names are in **German** (Bayern, Nordrhein-Westfalen, Thüringen…). Other German terms stay German too (Approbation, Hospitationen…), marked with `lang="de"`. Content in `[corchetes]` in the mock-up is placeholder text.
- **Accessibility:** keep the roles and ARIA labels, keyboard support (Tab, Space/Enter, arrow keys in lists), and `aria-live` announcements in Spanish. Respect `prefers-reduced-motion`.

## The mock-up and the state map
- **`design-mockup/MOCKUP-NOTES.md` is the old CLAUDE.md of the plain-HTML mock-up, kept word for word.**
  - Read it when porting or changing a mock-up page. It has the page flow, every detail of the map (sizes, settings, animations, city search) and the saved-choice behaviour.
  - Its look, behaviour and accessibility notes still apply.
  - Its stack rules no longer apply: no framework, no build, ES5 style, Google Fonts, opening the files directly.
- **Map rules that always apply:**
  - Never hand-edit the SVG path `d` attributes. The scripts that generated them are gone, so copy them exactly.
  - Neighbouring states must keep sharing exactly the same border.
- **Saving the choice:** in the mock-up, chosen states were saved only in the browser (`localStorage`). In the app: one Bundesland per user, chosen once on the map, saved to the account.

## Commands and checks
- Commands (run them in the project folder; they need Node.js 22, see `.node-version`):
  - `npm install`: downloads the tools listed in `package.json` into `node_modules/`. Run it after cloning, and after a `git pull` that changed `package.json`.
  - `npm run dev`: starts the live preview at http://localhost:5173. Pages reload as you save. For logins to work, first copy `.env.example` to `.env.local` and fill in the two Supabase values.
  - `npm run build`: checks the TypeScript types, then makes the final website files in `dist/`. Cloudflare Pages runs this on every push.
  - `npm run preview`: serves the built `dist/` folder at http://localhost:4173, to check what will go online.
  - `npm run lint`: runs oxlint, which warns about common code mistakes.
  - Tests: `npm test` checks the admin sums and German time (`tests/adminLogic.test.ts`, no database needed) and the safe "return to the page they wanted" address after login (`tests/safePath.test.ts`); it fails if either file fails. No other website tests yet. Database: `supabase/tests/rls_check.sql`, run by Ivan in Supabase's SQL Editor (see `supabase/README.md`).
- Cloudflare Pages settings: build command `npm run build`, output folder `dist`.
- Where things are:
  - `src/main.tsx` starts the app and lists the pages.
  - `src/pages/`: one `.tsx` file per page, plus its own `.module.css`.
  - `src/pages/PostBoard.tsx`: the list and form shared by the community board (`Comunidad.tsx`, posts with an empty state) and the state chat (`Chat.tsx`, one state's messages, refreshed every 20 seconds). Both use the styles in `Comunidad.module.css`.
  - `src/estados/`: map shapes, city search data and map animations.
  - `src/pages/Home.tsx` and `src/pages/home/`: the home page (new look). Its scroll motion is in `src/pages/home/` (`fit.ts`, `reveal.ts`, `push.ts`, `phases.ts`, `story.ts`, one per prototype script). Each one runs only while the page is open and removes its listeners and animation frames when it's left. They find elements by the CSS module's class names, so a class used only by them must still be listed in `Home.module.css`.
  - `src/styles/redesign.css`: fonts and colour tokens for the new look. `src/lib/palette.ts`: the temporary palette switcher.
  - `src/lib/profile.ts` and `ProfileProvider.tsx`: the logged-in user's own profile (name, state, plan, admin), loaded once after login and shared with every page.
  - `src/lib/supabase.ts`: the one connection to Supabase. `src/lib/auth.ts` and `AuthProvider.tsx` share who is logged in; `src/pages/RequireLogin.tsx` guards the pages that need a login, and sends users without a first name to `/perfil` first.
  - `src/pages/Admin*.tsx` and `RequireAdmin.tsx`: the admin screens (`/admin`, `/admin/clientes/<id>`, `/admin/novedades`), drawn only when the loaded profile is an admin. They never offer `is_admin`, and each save sends only the one column it changes.
  - `src/lib/adminData.ts` and `berlinTime.ts`: the admin reads (in pages of 1,000 rows, ordered by primary key), progress %, last activity, and German-time conversion. Their pure functions are tested by `tests/adminLogic.test.ts`; never put test rows in the live database.
  - `public/_headers`: the security headers Cloudflare Pages sends with every page (Content-Security-Policy and others). When the site starts using a new outside address (script, font, image or API), add it there, or the browser blocks it.
  - `supabase/templates/`: the Spanish login emails and the guide to Supabase's login settings.
  - `supabase/`: database migrations (SQL files Ivan pastes into the SQL Editor), the RLS test and a guide. Never edit a migration that's already applied; add a new one.
- Check every visual change at phone width (375px), iPad landscape and desktop.
