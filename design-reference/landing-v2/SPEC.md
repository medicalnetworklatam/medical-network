# Landing v2: the reference design, without its content

Ivan's own landing design (built for another client, not used by them), measured from its built CSS and HTML on 24 Nov 2026. Only the design is here: none of that client's texts, photos, names, prices, links or logos may be used. Sizes are in px at the usual 16 px root; "phone → desktop" means the value grows at the breakpoints 640 / 768 / 1024 / 1280.

## Tokens

| Name | Value | Use |
|---|---|---|
| teal | `#113B40` | dark sections, header (95 % with blur), footer |
| teal-dark | `#0F1F1C` | deepest backgrounds |
| cream | `#F6F0DF` | text on dark, primary buttons ("primary" in the reference) |
| teal-muted | `#4A7875` | second word of headings on light sections |
| mint | `#33DB95` | prices and small highlights only |
| card-dark | `#1A2E2B` | offer cards |
| testimonial card | gradient `#27272A` → `#18181B` | testimonial cards |
| light A | gradient to bottom right `#EAEDF2` → `#E5E9EE` → `#DFE4EA` | testimonials section |
| light B | gradient to bottom right `#CEE1DF` → `#D5E5E3` → `#C8DBD9` | offers section |
| dot grid | `radial-gradient(circle at 2px 2px, rgba(0,0,0,.05) 1px, transparent 0)` every 40 px, opacity .3 | over light A and B |
| shadow-card | `0 8px 32px -8px rgba(17,59,64,.2)` | primary button |
| shadow-elegant | `0 20px 40px -12px rgba(17,59,64,.4)` | button hover, header |

Dark sections: teal background with a soft dark fade at the top and/or bottom edge: a 128 → 160 px band from black 85 % via black 55 % to transparent. Light sections: light A or B plus the dot grid, and optionally a big faint mark centred behind the content (400 → 550 px, opacity .4).

Font: the reference uses Aeonik (headings) and Neutral Sans (text); both are commercial and not licensed for this site. Use Albert Sans (already self-hosted) for both.

## Layout

- Container: max 1280 px, side padding 16 / 24 / 32 px.
- Section padding: 80 px top and bottom, 128 px from 1024 px wide.
- Section heading (h2): 36 → 60 px, bold, centred; the last word(s) in teal-muted on light sections or cream on dark.
- Radii: cards 24 px, strip 16 px, buttons fully round.

## Components

**Header.** Fixed at the top, full width, 64 → 80 px tall, teal at 95 % with a background blur and shadow-elegant. Logo or name on the left (32 → 40 px tall). Links on the right from 1024 px: 12 → 14 px, medium, cream 80 %, hover cream 100 % with a faint cream 5 % background, 8 px radius. On phones: a menu button.

**Primary button.** Pill, cream background, teal text, 56 px tall, padding 24 → 32 px, 16 → 18 px medium, shadow-card; hover: 90 % background and shadow-elegant, 200 ms. **Secondary:** pill, 1 px border cream or white at 30–50 %, transparent; hover white 10 %. **Small card buttons:** 12 px semibold, padding 6 × 12 px, one filled white with black text and one outlined white 30 %.

**Hero.** Dark section, top padding 112 → 128 px (room for the header), bottom 0. Grid of 12 columns from 768 px: text in 7, picture in 5; stacked and centred on phones. Minimum height 60 vh → 65 vh → 70 vh. Headline: two lines in one h1: first part bold white 30 / 36 / 40 / 48 / 60 px, line height 1.1–1.15; second part regular cream 90 %, 20 / 24 / 26 / 30 / 36 px. Primary button under it. Picture: a portrait cut out from its background, aligned to the bottom of the section, max width clamp(280px, 36vw, 480px). Behind everything, a large faded copy of a photo at 80 % opacity (150 % wide centred on phones; 80 % wide, pushed 10 % past the right edge on desktop). A dark fade at the bottom edge.

**Scrolling strip.** Overlaps the hero's bottom and the next section's top by 24 → 32 px. Max width 1024 px, centred. Teal 90 % with blur, 16 px radius, 1 px border cream 20 %, a soft glow `0 0 40px rgba(163,230,53,.15)`, thin cream highlight lines on the middle half of the top and bottom edges. Inside: a label (cream, semibold, 14 → 16 px), a 1 × 24 px divider (from 768 px), then a row of items (cream 80 %, medium, 14 → 16 px) separated by "•" in cream 60 %, gaps 32 → 48 px. The row is doubled and moves left by 50 % in 16 s, linear, forever. On phones the label sits above the row.

**Testimonial carousel** (light A). Heading, then a track of cards 320 × 520 px, gap 24 px, centred on the current card. The current card is full size and opacity 1; the others are scale .8 and opacity .3. Card: testimonial-card gradient, 1 px border white 10 %, 24 px radius; top 35 % a photo (cover, top-aligned); bottom 65 % padding 24 px: the quote (14 px, italic, white 90 %, relaxed line height), then the name (18–20 px bold white) and the role (14 px white 60 %). Arrows from 1024 px: 56 px circles, white 80 % with blur, 1 px border black 10 %, shadow, 64 px outside the track; hover white, bigger shadow, scale 1.1, 300 ms. Under the track: dots (the current one a long bar). On phones: one card at a time, swipe with scroll-snap. A secondary button under the dots. Slide: transform, 500 ms ease-out.

**Year cards** (dark section, "who I am"). Heading right-aligned on desktop (30 / 48 / 60 px bold, the second part in cream), with an italic light subtitle under it (20 / 24 / 30 px, cream 80 %). A horizontal row of cards that scrolls sideways with snap and a hidden scrollbar: 208 × 288 px on phones, about 224 × 320 px on desktop, 24 px radius, the photo filling the card, a black 80 % → transparent fade from the bottom, and at the bottom left the year (24 px bold white) and a line (14 px white). Two 40 px round arrow buttons under the row on the right (outlined; the active one filled). A thin vertical line runs through the section. Under it, a centred paragraph (16 px, cream) with bold parts.

**Offer cards** (light B). Same carousel as the testimonials, cards 320 × 480 px: card-dark, 1 px border white 10 %, 24 px radius; top 35 % an image; bottom 65 % padding 24 px: title 20 px bold white, a price line 14 px semibold mint, text 14 px white 70 % (up to 6 lines), and at the bottom the two small card buttons side by side.

**Price section** (dark). Two halves from 1024 px: a picture on the left, aligned to the bottom and overlapping the next section by 32 → 128 px; on the right, right-aligned on desktop and centred on phones: the title, a subtitle (20 / 24 / 30 px medium, cream 90 %), then the price pill: 2 px white border, full radius, padding 16 × 32 → 20 × 48 px, the price 30 / 36 / 48 px bold. Under it a paragraph (16 → 18 px, cream 90 %, max 672 px), then the primary button.

**"Already a client" section.** A dark photo background with a horizontal black overlay (80 % → 70 % → 80 %), content centred, max 768 px: an 80 px circle (cream 20 % fill, 2 px cream 50 % border) with an icon, the heading (30 → 48 px bold white), a paragraph (18 → 20 px, white 80 %) with one highlighted part in cream semibold, a big pill button (20 px bold, padding 20 × 40 px, icon before the text, a large soft shadow), a small grey line (14 px, white 50 %), and a small outlined pill.

**Footer.** Teal, 64 px padding. Centred small links (12 px, cream 60 %) above a divider and the copyright line.

## Motion

- Fade-up when a block first enters the view: from opacity 0 and 22 px lower to its place, once.
- Carousels: 500 ms ease-out slides; round buttons scale 1.05–1.1 on hover.
- The strip: 16 s linear loop.
- With "reduce motion" on: no fade-up, no slide animation, the strip stands still; everything stays usable.
