# design-reference/

Original files from the owner, kept **as a reference only** (like
`design-mockup/` and `design-hero/`). Don't edit them or build on them, and
the website never loads them.

- `curriculum-original.html`: the owner's CV and cover letter tool, as he
  used it before the client area (a blank form, no client data). It loads
  Google Fonts, which the site doesn't allow. The site's version is the page
  `/curriculum` (`src/pages/Curriculum.tsx`, logic in `src/lib/curriculum.ts`),
  which keeps its fields, gap check and produced text exactly.
- `landing-v2/`: the home page's reference since 24 Nov 2026 (DECISIONS.md,
  "Changes on 24 Nov 2026"). `SPEC.md` holds the measurements of Ivan's
  own landing design (without the other client's content); `COPY.md` is
  the copy deck the page's texts come from (`src/content/home.ts`). Unlike
  the other files here, these two are kept up to date with the page.
