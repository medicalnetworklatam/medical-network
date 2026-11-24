<!-- Text to add to DECISIONS.md right after the Context section. Delete this file in the same pull request. -->

## Changes on 24 Nov 2026: the home page rebuilt from Ivan's own landing design

Ivan's decision (24 Nov 2026). The owner saw the current home page and didn't like it; he loved a landing page Ivan built earlier for another client (julioiero.com), who didn't use it, so the design is Ivan's to reuse. The home page (`/`) is rebuilt with that page as the complete reference: layout, sections, components, colours and motion. **Only the home page:** every other screen keeps the Flatline look.

For the home page only, this replaces: Flatline and the five colours with a meaning (17–21 Nov); Albert Sans + Space Grotesk as a pair and the ruled cells (17 Nov); "rounded white cards" as a rejected direction (17 Nov); design rules 1 and 2 from `design-hero/DESIGN-RULES.md` (card photos are cropped as in the reference); the scroll motion; and "no animations on the home page" (23 Nov, late night, never built).

**Confirmed by Ivan:**
- The reference counts in full (everything), for the home page only.
- Carousels, the scrolling strip and the fade-ins come back.
- The same colours as the reference: deep teal `#113B40`, darker teal `#0F1F1C`, cream `#F6F0DF`, muted teal `#4A7875`, mint `#33DB95`; light sections on cool grey or pale mint.

**Never taken from the reference:** the other client's texts, photos, testimonials, logos, names, prices, payment links, social accounts or analytics. Only MNL's own content goes on the page.

**Proposed by Claude, to confirm on the preview:**
- **Fonts:** the reference's fonts are commercial and not licensed for this site (Aeonik, as a trial file; Neutral Sans, sold by Brave Type). The home page uses Albert Sans, already self-hosted, for everything. Buying licences later is a small change.
- **Built in the site's own CSS,** without Tailwind, shadcn or a carousel library. No outside addresses (no Google Fonts, no analytics), so `_headers` doesn't change. The home page's colours and font live in its own file, not in `redesign.css`, so no other screen changes.
- **Section order:** fixed dark header (MNL name, links to the sections, "Entrar" or "Mi área" and "Cerrar sesión", the Calendly pill; a menu on phones) → hero (headline, subtitle, button, portrait) → scrolling strip → evidencia real (testimonial carousel, one card while only Andrea's quote exists, then the owner's own process) → mi historia as year cards → las 3 fases as cards → qué incluye (platform, accompaniment, bonuses) → the price section (big "3.500 €" pill, text, button; the closing slide's role) → preguntas frecuentes → "¿Ya eres cliente?" with "Entrar" → footer.
- **Text:** every current text stays word for word unless the build plan lists the change; nothing is invented. The second hero's sentences become the subtitle of mi historia.
- **Scrolling strip:** "Te acompañamos si eres:" with the four route names (20 Nov). The owner confirms or changes it.
- **The phone's bottom Calendly bar stays** (23 Nov), hidden while the price section is on screen.
- **Reduce motion:** with it on, the strip stops and nothing fades or slides; carousels still work with their buttons and by swiping.
- **Footer:** no Impressum/Datenschutz links until the law firm's texts exist; no social section unless the owner asks for one.
- The old scroll-motion files go; `design-hero/` stays as the reference of the earlier home page. The reference's measurements, without its content, are kept in `design-reference/landing-v2/SPEC.md`.

**Waiting for the owner:** photos (a portrait with the background removed for the hero, and one per milestone of mi historia); the strip's wording. Until then the build uses the photos already in the site.

## Changes on 23 Nov 2026 (late night): no animations on the home page

**Replaced on 24 Nov 2026 before it was built** (see above). Kept as a record.

Ivan's decision (23 Nov 2026): every animation on the home page goes, and scrolling it should be as easy as possible. This replaces "same text, order and scroll motion" (17 Nov evening) and "the look and the motion style stay" (23 Nov night). Text, order, colours, fonts, photos and the Calendly buttons stay as built in PR #38. The state map keeps its animations (it isn't the home page).

**To build** (details proposed by Claude, to confirm on the preview):
- **Plain scrolling only.** Nothing is pinned, nothing moves with the scroll, no rests (scroll that changes nothing), no snapping, no smooth-scroll code. Each section is as tall as its content, one after the other, in the same order: hero → "yo soy tu / ruta." → "mi historia." → second hero → "las 3 / fases." → qué incluye → evidencia real → closing slide → preguntas frecuentes.
- **The first hero** stays one screen tall (photo whole, design rule 1). Its arrow becomes a plain link that jumps straight to "yo soy tu / ruta.".
- **"mi historia.":** the "then" layout (bio, mis inicios, antes), then the "now" layout (hoy, después) under it.
- **The second hero:** both sentences shown together; no push.
- **"las 3 / fases.":** all three phases open in full, one row each, with their result; no rising, no shrinking, no choosing a phase. This settles "collapsed phases showing their result" (23 Nov night, open).
- **No circle:** no growing or closing circle anywhere.
- **No movement at all:** no entrance animations (words rising, the photo opening, the arrow nudging), and no transitions (menu, buttons, the FAQ's +/−, the phone bar). Hover colours change instantly. The page is the same with or without "reduce motion", which settles "a still version for reduced motion" (23 Nov night, open).
- **The justified headlines stay** (they are sizing, not motion).
- **The phone bar** works as before (shows once the first hero has scrolled away, hides while the closing slide is on screen), appearing and disappearing instantly.
- **A visible scrollbar on the home page** (proposed by Claude; Ivan can drop it): an exception to "hidden scrollbars" for this page only, so visitors see how long the page is and where they are, and can drag it with a mouse.
- The scroll-motion files that are no longer used are deleted; `design-hero/` stays untouched as the reference of the old motion.

