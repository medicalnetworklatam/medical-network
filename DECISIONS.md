# MNL client area: decisions log

Last updated: 24 Nov 2026. This is the source of truth for the project. When a decision changes, update this file in the Claude project knowledge and in the code repository.

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
- **Section order** (as approved for the build, 24 Nov 2026): fixed dark header → hero (dark) → scrolling strip → Historias (light, carousel: Andrea's quote and the owner's own case) → Quién soy (dark, year cards) → Cómo funciona (light, the 3 phases as cards) → Qué incluye (light, 8 dark cards) → Ruta *Approbation* (dark, the price section; the closing slide's role) → Preguntas frecuentes (light) → ¿Ya eres cliente? (photo with overlay) → footer. The header and footer links follow this page order (Historias first).
- **Preview first, merge only on Ivan's word** (Ivan, 24 Nov 2026): the new home page is worked on only on its preview branch (`claude/brave-hypatia-i1tco6`) and its Cloudflare preview. Changes after a preview are new commits on the same branch. The pull request may be opened, but nobody merges it into `main` until Ivan says so, after Claude has checked the code. Claude Code never merges.
- **Text (changed later on 24 Nov 2026, Ivan):** the reference's copy is adapted to MNL too, not only its look: its flow, section ideas and phrasing, using only facts already on the site. The texts are in the copy deck `design-reference/landing-v2/COPY.md` (project doc `docs/landing-v2-copy.md`). The phase texts, everything in "qué incluye", Andrea's quote, the prices, "Dura unos 30 minutos. Sin costo.", "Tu homologación necesita una ruta", "Nos vemos en Alemania" and all 7 FAQ answers stay word for word. Every new sentence about the owner (year cards, bio, "con Iván Bruckner") needs his OK on the preview, since the page speaks as him.
- **Left out of the reference's copy on purpose:** "el único lugar" (an exclusivity claim, which German competition law, the UWG, only allows when provably true), "Hemos ayudado a:" (no list behind it), and the Salón de la Fama, conferences, podcast, social and WhatsApp-community sections (MNL has none yet).
- **Scrolling strip:** "Te acompaño si eres:" with the four routes (20 Nov), written as "Médico con título de fuera de la UE" etc. The owner confirms he takes all four.
- **All home page texts live in one file,** `src/content/home.ts`, like `contact.ts` and `diagnostico.ts`, so a text change touches only that file.
- **The phone's bottom Calendly bar stays** (23 Nov), hidden while the price section is on screen.
- **Reduce motion:** with it on, the strip stops and nothing fades or slides; carousels still work with their buttons and by swiping.
- **Footer:** no Impressum/Datenschutz links until the law firm's texts exist; no social section unless the owner asks for one.
- The old scroll-motion files go; `design-hero/` stays as the reference of the earlier home page. The reference's measurements, without its content, are kept in `design-reference/landing-v2/SPEC.md`.

**Build details** (Claude Code's plan, approved by Ivan on 24 Nov 2026):
- Five more Albert Sans files (500, 600, 700; 300 and 400 italic) from the official open-licence release, self-hosted; no new npm dependency.
- Heading words on light sections use a darker muted teal, `#376260` (at least 4.74:1), instead of `#4A7875`, which fails 4.5:1 there.
- The hero's background photo is blended into the teal (about 20 %) so cream text keeps at least 4.5:1; secondary text is at least white 72 %.
- The strip has a pause button ("Pausar la cinta" / "Reanudar la cinta") and also pauses on hover and keyboard focus (moving content longer than 5 seconds needs a way to stop it).
- Cards in a carousel grow to their longest text, all the same height. With one card, a carousel shows no arrows or dots. The year cards' arrows show only when the row is wider than the screen.
- On this page the phone layout and the bottom bar start below 768 px (the site's usual limit is 700 px). The header pill is 44 px tall.
- Headings use sentence capitals; the old lowercase titles and hidden full stops go. One h1; h2 per section.
- `CLAUDE.md` and `design-reference/README.md` get short notes about the new home page.
- **Background images** (Ivan's own, 24 Nov 2026, re-saved without hidden data in `src/assets/home-*.webp`): the dark grain behind the hero (instead of the faded house photo) and under "¿Ya eres cliente?" (instead of the building photo); a teal glow behind the hero portrait (seen once the owner's cut-out portrait is in); a faint mint "X" of light rays on the light sections; the dark teal streak behind the price section, on desktop only, where its light line runs behind the photo and never behind text (Ivan: no white line behind words; Claude chose the places, to confirm on the preview).

**Waiting for the owner:** photos (a portrait with the background removed for the hero, and one per milestone of mi historia); the strip's wording; his OK on the new sentences about himself. Until then the build uses the photos already in the site.

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

## Changes on 23 Nov 2026 (night): the home page sells

Ivan's decisions after the home page analysis (project doc `docs/home-page-analysis-2026-11-22.md`). They replace "same text, order and scroll motion" (17 Nov) for the parts below; the look and the motion style stay. The menu's "Aplicar a Ruta Approbation" (18 Nov) is replaced too.

**Built and merged on 23 Nov 2026 (PR #38),** after Ivan checked the preview himself. A copy of Andrea's WhatsApp screenshot, `testimonio-andrea.png`, uploaded by mistake to the repository's top folder and not used by the site, was deleted the same day.

- **One label for every Calendly button** (menu, new early button, phone bar, closing button): "Agenda tu llamada gratuita". Under the early and the closing button: "Dura unos 30 minutos. Sin costo." (the owner's call is free and about 30 minutes, relayed by Ivan).
- **An early button** under the text of "yo soy tu / ruta.".
- **A bar at the bottom of the screen on phones** (up to 700 px) with the same button. It appears once the first hero has scrolled away and hides while the closing slide is on screen. It never covers a photo where it is meant to be seen (design rule 1).
- **New order:** hero → "yo soy tu / ruta." → "mi / historia." → second hero → "las 3 / fases." → **qué incluye** → **evidencia real** → **preguntas frecuentes** → closing slide (headline, price, button). The circle that closes on the phases now opens onto "qué incluye"; the closing slide keeps its look and becomes the last section. The new sections scroll normally (not pinned) and use the ruled cells, never the rounded cards of the owner's old site (a rejected direction).
- **Qué incluye** (texts from the owner's current site, adapted):
  - Lead: "Acompañamiento durante todo tu proceso." / "No hay una duración fija: cada homologación avanza a su propio ritmo, y el acompañamiento sigue el tuyo."
  - **The platform, as the biggest point:** "Tu plataforma MNL": "Un área privada solo para clientes: tu expediente paso a paso según tu Bundesland y tu ruta, las novedades de tu estado, la Comunidad MNL, el chat de tu Bundesland, tus documentos y la herramienta para tu currículum. Incluye acceso gratuito a las nuevas herramientas que se desarrollen." (replaces the old bonus "Futuras plataformas"). The calendar isn't mentioned (still a preview).
  - "Agenda de videollamadas conmigo": "Para revisar avances, objetivos y próximos pasos." / "WhatsApp directo conmigo": "Para dudas y situaciones importantes." / "Acompañamiento en cada etapa": "Planificación, documentación y ejecución."
  - **Bonos incluidos:** "Guía de diagnóstico" (tiempos y costos aproximados del proceso), "Guía de alemán A1–B1" (ejercicios y prompts de IA), "Guía de preparación FSP" (material de apoyo para preparar la Fachsprachprüfung), "Cooperaciones" (curso de preparación FSP online desde tu país con perfectgerman, con 50 % de descuento, y posibilidad de una beca BAMF para un curso de preparación FSP al estar en Alemania; confirmed current by Ivan, 23 Nov 2026). WhatsApp and videollamadas aren't repeated as bonuses.
  - Closing line of the section: "Todo incluido: pago único 3.500 €."
  - **Colours on its first screen** (Ivan, 23 Nov 2026, after the first build): the lead "Acompañamiento durante todo tu proceso." on Para ti, the three points on Dato, Hecho and Para todos, each with its own text colour. An exception to "each colour has one meaning" (21 Nov, late), for this screen only. Alerta isn't used (it means "careful", which doesn't fit a selling point).
- **Evidencia real:** "Mi propio proceso de homologación" ("De mi llegada en 2015 a la Approbation en 2017, y después la especialidad.") with the owner's photo(s), and Andrea's testimonial: her three paragraphs as real text, word for word, plus her WhatsApp screenshot (number covered). Andrea agreed to be shown with her name, words and screenshot (Ivan, 23 Nov 2026). The operating-room photo is the owner's own (Ivan, 23 Nov 2026); its file carried keywords from a stock-photo upload tool, which are removed with the rest of its hidden data.
- **Preguntas frecuentes** (the owner's texts, word for word; native open/close rows, closed at first): ¿Haces el proceso de homologación por mí? / ¿Cuánto dura el programa? / ¿Me garantizas la homologación o un tiempo determinado? / ¿Cómo es el acompañamiento? / ¿Qué necesito para aplicar? / ¿Qué métodos de pago aceptas? / ¿Tengo derecho de desistimiento?
  - **Left out for now:** "¿Cómo accedo al precio especial?" (the workshop isn't on the page; it comes back when a workshop with a date is announced, and "cupos limitados" must be true then).
  - **The Widerruf answer is included as written,** by Ivan's choice (23 Nov 2026). This is an exception to "legal texts come from the law firm" (15 Nov): see "For the law firm". It names the Widerrufsbelehrung, which doesn't exist on the site yet, so it has no link until it does.
- **Shorter pauses** (30 % less): the "mi historia" rests (`--story-hold`) 50 → 35svh each; the rest before the phases 75 → 52.5svh (push spacer 160 → 137.5svh); the rest on the finished phases before the circle closes 75 → 52.5svh (closing spacer 195 → 172.5svh). The circle's own growth, the hero's rest and the rests between phases stay.
- **After the first preview** (Ivan, 23 Nov 2026):
  - The rest on "yo soy tu / ruta." before "mi historia" is 30 % shorter, twice: 50 → 35 → 24.5svh (`.hero-track__rest`).
  - The second hero's second sentence says "Por eso creé / Ruta Approbation" (without "la").
  - The four bonus cells stay a 2 × 2 grid on phones too.
  - Andrea's WhatsApp screenshot is removed; her name and words stay.
  - The closing slide ("Tu homologación / necesita / una ruta") moves before the FAQ, which becomes the last section. The phone bar hides only while the closing slide is on screen and shows again on the FAQ, which ends with room for it.
  - The four bonus cells use the same colours as the first "qué incluye" screen: Para ti, Dato, Hecho, Para todos.
  - Phase 02 ("documentación") gets more contrast: its tone goes from 55 % to 75 % cream (black text 4.7:1 → 9.0:1).
  - **Home header: only "Menú"** at the top right, logged in or not. "Entrar", or "Mi área" and "Cerrar sesión", are inside the menu. This replaces the header chips of 17 Nov (evening) and 18 Nov.
  - The photo captions "Mis inicios" and "Hoy, especialista" are on Para todos (orange).
  - **Andrea's testimonial comes first** in "evidencia real", before the owner's own process, as one big quote in a dark cell: only her last sentence ("Le recomendaría la asesoría con Iván…"), word for word, signed "Andrea" with the label "Cliente actual". Her first two paragraphs are no longer shown.
- **Not chosen for now** (open): a "who it's for" line on the first screen, collapsed phases showing their result, a still version for reduced motion, a smaller hero photo, and a footer with Impressum and Datenschutz (waits for the law firm).

## Changes on 22 Nov 2026 (evening): the diagnostic is the owner's sales tool

The owner's answers, relayed by Ivan on 22 Nov 2026. They replace "Diagnostic (to confirm): a public page" (20 Nov) and the "public page" in scope item 12.

- **The file to adapt:** the owner has only one file, the one that asks "¿Qué resultado espero del Bescheid?" (fees "verified on 30 Aug 2026"). The "¿Qué vía elijo?" version his Claude described doesn't exist as a file. This file is ported and then adapted (Ivan, 22 Nov 2026). A reference copy is kept in the Claude project (`cousin-tools/diagnostico.html`), not in the repository.
- **The vía question changes:** "¿Qué resultado espero del Bescheid?" becomes "¿Qué vía elijo?" (KP directa / Gutachten / aún no lo decido). How each answer changes the timeline and the budget comes from the owner's Claude; it is not invented on the site. Until then the port keeps the file's question and rules.
- **Only the owner uses it, on screen during his sales calls.** It is not a public page and not in the client column: it is an admin-only page. Clients and logged-out visitors never see it.
- **The PDF is handed over when the owner decides,** never automatically.
- **Fees:** only 5 Bundesländer have verified exam fees: Niedersachsen, Nordrhein-Westfalen, Rheinland-Pfalz, Saarland and Berlin (the owner's fee document of 31 Aug 2026, quoted by his Claude on 20 Nov). Baden-Württemberg was rechecked on 18 Nov 2026. The other 10 are "por re-verificar". The file still says every fee was verified on 30 Aug 2026; that text changes with the owner's update.
- **Before a PDF goes to a client** (proposed by Claude): the owner settles the vía rules, the verified fees and the two places where the diagnostic disagrees with the BW checklist (when the FSP can be taken; how long the Berufserlaubnis lasts; see the project doc `docs/cousin-tools-analysis-2026-11-18.md`).
- **Proposed by Claude, to confirm:**
  - Port now, faithfully: the content (questions, fees, phases, texts) in one data file and the calculation in one file with tests, so the owner's changes later only touch those two files.
  - Address `/admin/diagnostico`, opened by a third big button, "Diagnóstico", on `/admin`.
  - Nothing is stored, as today: the answers live only in the open page and are gone when it closes. No new table, no migration.
  - The PDF is made with the browser's print dialog ("Guardar como PDF"). When the owner decides to hand it over, he uploads it in that client's Documentos, so it shows in the client's Mis documentos. No new upload feature.
  - No Calendly button and no booking box ("Agenda tu videollamada gratuita…"): the call is already happening. This removes the law-firm item about Calendly (see "For the law firm").
  - Fees that aren't verified follow the file's own rule: shown as "a confirmar" with the reason, and left out of the total.
  - The browser tab title stays "Diagnóstico · Administración", never the prospect's name (the original file puts the name in the title), so names don't end up in the browser history. The owner names the PDF when he saves it.
  - The owner's Claude reads the printed PDF to fill in his client notes, so the report keeps the original labels and their order; only the look changes.
  - **Built as proposed and merged on 22 Nov 2026 (PR #36).** Same results as the original file. Colours as listed in the PR (Hecho for both "con sueldo" and "✓ hecho"), to be judged in use. Safari printing still to be checked on the iPad.
  - Known and accepted: the questions, the logic and the fee data are in the site's code, so anyone can read them in the public repository and in the code the browser downloads. Hiding the page stops nobody from reading that content. It contains no client data. Accepted like the checklist templates (20 Nov) until the repository is made private.

## Changes on 22 Nov 2026: a demo account to show off the client area

Ivan's decision (option A): a demo inside the live site, kept until launch, instead of a separate demo copy of the site.

- **One demo account only:** Ivan's own login on his personal email address (created 22 Nov 2026 with Supabase's "Invite user"; the address is kept out of this public file). Paid, Baden-Württemberg, route `medico_drittstaat` (the only route with a template), so every client screen has something to show. No other demo accounts: its Comunidad posts and chat messages only sit next to posts from the admin account ("Equipo MNL").
- **Its name is "Ivan Bruckner"** (Ivan's choice, 22 Nov 2026), shown as "Ivan B." in Comunidad and the chat. Known and accepted: the owner has the same name. A post keeps the name it was written with, so changing the name later on `/perfil` doesn't change old posts.
- **The `+prueba` test account stays** a test account, separate from the demo. Both are deleted before launch.
- **Every Comunidad post, chat message and news post that existed before the demo was set up was deleted on 22 Nov 2026** (all test content, the unpublished test news post included), once, before the demo script ran. This is not part of the cleanup below, and the demo's back-dated content (3–21 Nov 2026) is not "old" content. It can't be undone (the Free plan has no backups).
  - Posts and messages: in Supabase's SQL Editor, `delete from public.community_posts;` and `delete from public.news_posts;`. Deleting a news post also deletes its `news_attachments` rows. No other table depends on either table.
  - News files: deleted in Supabase's Storage screen (bucket `news-files`), never with SQL. Supabase blocks deleting stored files with SQL, and doing it would leave the files behind anyway. Afterwards the bucket is empty. (On 22 Nov 2026 the Storage screen deleted the buckets themselves, `news-files` and `client-files`, not only their files, and Supabase deleted their 7 access rules on stored files with them. The same day, both buckets were recreated in the SQL Editor with exactly the settings of migrations 5 and 8, and the 7 rules were recreated exactly as migrations 5, 6 and 8 left them; rls_check.sql showed ALL RLS TESTS PASSED. The two `client_documents` rows whose files were gone were deleted. Next time, empty a bucket instead of deleting it.)
  - This one-off cleanup is an exception to "no deleting news posts" (16 Nov); the news form still can't delete posts.
- **Cleanup before the friendly-client test or the first real client, whichever comes first:**
  1. As admin, delete the demo's files in its Documentos page first. A deleted login's files would otherwise stay in storage where no screen can reach them.
  2. Delete the admin account's demo posts in Comunidad and the chat.
  3. Delete the demo login in Supabase (Authentication → Users). Its profile, posts, messages, ticks, client layer and dudas go with it.
  4. Unpublish any demo news that isn't real news. News can't be deleted from the form.
- **Demo content is made by one SQL script** (pasted once in the SQL Editor; kept out of this public repository because it names the demo's email): 5 news posts (2 for Baden-Württemberg, 3 for all states), 4 Comunidad posts and 6 Baden-Württemberg chat messages from the demo and the admin, 11 ticks (blocks 1 and 2 done, about 50%), the client layer (country, header line, the Certificate of Good Standing as "No aplica", one note) and Mis dudas, all dated 3–21 Nov 2026. Chat and Comunidad messages are written as the demo or the admin, so the database still sets the names, "Equipo MNL" and the speed limit. Photos and PDFs are uploaded by hand in Administración (Supabase only accepts files through an upload). The news texts and the webinar of 9 Dec 2026 are made up for the demo: all 5 posts are unpublished in cleanup step 4 unless the owner keeps them.
- **No code change and no change to the database's structure** (tables, columns, rules): the demo is only content (rows), and the restored buckets and storage rules are identical to the migrations.

## Changes on 21 Nov 2026 (night, last): Comunidad as a feed, orange dudas, the progress ring

Ivan's requests after the second preview, from a sketch; the plan was approved by Ivan (option A for the colour).

- **Comunidad looks like a feed of posts, not a chat.** One readable column (about 760 px) under "tu / comunidad.", the same on a desktop, an iPad and a phone:
  - At the top, the post box: the member's initials in a circle, their shown name, the line about names, a 3-line text box, the "0 / 2000" counter and "Publicar".
  - Then one card per post, newest first: the author's initials in a circle (from the name the database shows: "José P." → "JP"), the name, "Equipo MNL" when it applies, the date, then the text. "Eliminar" is a quiet underlined word at the bottom right of the card, still only on one's own posts (every post for admins), with the same question inside the card.
  - "Actualizar" sits small above the posts; "Ver más" stays at the bottom. On a phone the feed leaves room at the end, so the floating chat link never covers a button.
  - Every board rule stays as in "Community" below (30 at a time, 2,000 characters, links, who may delete, free users, the reminder to choose a state). The state chat is unchanged.
- **The client's dudas are orange** (Para todos) on the admin Expediente page, but only when the client has written some; "Sin dudas escritas." has no colour. This is an exception to "Para todos = for everyone": on this one admin screen, orange also means "the client has written dudas" (Ivan, 21 Nov 2026, option A).
- **A progress ring** on the client hub's "Expediente" button: a faint circle that fills in Hecho green to the client's progress, with the % in the middle; small, next to the arrow, on a phone. Same sum as the status line ("no aplica" steps left out). No ring for a free client or when there is nothing to measure ("—"). Drawn already filled, without animation (motion is only tied to the scroll). Only for the eye: the status line says the same in words.

## Changes on 21 Nov 2026 (night, latest): the client pages redone, Publicar split up

Ivan's request after the first preview: the client pages should look and fit better on a desktop and on a phone, and Publicar should be split up like Clientes. Proposed by Claude and approved by Ivan the same night. What each section does stays the same; no database change.

- **Section pages** (a client's Estado, Expediente and Documentos; a post's two pages): a low title cell, the client's name or the post's title as the small label, "Actualizar" on the right of the title where there is one. The heading that repeated the page title is kept for screen readers only.
  - **Estado:** Estado | Ruta | Plan side by side, the current value big; each confirmation opens inside its column. Stacked on a phone, with the list and "Cambiar" on one line. Fits one screen.
  - **Expediente:** a column on the left (progress, country and header line, the client's dudas) that stays in view while the steps scroll by on the right. Stacked on a phone.
  - **Documentos** and a post's **Fotos y PDF:** adding a file on the left, the list on the right, one compact row per file. On a phone, adding first, then the list.
- **Publicar** (the button on `/admin` keeps its name):
  - `/admin/novedades`: a big "Nueva novedad" button, then every post as a table like the client overview (title, situación, date, Para, plan). A post's title opens its screen.
  - `/admin/novedades/nueva`: the form for a new post. Once saved, its "Fotos y PDF" page opens with a notice.
  - `/admin/novedades/<id>`: the post's title and two big buttons with a status line each: "Texto y publicación" (situación · date · Bundesland · plan) and "Fotos y PDF" ("2 fotos · 1 PDF", from counts only).
  - `/admin/novedades/<id>/texto` (the form; after a save the page stays on the post with "Guardada") and `/admin/novedades/<id>/archivos`.
  - Every post page checks the address is a valid ID and draws its section only once the post has loaded. Browser tab titles stay generic ("Novedad · Administración").
  - The news form's rules don't change (German time, schedule with a future date, unpublish instead of delete, only changed fields are sent). "Cancelar edición" goes: the back link does that now.

## Changes on 21 Nov 2026 (night, later): Administración as a set of simple screens

Ivan's decision, from his two sketches. It replaces the admin tabs and the single long client screen. What each section does, and every admin rule below, stays the same.

- **Easy to take in first.** The admin screens may bend the design rules where that makes the information easier to read (bigger buttons, plainer layout). The colour meanings (21 Nov, late), plain text for anything from the database, and the in-page confirmations stay.
- **`/admin`:** the title "administración." and two big buttons: "Clientes" → `/admin/clientes`, "Publicar" → `/admin/novedades` (the news form, unchanged). The column's "Administración" row keeps pointing to `/admin`.
- **`/admin/clientes`:** today's client overview (table, "Actualizar", the note on progress and last activity). A client's name opens their screen.
- **`/admin/clientes/<id>`:** the client's name as the title and three big buttons: "Estado, ruta y plan", "Expediente", "Documentos".
- **One page per button,** each with today's section, unchanged in what it does: `/admin/clientes/<id>/estado` (state, route, plan, with their confirmations), `/admin/clientes/<id>/expediente` (country, header line, the client's dudas, the steps with the client layer), `/admin/clientes/<id>/documentos` (upload and delete PDFs).
- **Proposed by Claude, to confirm on the preview:**
  - Back links instead of the two tabs: "← Administración", "← Clientes", "← <client's name>".
  - A one-line status under each client button: state · route · plan; progress %; number of documents. "Estado, ruta y plan" gets Alerta when a paid client has no state or no route, as in the overview.
  - Browser tab titles stay generic ("Cliente · Administración"), never the client's name, so names don't end up in the browser history of a shared computer.
  - Client names keep their capitals in the admin titles (Ivan, 21 Nov 2026).
- **No database change.** Every client page checks the address is a valid ID and loads only accounts that aren't admins, as today.

## Changes on 21 Nov 2026 (late): colour with meaning

Ivan chose these colours on 21 Nov 2026 from previews. This replaces "every colour comes from three values" (17 Nov) and "there is no red colour" (18 Nov). Black `#050505` and cream `#F3F0E9` stay the base.

- **Five colours, each with one meaning, the same on every screen:**
  - **Alerta** `#B72E1F`, cream text: careful, this can go wrong; or an admin has to act.
  - **Dato** `#DDD6C6` (sand), black text: a step's facts (Dónde, Plazo, Caduca).
  - **Hecho** `#87C454`, black text: progress and finished steps.
  - **Para ti** `#2B6786`, cream text: about this client personally, or their own Bundesland.
  - **Para todos** `#D6982E`, black text: for everyone.
- **Rules:**
  - Colours are only backgrounds (cells, boxes, tags, buttons), never coloured text and never a thin coloured line as the only signal.
  - Text on them is black or cream as above, each at least 4.5:1: cream on Alerta and on Para ti 5.4:1; black on Para todos 8.1:1, on Hecho 9.8:1, on Dato 14.1:1.
  - Labels, ticks and words stay, so colour never carries the meaning alone.
  - "No aplica" steps stay greyed, with none of these colours. Errors stay inverted black cells. The dark column is unchanged.
  - Exception: on the home page, the first screen of "qué incluye", the bonus cells and the "mi historia" photo captions use them as decoration (see "Changes on 23 Nov 2026 (night)").
- **Client screens:**
  - Mi expediente: "Atención" = Alerta. "Dónde", "Plazo" and "Caduca" = Dato. A ticked step's tick box, the "Avance del expediente" cell (no new bar), finished milestones, and a block tab whose block is fully done = Hecho. "Nota para ti" = Para ti (instead of black).
  - "Abrir el formulario del currículum" is a filled black button with cream text, at the top of Mi expediente and in step `p2`.
  - Novedades (list, full post, the phone's file-count box): posts for the reader's own Bundesland get Para ti on the date cell and the tag; "Todos los estados" posts get Para todos.
  - Chat: the reader's own messages = Para ti.
  - Calendar preview: the example events = Para todos. The separate calendar orange (`--event`) goes.
- **Admin screens:**
  - Client overview: "Sin estado" and "Sin ruta" cells of paid clients = Alerta; progress % gets a Hecho bar.
  - One client's screen: confirm buttons ("Sí, cambiar") = Alerta; "Hecho · <fecha>" on a step = Hecho; a chosen "Según la plantilla" = Para todos; a chosen "Aplica" / "No aplica" = Para ti; "Nota para el cliente" = Para ti; "Guardado." = Hecho.
  - News list: a state's tag = Para ti, "Todos los estados" = Para todos.
  - Delete confirmations elsewhere ("Sí, eliminar", "Sí, quitar" for a news file, "Sí, borrar todo" in the CV tool) = Alerta, for consistency.
  - Free accounts and everything else: no colour.
- **Dudas del cliente:** since 21 Nov 2026 (night, last), written dudas are orange (Para todos) on the admin Expediente page; see that section. A "new" marker would still need a database change (remembering when an admin last opened them). Revisit if the owner misses new dudas.
- All colours live in `src/styles/redesign.css`; changing one is a one-line edit.

## Changes on 21 Nov 2026 (night): Mis documentos

- **Mis documentos** is a login-only page, `/documentos`, in the column right after "Mi expediente". A paid client sees the files the team uploaded for them, newest first: name, date (German time) and "Abrir PDF" in a new tab. Free clients see "Mis documentos es para miembros con el paquete completo."; with no files: "Todavía no hay documentos para ti."
- **Only admins upload and delete,** on the client's admin screen, in a "Documentos" section. Clients never upload. Deleting asks for confirmation inside the page.
- **PDF only, up to 10 MB** (default until the owner says otherwise; allowing Word later is a small change).
- **Storage:** a private bucket `client-files`, files at `<client id>/<random uuid>.pdf` (the uploaded file's own name is never in the path). A table `client_documents` (client, path, file name, upload date). A client reads a file only when a `client_documents` row with exactly that path is theirs, enforced by the database on the table and on the stored files, as for news files. Shown through signed links valid 1 hour.
- **Known limit, accepted:** deleting a login removes its rows; its files stay in storage, invisible to everyone but admins. Signed links expire after 1 hour, so a page left open longer needs a reload to open a PDF. Files of a deleted login have no row, so no screen lists them.

## Changes on 21 Nov 2026: Mi expediente and the CV page

- **Mi expediente** is a login-only page, `/expediente`, in the column right after Novedades. A paid client with a state and a route sees their checklist. Otherwise one message: free → "El expediente es para miembros con el paquete completo."; no state → "Aún no has elegido tu estado." with "Elegir mi estado"; no route → "Tu ruta todavía no está asignada. Escríbenos si tienes dudas." with a link to Contacto; no template for their state and route yet → "Tu expediente todavía no está listo. Te avisaremos."
- **Placeholders:** `{pais}` is the client's country, or "tu país" when it's empty; `{genero:x|y}` follows the neutral rule (20 Nov); `{nombre}` is first name + last names; `{perfil}` is the header line, and the " · " after it goes when it's empty.
- **"No aplica"** (template default or client layer; the client layer wins) is shown greyed with its reason and can't be ticked. Reason: the client layer's, otherwise the template's.
- **Cover numbers:** only "Ahora mismo" and "Avance del expediente" for now. The two time estimates wait for the owner.
- The template's device-only "aviso guardado" card is replaced by: "Tus marcas se guardan en tu cuenta: las ves igual en el celular y en la computadora."
- **Mis dudas:** help text "Lo que escribas aquí lo revisa el equipo MNL antes de la próxima llamada."; saved with "Guardar"; shows when it was last saved.
- **Admin client layer** on the client's admin screen: country, header line, and per step "Según la plantilla / Aplica / No aplica", reason and note. Each step saves with its own "Guardar", without a confirmation step: an exception to "every change asks for confirmation", because each change is small and undone by going back to "Según la plantilla". State, route and plan keep their confirmation. The client's dudas are shown read-only with their date.
- **Progress %** in the client overview and on one client's screen leaves out "no aplica" steps of both kinds.
- **The CV tool** is a login-only page, `/curriculum`, not in the column. It opens from Mi expediente: a link at the top and one in step `p2`.

## Changes on 20 Nov 2026: the owner's tools join the client area

Based on the owner's own Claude explaining how he works today, and the Baden-Württemberg template it produced as JSON.

- **Five additions, all before the end of 2026** (Ivan, 20 Nov): a contact page, the checklist ("Mi expediente") built from the owner's templates, "Mis documentos", the CV and cover letter tool, and the diagnostic. They extend the first-version scope below.
- **Checklist = a template per Bundesland + route, plus a client layer** (Ivan, 20 Nov):
  - **Template:** the steps (block 1–5, official number, title, description, Dónde, Plazo, warning, Caduca, "no aplica" by default with its reason), the block titles and the info cards. Shared by every client on that Bundesland + route.
  - **Client layer,** set by admins on the client's admin screen: the client's country (`{pais}`), an optional header line, and for any step "aplica" / "no aplica" with a reason, and a personal note. A client reads only their own.
  - **Personal notes are their own box under the step,** never inside the template's sentences (20 Nov). The template's inline `{nota_personal}` markers are removed on import.
  - **"Mis dudas":** the client writes it; admins read it.
  - **Progress %** leaves out "no aplica" steps of both kinds (template default and client layer).
  - **The owner's generator rules are not copied into the site.** His Claude stays the place where the rules live; admins set the client layer by hand.
- **No gender field; neutral wording** (Ivan, 20 Nov). `{genero:x|y}` shows both forms, shortened when they differ only in the ending ("médico/a", "habilitado/a", "listo/a"), otherwise both in full ("Arzt/Ärztin").
- **Routes:** the owner's four route keys are our permanent route codes: `medico_drittstaat` (Médico · título de fuera de la UE), `medico_ue` (Médico · título de la UE, el EEE o Suiza), `dentista_drittstaat` (Dentista · título de fuera de la UE), `dentista_ue` (Dentista · título de la UE, el EEE o Suiza). The Berufserlaubnis is part of each checklist, not a route.
- **Step codes:** the owner's codes are not stable over time (they changed with the BW reform of 01/11/2026, and `b1` now means a different step). Our readable code is `<Bundesland>-<route>-<owner's code>`, e.g. `bw-medico_drittstaat-bw8`. Progress still uses the permanent ID.
- **Template updates:** same step with new wording → edited in place, ticks stay. A step that now means something else gets a new code, and the old step is archived. A step missing from a new version of the template is archived. Nothing is deleted.
- **Template content may be in the public repository** (Ivan, 20 Nov): the owner's JSON, with no client data. The repository will be made private later. Client data, real client checklists and access words never go in.
- **First template:** Baden-Württemberg, `medico_drittstaat`, with the post-reform rules (01/11/2026). More templates come from the owner in the same JSON format.
- **Mis documentos** (Ivan, 20 Nov): a private storage bucket with one folder per client. Admins upload on the client's admin screen; a client sees only their own files, through links valid 1 hour. Clients never upload. Same pattern as news files (migration 5). File types: pending the owner (default: PDF only).
- **Contact page** (to confirm): a login-only page in the column with WhatsApp and email links. No form, nothing stored. Anything in the site's code is public.
- **CV tool** (to confirm): a page in the client area, saved only on the device as today, with "copiar texto" to send. Not saved to the account. Checklist step `p2` links to it. "Mandárselo a Ivan" becomes "al equipo MNL" unless the owner prefers otherwise.
- **Diagnostic** (to confirm): a public page, also linked from the column. Nothing stored. PDF through the browser's print dialog (outside libraries are blocked by our security headers). Redesigned for Flatline. Waiting for the owner to confirm which version is live. (Replaced 22 Nov 2026 (evening): an admin-only tool for the owner's sales calls; see that section.)

## Changes on 18 Nov 2026 (evening): Novedades as previews, full post on its own page

- **The Novedades list shows previews.** Each post shows its date, tag, title and the start of its text, which fades out when the text is longer. The whole preview opens the full post. The text in a preview has no links (a link inside a link isn't allowed); the full post has them.
- **Full post on its own page,** `/novedades/<id>`, inside the shared column, with "← Novedades". It uses the same visibility as the list (RLS decides). A post the reader can't see and a post that doesn't exist show the same message, "No encontramos esta novedad.", so nothing is given away.
- **Files in the preview:** a square file area on the right of the preview, on phones too (smaller), filled by the number of files (Ivan, 18 Nov 2026, evening): 1 file fills the square; 2 files are a column of two tiles; 3 files show three tiles (top left, top right, bottom left) and a black tile with "3" in the bottom right; 4 files fill the 2×2 grid; more than 4 show the first three files and a black tile with the total number of files. Tiles show small photos or "PDF". Photos are cropped to squares in the file area only; the full post shows them whole.
- **On phones (up to 700 px), no file area in the preview** (Ivan, 18 Nov 2026, evening). Instead, a box above the post's tag ("Todos los estados" or the Bundesland) says how many files the post has, e.g. "3 fotos y 1 PDF". This replaces "on phones too (smaller)" in the bullet above; iPad and desktop keep the file area.
- **The whole preview box is clickable,** including the date cell, the faded text and the file tiles.
- **Small copies of photos, made automatically:** when an admin uploads a photo, the form also saves a small copy (about 480 px). The admin does nothing extra. Built in migration 6 (`thumb_path`); a small copy is readable exactly when its photo is. Supabase's on-the-fly resizing was considered and not chosen: it only works on the Pro plan (Ivan, 18 Nov 2026).
- Photos uploaded before migration 6 have no small copy and show a "Foto" tile.

## Changes on 18 Nov 2026 (afternoon): attachments, links, the shared column, posts and chat

- **Novedades posts can carry photos and PDFs** (Ivan's decision). This replaces "no photos" in news and settles the open decision on what a news post includes. Only admins attach files, in the news form; clients still never upload anything.
  - Photos (JPEG, PNG, WebP) and PDFs only. Never SVG or HTML.
  - Files live in a **private** Supabase Storage bucket. Each file is visible to exactly the people who can see its post (same state, paid-only and publish-date rules), enforced by the database (RLS on storage), never only by the website. The site shows them through short-lived signed links.
  - Photos are shrunk and re-saved in the browser before upload, which also removes hidden data such as the phone's GPS location.
  - Built in migration 5, with new checks in `rls_check.sql`. The Content-Security-Policy gets the Supabase project address in `img-src`.
  - **Build details** (Ivan, 18 Nov 2026):
    - Table `news_attachments` (post, kind `image`/`pdf`, path, file name, optional photo description used as alt text, order). Files are stored at `<post id>/<random uuid>.<jpg|png|webp|pdf>`; the uploaded file's own name is never in the path. Bucket `news-files`: private, 10 MB per file, JPEG, PNG, WebP and PDF only.
    - **A client reads a file only when it has a `news_attachments` row** with exactly that path and they can read that row (which follows the news rule). A file without a row (its row removed but the file not, or an upload whose row was never saved) is invisible to clients, also when listing a folder. Admins read every file in the bucket, so they can still delete such files.
    - **Flow in the admin form:** save the post first; after saving a new post the form stays open on it, with "Fotos y PDF" underneath. Files are saved at once, one at a time. Adding: upload the file, then add its row (if the row fails, the file is removed again). Removing: delete the row, then the file. Order with "Arriba" / "Abajo". At most 10 files per post, checked by the website only (only admins upload).
    - Photos are shrunk to 2000 px on the longest side and re-saved in the same type. A PNG still over 10 MB is refused with a message suggesting JPG. HEIC is refused with a Spanish message (Safari normally hands over a JPEG). PDF names over 200 characters are shortened, keeping ".pdf". A photo without a description is read as "Foto de la novedad «<título>»", never empty.
    - **Novedades:** photos inside the post, whole, never taller than the screen; tapping opens the full photo in a new tab. PDFs are a row with the name and "Abrir PDF", in a new tab. One request makes the signed links (valid 1 hour) for every file on the page.
    - **Known limits, accepted:** signed links expire after 1 hour, so after that a PDF or a full-size photo needs a page reload (photos already on screen stay). Deleting a post by hand in the SQL Editor leaves its files in storage, invisible to clients.
- **Links in text:** web addresses in Novedades, Comunidad and Chat become links: `http://` and `https://` addresses, addresses starting with `www.`, and bare domains whose ending is on a fixed list (com, org, net, info, eu, de, at, ch, es, ec, pe, co, mx, ar, cl, bo, ve, uy, py, gob, gov, edu; lowercase only, so "Alemania.De hecho" stays text). Addresses without `http(s)://` open as `https://`. Anything with "@" before the host (emails, disguised addresses) stays plain text (Ivan, 18 Nov 2026, option C).
- **The dark column is shared** by Novedades, Comunidad and Chat, in this order: Mi perfil, Novedades, Mi expediente, Comunidad MNL, Chat de <Bundesland>, Administración (admins only), Calendario, Contacto, Cerrar sesión. The current page is marked. The "← Novedades" links on Comunidad and Chat go. (Ivan gave the order; using the column on all three pages is Claude's reading of his answer, to be confirmed on the preview.) Contacto added 20 Nov 2026: a login-only page open to every logged-in user, title "equipo mnl" over "contacto.".
- **"Comunidad" is called "Comunidad MNL"** in the column and the browser tab title. The page heading stays "tu" over "comunidad.".
- **Calendar:** still a non-working preview labelled "Próximamente". It shows the current month and today's date (German time) and a few example events of one type, "Webinars / reuniones", in one event colour, with a small legend that says they are examples. This one colour is the only exception to "every colour comes from three values", and it is used only in the calendar. (Replaced 21 Nov 2026, late: the events use the "Para todos" colour; see that section.)
- **Novedades posts are redesigned** so each one reads as a separate post, not as lines of a log or chat. What the page shows and who sees what stay the same.
- **The state chat looks like a chat:** oldest at the top, newest at the bottom, the page opens at the newest message, the writing box stays at the bottom, own messages on the right and everyone else's on the left, older messages loaded at the top. This replaces "messages are newest first like the board" for the chat only. Comunidad stays a board, newest first. Every chat rule (length, deleting, speed limit, 20-second refresh, "Equipo MNL") stays the same.

## Changes on 18 Nov 2026: Flatline, and the whole site in the new look

- **Palette: Flatline is final** (black `#050505` on cream `#F3F0E9`). The palette switcher and the other four palettes are removed, and "Menú" on the home page becomes a real menu.
- **Every remaining screen moves to the new look, in one pull request:** the three login screens, `/perfil`, the state map page, Comunidad, Chat and the three admin screens, plus the loading and "Tu cuenta no está lista" screens. New layouts are allowed, as on the home page and Novedades. What each screen does, and every rule in this log, stays the same.
- **State map page:** the map keeps its exact shapes, sizes, animations, city search and behaviour. Only its colours, its fonts and the page around it change.
- **Admin screens:** full redesign, like the client screens.
- **The old look is removed** once every screen is redesigned: Figtree, Anton and the mint colours go, and the new look's background, colour and fonts become the site-wide default.
- **Home menu:** "Menú" opens a list with "Aplicar a Ruta Approbation" (the Calendly link, in a new tab) and "Entrar"; when logged in, "Mi área" and "Cerrar sesión" instead of "Entrar". The header chips next to "Menú" stay.
- **Errors** are shown as inverted cells (dark background, light text), as on Novedades. There is no red colour. (Replaced 21 Nov 2026, late: red now means "Alerta"; errors stay inverted cells.)
- **Title labels:** "tu" over "comunidad."; in the chat, "chat de" over the state name, or "tu" over "chat." when there is no state; "administración" over the admin titles. The headings' own words don't change.

## Changes on 17 Nov 2026 (night): Novedades in the new look

- **Novedades is redesigned** (the second screen after the home page). Ruled cells: a dark column on the left (profile, Comunidad, "Chat de <Bundesland>", Administración for admins, the calendar preview, "Cerrar sesión") and the news on the light side, one row per post (date | title and text). Everything the page did before stays.
- **The column no longer collapses on desktop.** The "Menú" button that opens and closes it is for phones only; there the column starts closed, as before. On larger screens it is always open.
- **Calendar label:** the calendar preview shows a small "Próximamente" label, so clients know it doesn't work yet.
- **Page heading:** "Novedades de <Bundesland>" (the state name in German, `lang="de"`, shown in lowercase with a full stop, "bayern.", through CSS only), or "Mis novedades" when no state is chosen. Screen readers hear the whole heading. The title's size comes from the name's longest word, so long names (Mecklenburg-Vorpommern, Niedersachsen) fit on a phone.
- **Floating chat link on phones** is hidden while the menu is open (the menu has the same link).

## Changes on 17 Nov 2026 (evening): the redesign starts

These replace the morning's "look and feel" bullet below where they differ.

- **The redesign starts now,** before the checklist screen, so that screen is built in the new look instead of being restyled later. Ivan decides the look.
- **The new home page** is Ivan's own plain-HTML prototype, kept in the repository in `design-hero/` (notes in `design-hero/HERO-NOTES.md`, rules in `design-hero/DESIGN-RULES.md`). It replaces the current home page (`/`), ported into React with the same text, order and scroll motion.
- **New layouts are allowed** on redesigned screens. This replaces "the redesign changes styles, not structure". What each screen does, and every rule in this log, stays the same.
- **Order:** the home page first, then Novedades, then every other screen (18 Nov 2026, see above). The state map keeps its shapes, sizes and behaviour; only its colours and fonts change.
- **Novedades:** new layout, with the left column redesigned from scratch. It keeps everything it has today: profile link and first name, Comunidad, "Chat de <Bundesland>", Administración (admins only), the calendar preview (still non-working), "Cerrar sesión", and the floating chat button on phones.
- **Fonts on redesigned screens:** Albert Sans for the big headlines, standing in for Aaux Next, a commercial font that isn't licensed yet (it needs a web licence before it can be used). Space Grotesk is used for everything else. Both are open-licence fonts and self-hosted. Since 18 Nov 2026 they are the site's only fonts: Figtree and Anton are removed.
- **Colours on redesigned screens:** every colour comes from three values (`--paper`, `--ink`, `--accent-rgb`). The palette is Flatline, chosen on 18 Nov 2026 (see above); the five-palette switcher on the home page's menu button is removed. (Replaced 21 Nov 2026, late: the three base colours plus five colours with a meaning; see that section.)
- **Design rules** (from `design-hero/DESIGN-RULES.md`): no photo is ever cut off by the edge of the screen where it is meant to be seen, and grids of cells fit on one screen (long ones are split into several screens).
- **Rejected directions** (don't go back to them): ruled "expediente" cards with D-DIN Condensed + Figtree; rounded white cards with petrol blue and numbered circles.
- **Home page header:** logged-out visitors see "Entrar" and "Menú". Logged-in visitors also see a "Mi área" link to Novedades, next to "Cerrar sesión", so they aren't stuck on the home page. "Menú" is a real menu since 18 Nov 2026 (see above).

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
- **Security Advisor warnings accepted for now:** 24-hour email links (chosen so invites don't expire overnight); leaked password protection (Pro plan only, turned on when switching to Pro). Supabase's own `public.rls_auto_enable()` gets its execute rights removed in the next small migration (done in migration 4, 17 Nov 2026).

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
  - The plain-HTML design mock-up in the repository `pinatryingtocode/medical-network` was a test. Its look was carried into React: colours, fonts, layouts and the state map. Since 18 Nov 2026 every screen is in the new look instead; the state map keeps its shapes, sizes and behaviour.
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
  - **Albert Sans** for the big headlines and **Space Grotesk** for everything else, on every screen (18 Nov 2026, see above). They replaced Figtree and Anton, the mock-up's fonts.
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
  - an "Entrar" / "Cerrar sesión" button is in the header of the home page and the state picker, and at the bottom of the column on Novedades. "Cerrar sesión" logs out this device only.
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
  - Address `/comunidad` ("Comunidad"), login only. Linked from the column on Novedades (the menu on a phone), with a "← Novedades" link back.
  - Members with no state can open it. They see "Aún no has elegido tu estado." with an "Elegir mi estado" link above the board.
  - Free users see only "La comunidad es para miembros con el paquete completo." The page makes no request for posts (the database refuses them anyway).
  - Posts are listed newest first, 30 at a time, with "Ver más" for older ones. "Ver más" asks for posts older than the last one shown (by `created_at`, then `id` for posts with the very same time), using `created_at` exactly as the database sent it, so no post is skipped or shown twice.
  - No realtime: the list loads when the page opens, after publishing, and with an "Actualizar" button. After publishing, the new post shows at the top and the list goes back to the newest 30.
  - Since 21 Nov 2026 (night, last) the board is shown as a feed of post cards; see that section.
  - Each post shows the author name, the date and time in the reader's own time zone (news dates stay in German time), and the body as plain text with its line breaks. Web addresses become safe links since 18 Nov 2026 (afternoon, see above).
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
- **Build details** (decided 17 Nov 2026, from the build plan): Novedades loses the fake chat column and gets a "Chat de <Bundesland>" link in the green column; the phone's floating chat button links to `/chat`. Messages were newest first like the board; since 18 Nov 2026 (afternoon) the chat shows the newest at the bottom, like a chat (see above). "Actualizar" reloads the newest 30, so deleted messages disappear. The speed limit counts posts that still exist, counting all of a member's own posts regardless of what they can see now. Old admin posts were marked "Equipo MNL" too. Known gap, accepted: two posts in the same chat within milliseconds can be missed by another member's automatic refresh until "Actualizar".
- **Migration 4** also removes execute rights on Supabase's `public.rls_auto_enable()` from the website's roles.

### Admin screens (decided 16 Nov 2026)

Since 21 Nov 2026 (night, later) these are split into separate screens, and since 21 Nov 2026 (night, latest) Publicar too; see those sections. What each one does stays as below.

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
  - progress % = ticked items ÷ non-archived items for the client's current Bundesland and route; "—" when the client has no state, no route, or there are no items yet. Since 20 Nov 2026, "no aplica" steps are left out (see the 20 Nov section).
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
  - `routes`: permanent short code, Spanish name, sort order, archived. Starts empty. The four route codes were decided on 20 Nov 2026 (see the 20 Nov section).
  - `followed_states`: user_id, Bundesland, for news. **Removed in migration 2 (15 Nov decision).**
  - `community_posts` (migration 2): id, author_id (deleted together with the author's account), author_name, body (plain text, 1 to 2,000 characters, trimmed), created date. The website sends only the body; the database sets everything else. Listed newest first. Migration 4 adds `state` (the Bundesland; empty = the board, sent by the website for chat messages) and `is_staff` ("Equipo MNL", set by the database): see "State chat".
  - `checklist_items`: permanent automatic ID (what progress uses), optional unique readable code (like `by-kp-010`, for humans and spreadsheet imports), Bundesland, route, title, text, sort order, archived
  - `progress`: user_id, item_id, done_at (set by the database)
  - `news_posts`: title, body (plain text), Bundesland (empty = all states), publish date, published, paid_only (ticked by default). Photos and PDFs attached to a post come with migration 5 (18 Nov 2026).
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
  - Migration 4 (`20261117120000_state_chat.sql`, chat per Bundesland, "Equipo MNL", speed limit, `rls_auto_enable()` rights removed) was applied on 17 Nov 2026. The automatic-RLS check passed and rls_check.sql showed ALL RLS TESTS PASSED (124 checks). PR #16 merged.
  - Migration 5 (`20261118120000_news_attachments.sql`, photos and PDFs in news: table `news_attachments`, private bucket `news-files`, rules on stored files) was applied on 18 Nov 2026. PR #23 merged.
  - Migration 6 (`20261118180000_news_thumbnails.sql`, small copies of photos: `thumb_path`, the read rule on stored files also covers small copies) was applied on 18 Nov 2026; rls_check.sql has 158 checks. PR #24 merged.
  - Migration 7 (`20261120120000_checklist_templates.sql`, routes, checklist template fields, client layer, client details, Mis dudas) was applied on 21 Nov 2026. rls_check.sql showed ALL RLS TESTS PASSED (210 checks). The BW template (26 steps) was loaded the same day. PR #27 merged.
  - Migration 8 (`20261121200000_client_documents.sql`, Mis documentos: table `client_documents`, private bucket `client-files`, rules on stored files) was applied on 21 Nov 2026. rls_check.sql showed ALL RLS TESTS PASSED. PR #30 merged.
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
9. A contact page (added 20 Nov 2026)
10. "Mis documentos": files admins upload for one client (added 20 Nov 2026)
11. The CV and cover letter tool (added 20 Nov 2026)
12. The diagnostic, as an admin-only tool for the owner's sales calls (added 20 Nov 2026 as a public page; changed 22 Nov 2026)

**Checklist content:** the owner has 7 Bundesländer × 4 routes in his own tools (Niedersachsen, Nordrhein-Westfalen, Baden-Württemberg, Bayern, Rheinland-Pfalz, Saarland, Berlin). Only Baden-Württemberg medico_drittstaat follows the rules in force since 01/11/2026; it is the first template on the site. The rest come from the owner as JSON templates (updated 20 Nov 2026).

**Out of the first version:**
- payment inside the site (clients pay through an external link; an admin switches the plan to paid by hand)
- file uploads by users (users will never upload files, not even in the community). Admins attaching photos and PDFs to news is in scope since 18 Nov 2026.
- private messages between members
- automatic account creation on payment
- legal texts (the law firm's job)

**Later:**
- real-time updates in the chat per Bundesland (the chat itself is built: see "State chat")
- possibly a calendar and alerts
- features for free users, if a use for them appears
- an admin screen to import checklist templates (until then, a script turns the JSON into SQL that Ivan pastes)

## Open decisions (suggested default in brackets)

- **Repository:**
  - The repository is public and owned by the company's GitHub organization.
  - Ivan's decision (13 Nov 2026): it stays public for now.
  - The plain-HTML mock-up now lives in `design-mockup/`.
  - The new home page prototype lives in `design-hero/` (17 Nov 2026). Everything in it is public, photos included.
  - The React + Vite + TypeScript version is merged into `main` (pull request #3) and live on Cloudflare Pages. GitHub Pages is turned off.
  - It will be made private later (20 Nov 2026); checklist templates may be in it until then.

- **What a news post can include:** decided 18 Nov 2026 (afternoon): title, plain text with automatic links, photos and PDFs (up to 10 files per post). No comments or likes.
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
- **Client documents ("Mis documentos"):** how long they are kept and how they are deleted.
- **CV tool:** saving it to the account would store health and family periods.
- **Diagnostic:** its Calendly button sends the visitor's answers to Calendly. (22 Nov 2026: only if the button stays; Claude proposed dropping it, since the owner uses the diagnostic during the call itself.) The owner types a prospect's answers into it during the call; nothing is stored, but the PDF he hands over contains them.
- **Home page FAQ "¿Tengo derecho de desistimiento?"** (added 23 Nov 2026, the owner's wording, included by Ivan's choice): check the answer (14 days, §§ 312g, 355 BGB) and write the Widerrufsbelehrung it refers to.
- **Testimonials:** Andrea's consent to her name, words and WhatsApp screenshot on the home page (given, per Ivan); how it is recorded. (Since 23 Nov 2026 only her name and words are shown.)
- **Timing** (suggested by Claude, not yet confirmed): done before the first real client gets an invite.
