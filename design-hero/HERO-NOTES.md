# MNL — home page look & feel (prototype notes; this was the prototype's CLAUDE.md)

Visual prototype for the home page of the MNL site (Medical Network LatAm,
medicalnetworklatam.com). It helps Spanish-speaking doctors get their degree
recognised and practise medicine in Germany. The owner (Ivan) is in charge of
the look. The aim: serious and trustworthy, and above all **not looking AI-generated**.

This folder is a plain HTML/CSS/JS prototype. The real site is **React + Vite
on Cloudflare Pages**; when this moves into it, the redesign changes styles,
not structure.

## Run it

No build step. Open `index.html` in a browser, or serve the folder:

```
npx serve .
```

Check every change at phone width as well as desktop: clients will mostly use
their phones.

## Files

| File | What it does |
|---|---|
| `index.html` | All sections, top to bottom (see "Page, in order") |
| `styles.css` | Tokens, the five palettes, every section. Phone rules are in the `@media (max-width: 700px)` block at the end |
| `fit.js` | Justified headlines: sizes each line of `.hero__words` on its own so all lines start and end at the same x, measured on the letters' ink. Runs for every `.hero__stage`; stages in one hero share a width, and `data-fit-h` limits a stage to a share of the screen height |
| `reveal.js` | Scroll-driven circle on the pinned `.hero-track` that reveals "ruta." |
| `push.js` | Second hero: "POR ESO CREÉ…" rises from below and pushes "YO TAMBIÉN…" up until they share the screen |
| `phases.js` | The phases' cells rise one at a time over the second hero; earlier phases shrink as the next takes focus (no snapping); at the end a circle closes on them, revealing the closing slide |
| `story.js` | "mi historia.": fades "después" in over "antes" (blur to clear), with a rest on each side; no snapping |
| `palette.js` | The menu button currently cycles colour palettes (see "Open decisions") |
| `DESIGN-RULES.md` | Hard rules for the site, read before changing layouts |
| `assets/` | Photos (see "Photos") |
| `fonts/` | Self-hosted fonts and their licences |

## Page, in order

1. **Hero** (dark, pinned): "LA BUROCRACIA / ALEMANA / ES UN LABERINTO", justified
   by `fit.js`. A photo (`hero-house.jpg`) in black-and-white film negative sits over the middle; the
   letters crossing it are drawn a second time in the see-through accent colour,
   clipped to the photo's box (`--media-inset`).
2. **"yo soy tu / ruta."** (`.intro`): revealed by a circle that grows with the
   scroll. While the circle is small only "ruta." shows, centred. Once the word
   fits, the circle opens fully, the word glides to its place and the rest fades in.
   Scrolling up reverses it, following the scroll (`reveal.js`, eased progress `q`).
3. **"mi / historia."** (`.story`): one pinned screen. Slim head bar on top; below
   it, "antes" (bio, *mis inicios* photo, antes) with "después" (*hoy, especialista*
   photo, después in an inverted cell) fading in on top, from foggy to clear.
   Each side has a rest zone (`--story-hold`, half a screen of scroll) so a
   casual scroll while reading doesn't tip into the other. No snapping (owner's
   choice): the page rests wherever you stop, even half way through the fade.
4. **Second hero** (dark, pinned, `.push-track`): "YO TAMBIÉN / EMPECÉ CONFUNDIDO"
   alone in the middle; scrolling on, "POR ESO CREÉ / LA RUTA APPROBATION" rises
   from below and pushes it up until each sits centred in its half of the
   screen (`push.js`). Both justified to the same width, no photo. Then a rest
   (75svh of scroll) with both on screen before the phases start to rise.
5. **"las 3 / fases."** (`.phases`): rows of ruled cells: number | title + intro |
   checklist + "resultado" (an inverted cell, like "después") | photo. On a phone:
   number column, then title + intro, checklist + resultado stacked, photo below
   (only when there is room). Texts are the owner's, from the current site.
   Staged over the pinned second hero, in the same `.push-track` (`phases.js`):
   the title cell rises to the top, then phase 01, 02, 03 rise in turn. The
   newest phase is full size (as tall as its text needs); the earlier ones
   are minimised and greyed out: only the title and an empty "RESULTADO" box
   (intro, checklist and result sentence close up with `--k`; photo hidden on
   phone); anything that still doesn't fit fades out instead of being squeezed. The end
   state fills one screen; if the open phase needs more (small phones), the
   screen scrolls on at the end to show the rest (`.push-track__more`). Once all three are in, hovering a phase (mouse) or clicking /
   tapping it expands it and shrinks the others; scrolling back up returns
   the focus to 03. No snapping (owner's choice): the page rests wherever
   you stop, even half way through a step. Without JS it is a plain section.
   Dark to light ("finding the light"): 01 is nearly the hero's dark, 02 a middle
   tone, 03 the page's light, all mixed from `--paper` and `--ink`
   (`--tone-1..3` on `.phases`). The title cell takes the colour of each
   phase as it arrives (`--e1..3` set by `phases.js`).

6. **Closing call to action** (`.cta`), in the heroes' font (chosen over a Space
   Grotesk version): "TU HOMOLOGACIÓN / NECESITA / UNA RUTA" (justified by
   `fit.js`), "Pago único 3.500 €", a square dark button "Aplicar a Ruta
   Approbation" (opens https://calendly.com/ivan-ab89/ruta-approbation in a new
   tab), "Nos vemos en Alemania".
   Light background (`--ink`), dark letters (`--paper`). It lives in the same
   `.push-track`, pinned behind the phases (hidden until they fill the screen);
   `.push-track__close` gives first a rest on the finished phases (50svh), then
   a circle closes on the phases, shrinking them
   slightly, and leaves it: the "ruta." circle in reverse (`phases.js`).
   It is the last screen of the page.

## Look

- **Type:** heroes in Aaux Next (commercial, Positype; **not licensed yet**:
  Albert Sans stands in, self-hosted. The `@font-face` block to switch is at the
  top of `styles.css`). The ruled-cell sections use **Space Grotesk** for everything.
- **Colour:** every palette is three values, `--paper` (dark hero background),
  `--ink` (hero words, circles, light section backgrounds) and `--accent-rgb`
  (text, lines, the "después" cell, and see-through words over photos).
  `--accent`, `--tint` and `--rule` are derived from it. Never hard-code a colour;
  use the tokens.
- **Ruled-cell sections** (from the Mijo Bello reference): cells split by thin
  1px lines, a small spaced uppercase label over a big bold lowercase title that
  ends with a full stop ("yo soy tu / ruta.", "mi / historia.", "las 3 / fases.").
- Motion is tied to the scroll and must reverse cleanly when scrolling up.
  Respect `prefers-reduced-motion`.

## Project rules (from the owner)

- Read `DESIGN-RULES.md`. Above all: **no photo is ever cut off by the edge of the
  screen** at the scroll point where it is meant to be seen. Crop photos to
  frames instead, and let frames resize. Grids of cells must fit on one screen;
  split long ones into several screens.
- Text users see is **Spanish**. German terms stay in German (Approbation,
  Bundesland, Fachsprachprüfung, Kenntnisprüfung, Berufserlaubnis…).
- **Fonts are self-hosted**, never loaded from Google's servers.
- The real site has a strict Content-Security-Policy in `public/_headers`; any
  new outside address (e.g. a video host) must be added there.
- No tracking, so no cookie banner.
- Rejected directions (do not go back to them): ruled "expediente" cards with
  D-DIN Condensed + Figtree; rounded white cards with petrol blue and
  numbered circles. The owner called both "absolutely disgusting".

## Photos

- `hero-house.jpg` (2000×1341): colour film photo of a German house, two
  people in front (owner's own). Used in the first hero (black-and-white
  negative, by CSS filter), in "ruta." (colour) and in phase 02 (colour).
- `portrait-bw.jpg`: the old black-and-white portrait, no longer used.
- `lagoon.jpg`: colour film photo; the owner wants it **where videos will go**.
  Used as a stand-in in phase 01.
- `ejecucion.jpg` (858×929): colour film photo of an apartment building, two
  people in front (owner's own). Phase 03, cropped with `object-position: 55% 72%`.
- `antes.webp` (*mis inicios*, 914×816): Ivan young, from the owner. Cropped
  in its frame with `object-position: 58% 38%` (on the face).
- `hoy.jpg` (*hoy, especialista*): Ivan now. Cropped from a screenshot, so it
  is small (~300px wide, upscaled 2×) and soft. Replace it with the original
  file when available.
- `doctor.jpg`: the old *mis inicios* photo, no longer used.

## Open decisions

- **Palette:** the menu button cycles five palettes to compare them on the
  real page: Negativo (default), Bello, Impasto, MNL actual, Flatline (exact
  colours from the owner's reference images). Once one is chosen: make it the
  `:root` default, remove the others and `palette.js`, and give the button back
  its job as a menu.
- **Aaux Next licence**, then swap the font (the justified lines refit by themselves).
- **The 7-minute video** the owner's cousin wants still needs a place (the lagoon slots).
- More sections are expected: the owner wants a decent amount of information.
