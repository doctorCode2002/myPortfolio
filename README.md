# Mohammed Ashraf — Portfolio

Portfolio built on Next.js 16 App Router — Home, Projects, About, and Mentoring, served under a
locale prefix, with a warm terracotta design system. Bilingual English/Arabic support including full
RTL is implemented but currently switched off; see [Routing and i18n](#routing-and-i18n).

## Stack

- **Next.js 16.3.3** (App Router), deployed as a standard Vercel app — _not_ a static export
- **React 19**, **TypeScript** (strict, incl. `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`)
- **Tailwind CSS v4**, token-driven via `@theme inline`
- **motion/react** for entrance and layout animation, **Lenis** for smooth scroll
- **OGL** for the WebGL flow shader (page backdrop, contact card) and the hero portrait morph
- **next-themes** for the class-based dark mode with a view-transition reveal

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000 -> redirects to /en
```

| Command             | Description                |
| ------------------- | -------------------------- |
| `npm run dev`       | Dev server                 |
| `npm run build`     | Production build           |
| `npm run start`     | Serve the production build |
| `npm run lint`      | ESLint (flat config)       |
| `npm run typecheck` | `tsc --noEmit`             |
| `npm run format`    | Prettier                   |

## Routing and i18n

> **Arabic is currently switched off — the site is English only.** The full Arabic implementation
> (translations, RTL rules, fonts, routing) is intact and dormant. To turn it back on, see
> [Re-enabling Arabic](#re-enabling-arabic).

Every page lives under `app/[lang]/`, prerendered for each enabled locale by `generateStaticParams`
in `app/[lang]/layout.tsx`. `dynamicParams = false`, so an unknown locale 404s rather than rendering.

`proxy.ts` (Next 16's renamed middleware) reads `Accept-Language` and redirects any un-prefixed path
to the best matching locale — `/projects` → `/ar/projects` for an Arabic browser, `/en/projects`
otherwise. Its matcher deliberately excludes metadata routes (`apple-icon`, `icon`,
`opengraph-image`) because Next serves those without a file extension.

### Where content lives

The split matters:

- **`lib/content/*.ts`** — locale-neutral structure: image paths, external URLs, framework names,
  ratings, stat values, display order. Each entry has an `id`.
- **`app/dictionaries/{en,ar}.json`** — all prose, keyed by that same `id`
  (`dict.projects.items.khidmty.description`, `dict.mentoring.items.nour.quote`).

`Dictionary` is derived from `en.json`, so **a key missing from `ar.json` is a type error**, not an
`undefined` on the page. `npm run typecheck` is the translation-completeness check.

Pages `await params`, call `getDictionary(lang)`, and pass `dict` + `locale` down as props. Client
components (`Nav`, `ContactButton`, `ActionRow`, `PortraitMorph`) receive strings as props — never
import a dictionary in a client component.

### Adding a string

1. Add the key to `app/dictionaries/en.json`.
2. Run `npm run typecheck` — it will fail until `ar.json` has the same key.
3. Add the Arabic, then read it from `dict.<path>`.

### The /about page

`app/[lang]/about/page.tsx` composes five sections from `components/about/`: a polaroid strip,
the bio card, an expandable Experience timeline, an Education list, Skills pills, and a Matter.js
physics Stack.

**`public/assets/CV.pdf` is the source of truth** for the Experience and Education entries. Structure
lives in `lib/content/about.ts`; every string — org names, roles, periods, qualifications — is in
`aboutPage.*` in the dictionaries, because periods contain translatable words ("Present",
"Expected") and institution names transliterate.

The three technical certificates (Meta Front-End, Intro to AI with Python, Data Structures &
Algorithms) are folded into the Education list rather than getting their own section. The four
non-technical ones on the CV (Amideast, American Consulate, IBC, TebFact) are deliberately omitted.

Stack chip icons are **vendored** in `public/icons/` rather than fetched from `cdn.simpleicons.org`
at runtime, so the page makes no third-party request. To add one:

```bash
curl -s -o public/icons/<slug>.svg "https://cdn.simpleicons.org/<slug>"
```

Then add a `STACK_CHIPS` entry. Chip backgrounds must clear 4.5:1 against white — JavaScript and
Tailwind's official brand colours don't, so they use darkened variants (`#7d6c00`, `#16759e`).

`matter-js` is dynamically imported inside the Stack section, so it never loads on other routes, and
it is skipped entirely under `prefers-reduced-motion` (a static chip list renders instead).

### Adding a project

1. Append to `PROJECTS` in `lib/content/projects.ts` with a new `id` (order = display order; the
   home page features the first `FEATURED_COUNT`).
2. Drop the screenshot in `public/assets/projects/` — roughly 16:9.
3. Add `title` + `description` under `projects.items.<id>` in both dictionaries.

### Re-enabling Arabic

Three uncomments, all of them adjacent to a note saying so:

1. **`lib/i18n.ts`** — uncomment `"ar"` in `LOCALES`, and the `ar` entries in `HTML_LANG`,
   `OG_LOCALE`, and `LOCALE_LABEL`.
2. **`app/[lang]/layout.tsx`** — uncomment the `IBM_Plex_Sans_Arabic` / `Noto_Kufi_Arabic` import,
   the two font loaders, and their two entries in `FONT_VARS`.
3. Run `npm run build`.

Nothing else needs touching. Routes, `generateStaticParams`, the sitemap, hreflang alternates, the
`Accept-Language` redirect in `proxy.ts`, and the nav's language switch all derive from `LOCALES` —
the switch hides itself while only one locale is enabled and reappears on its own.

`app/dictionaries/ar.json` and the `[dir="rtl"]` rules in `globals.css` were left untouched. The
Arabic translations stay shape-checked against `en.json` through `getArabicDictionary()` in
`app/[lang]/dictionaries.ts`, so `npm run typecheck` still catches a missing Arabic key while the
locale is dormant.

The Arabic fonts are commented out rather than left unused on purpose: `next/font` downloads and
self-hosts every family it is handed, so leaving them declared would ship two Arabic families no
page renders.

## RTL

`<html dir>` is set per locale. Components use logical properties (`ms-`/`me-`, `ps-`/`pe-`,
`start-`/`end-`, `text-start`) rather than physical ones; directional icons carry
`rtl:-scale-x-100`.

Two Arabic-specific rules live in `globals.css` under `[dir="rtl"]`:

- **Fonts swap** — `--font-sans` → IBM Plex Sans Arabic, `--font-serif` → Noto Kufi Arabic, with the
  Latin stack behind them so inline product names (React, Next.js) keep their own shapes.
- **Typography resets** — `letter-spacing: normal` (the template's pervasive `tracking-tight`
  mangles joined script) and looser `line-height` (Arabic stacks diacritics above the ascender;
  headings clip below ~1.4).

Use `.latin` on any Latin run inside Arabic prose that needs LTR isolation.

The site-frame corner glyphs are pinned with physical `left`/`right` and sit in fixed viewport
corners — they are correct in both directions and must **not** be flipped under RTL.

## Design tokens

Defined in `app/globals.css`, exposed to Tailwind through `@theme inline`.

| Token                | Light     | Dark      |
| -------------------- | --------- | --------- |
| `--background`       | `#f5f2e9` | `#14110f` |
| `--foreground`       | `#14110f` | `#ede7dc` |
| `--muted-foreground` | `#6b625a` | `#9a9086` |
| `--accent`           | `#ab4c24` | `#e0703c` |
| `--border`           | `#e0d9cb` | `#2a2521` |

The light accent is deepened from the brand `#c0562a`: on cream that tone is 4.07:1, which fails
WCAG AA for the eyebrow labels and accent links. `#ab4c24` reads as the same terracotta at 4.95:1,
with white-on-accent at 5.27:1. **The decorative WebGL shader still uses the brighter `#c0562a`** —
it carries no text, so it keeps the original brand tone.

Accent use is deliberate and limited to: primary CTA, focus ring, active nav pill, accent links,
project-card hover border, the mentoring index numerals, and the shader's high stop.

## Open items

- **The Frontend Instructor role on /about is a placeholder.** The CV doesn't list it, so its `org`
  and `period` in `aboutPage.experience.instructor` (both dictionaries) read `TODO`. The /mentoring
  page presents it as a 40-hour program with seven named students, so it should get real values.
- **`public/portrait-alt.webp` is a copy of `public/portrait.webp`.** The hero's hover morph has
  nothing to morph to until a second pose replaces it — same framing and crop, 2752×1536.
- **Arabic testimonials and student reviews are translations** of the English originals. The
  students almost certainly wrote them in Arabic first; replace the quotes under
  `testimonials.items` and `mentoring.items` in `ar.json` with their own wording. The `_note` key at
  the top of that file says the same.
- The OG share card (`app/[lang]/opengraph-image.tsx`) is Latin-only for both locales, on purpose:
  Satori does not shape Arabic script, and unshaped Arabic renders as disconnected letterforms.
