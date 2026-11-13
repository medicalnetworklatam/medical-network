# CLAUDE.md — Medical Network (read every session)

## What this is
A Spanish-language website mock-up, "Medical Network", for doctors in Germany ("Ser médico ya es difícil, no te preocupes por la burocracia"). Three static pages, plain HTML + CSS + vanilla JS, **no framework, no build step, no npm**. Content in `[corchetes]` is placeholder text.

- `index.html` — home. Menu button → `berlin.html`. (Nothing links to `estados.html` yet.)
- `estados.html` — "¿En qué estado federal estás interesado?": a clickable map of the 16 German states + city search. Choose one or more, then **Siguiente** → `berlin.html`. **No lo sé** (shown instead of the count while nothing is chosen) → `berlin.html` with no states.
- `berlin.html` — a state's page: green sidebar ("Tus estados" + calendar), big state title, news/document cards, chat. Clicking a state in the sidebar swaps title/chat (preview only, no reload).

## How the owner works
- He does not write code. He describes a change; the model edits; he reviews the result in plain language (often on the iPad).
- Stay strictly in scope. No unrequested refactors, renames or "while I was here" changes. Small, verifiable diffs.
- Commit/push only when he asks. He works from a Windows PC and an iPad: on the PC run `git pull` first, or iPad changes look "lost".

## Look & feel (keep consistent across pages)
- Colours: page `#EEF9F5`, text `#121413`, green `#489E85` (borders, sidebar), bright green `#7CDC92` (selected), pale teal `#CAE8E6`, dark green text `#2F7A64`, muted text `#3D4A46`, white cards/rows `#FFFFFF`.
- Fonts (Google Fonts): **Anton** only for the big page titles (uppercase). **Figtree** for everything else. Small section titles = Figtree 13px, weight 700, uppercase, `letter-spacing: 0.1em` (sidebar "Tus estados"/"Calendario", the chat's "CHAT" label with the state name under it, centred).
- Rounded corners (12–20px), pill buttons, scrollbars hidden, `:focus-visible` outlines in `#489E85`.
- Responsive: phone layout at `max-width: 700px`; design for iPad landscape and desktop too. Tap targets ≥ 44px.
- Language: UI text in **Spanish**; state names in **German** (Bayern, Nordrhein-Westfalen, Thüringen…) — owner's decision.

## estados.html — how the map works
- The map is inline SVG: 16 `<path class="state" id="st-by" …>` (ids = ISO code, e.g. `st-nw`, `st-be`), each with `role="checkbox"`, `aria-label` = German name, and `data-x`/`data-y` = the point inside the state where the black dot, the name's line and the green fill start.
- Shapes come from Natural Earth 1:10m admin-1 (public domain), Lambert conformal conic, simplified so neighbouring states share exactly the same border. **Never hand-edit the `d` attributes.** The scripts that generated them are gone; edit `estados.html` directly for everything else.
- Map units: the map is 559.1 × 760; knobs at the top of the script (`GUTTER`, `NAME_GAP`, `LINE_H`, `HIT_R_MOUSE`/`HIT_R_TOUCH`, …).
- Berlin, Hamburg, Bremen are tiny: invisible `.hit` circles enlarge their tap area (44px on touch screens).
- Desktop: chosen states get a name beside the map with a curved black line and dot (left/right by side of the map, pushed apart so they never overlap). Phone: no side names; chosen states show as removable chips under the map; Siguiente bar sticks to the bottom.
- City search: `CITIES` (≈250 entries, `'City|STATE|other spellings'`) + `STATE_ALIASES` (Spanish/English state names). Matching ignores accents and accepts ue/oe/ae for ü/ö/ä. Picking a result selects its state (never unselects).
- Animations — selecting: dot pops, line draws out, name fades in, and the bright green grows as a circle from the dot until it fills the state (clipped to the state's outline). Unselecting is the **exact reverse** (name fades, line pulls back, dot shrinks, green shrinks into the dot). Clicking mid-way reverses from where it is. `prefers-reduced-motion` → no animation.

## Saved choice (estados → berlin)
- `localStorage` key **`mn_estados`** = `[{"id":"nw","name":"Nordrhein-Westfalen"}, …]` in the order picked. Written by Siguiente; `[]` = "No lo sé". Per browser/device only — not shared, no server.
- `berlin.html` reads it: builds "Tus estados" from it and opens on the first state; `[]` shows "Todavía no has elegido estados." + link to `estados.html`; key missing or invalid → the sample list (Berlin, Baviera, NRW, Hamburgo) stays.

## Conventions
- Vanilla JS, ES5 style as in the files (`var`, `function`), each page self-contained (own `<style>` and `<script>`).
- Use `textContent` (not `innerHTML`) for anything from storage or user input.
- Keep accessibility: roles/ARIA already present, keyboard support (Tab, Space/Enter, arrows in the city list), `aria-live` announcements in Spanish.

## Run & check
- No build. Open the `.html` files directly, or run `python -m http.server` in this folder and open `http://localhost:8000/estados.html`.
- Check changes at phone width (375px), iPad landscape and desktop.
