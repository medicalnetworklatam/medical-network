# CLAUDE.md: Medical Network client area (read every session)

Private client area for medicalnetworklatam.com (Medical Network LATAM): Latin American doctors track their German licensure checklist and read news for the Bundesländer they follow. **DECISIONS.md is the source of truth. Read it before planning a feature, and update it when a decision changes.**

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

## First version scope
In scope:
- accounts with free and paid profiles, created by admin invite (email and password)
- the client's checklist for their main state (always the latest version, progress saved to the account)
- news for the states they follow, published through an admin form
- an admin overview of every client's progress

Chat and calendar appear as **non-working previews only**.

Out of scope:
- payment inside the site
- file uploads
- a working chat
- automatic account creation on payment

## Look & feel (carry over from the mock-up, keep consistent)
- **Colours:**
  - page `#EEF9F5`, text `#121413`
  - green `#489E85` (borders, sidebar), bright green `#7CDC92` (selected)
  - pale teal `#CAE8E6`, dark green text `#2F7A64`, muted text `#3D4A46`
  - cards and rows white `#FFFFFF`
- **Fonts** (self-hosted files, open licence):
  - **Anton** only for the big uppercase page titles
  - **Figtree** for everything else
  - Small section titles: Figtree 13px, weight 700, uppercase, `letter-spacing: 0.1em`
- **Shapes:** rounded corners (12–20px), pill buttons, hidden scrollbars, `:focus-visible` outlines in `#489E85`.
- **Responsive:** phone layout at `max-width: 700px`, designed for iPad landscape and desktop too. Tap targets at least 44px.
- **Language:** all text users see is in **Spanish**, and state names are in **German** (Bayern, Nordrhein-Westfalen, Thüringen…). Content in `[corchetes]` in the mock-up is placeholder text.
- **Accessibility:** keep the roles and ARIA labels, keyboard support (Tab, Space/Enter, arrow keys in lists), and `aria-live` announcements in Spanish. Respect `prefers-reduced-motion`.

## The mock-up and the state map
- **`design-mockup/MOCKUP-NOTES.md` is the old CLAUDE.md of the plain-HTML mock-up, kept word for word.**
  - Read it when porting or changing a mock-up page. It has the page flow, every detail of the map (sizes, settings, animations, city search) and the saved-choice behaviour.
  - Its look, behaviour and accessibility notes still apply.
  - Its stack rules no longer apply: no framework, no build, ES5 style, Google Fonts, opening the files directly.
- **Map rules that always apply:**
  - Never hand-edit the SVG path `d` attributes. The scripts that generated them are gone, so copy them exactly.
  - Neighbouring states must keep sharing exactly the same border.
- **Saving the choice:** in the mock-up, chosen states were saved only in the browser (`localStorage`). In the app they will be saved to the user's account: several followed states for news, plus one main state for the checklist.

## Commands and checks
- Commands (run them in the project folder; they need Node.js 22, see `.node-version`):
  - `npm install`: downloads the tools listed in `package.json` into `node_modules/`. Run it after cloning, and after a `git pull` that changed `package.json`.
  - `npm run dev`: starts the live preview at http://localhost:5173. Pages reload as you save. For logins to work, first copy `.env.example` to `.env.local` and fill in the two Supabase values.
  - `npm run build`: checks the TypeScript types, then makes the final website files in `dist/`. Cloudflare Pages runs this on every push.
  - `npm run preview`: serves the built `dist/` folder at http://localhost:4173, to check what will go online.
  - `npm run lint`: runs oxlint, which warns about common code mistakes.
  - Tests: no website tests yet. Database: `supabase/tests/rls_check.sql`, run by Ivan in Supabase's SQL Editor (see `supabase/README.md`).
- Cloudflare Pages settings: build command `npm run build`, output folder `dist`.
- Where things are:
  - `src/main.tsx` starts the app and lists the pages.
  - `src/pages/`: one `.tsx` file per page, plus its own `.module.css`.
  - `src/estados/`: map shapes, city search data and map animations.
  - `src/lib/savedStates.ts`: the chosen states, in the browser for now.
  - `src/lib/supabase.ts`: the one connection to Supabase. `src/lib/auth.ts` and `AuthProvider.tsx` share who is logged in; `src/pages/RequireLogin.tsx` guards the pages that need a login.
  - `supabase/templates/`: the Spanish login emails and the guide to Supabase's login settings.
  - `supabase/`: database migrations (SQL files Ivan pastes into the SQL Editor), the RLS test and a guide. Never edit a migration that's already applied; add a new one.
- Check every visual change at phone width (375px), iPad landscape and desktop.
