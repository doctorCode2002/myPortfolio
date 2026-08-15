# Product Requirements Document (PRD)
## Next.js Migration — move the Vite/React portfolio to Next.js App Router for SEO

## 1. Overview

### 1.1 Problem Statement
The portfolio (`myPortfolio`) is a Vite + React 19 single-page app. All markup is generated
client-side: `index.html` ships an empty `#root` div and a `<script type="module" src="/src/main.jsx">`.
Search engines and social-share crawlers that don't execute JS (or execute it poorly) see no
content, no per-section metadata, and no structured data beyond what's hardcoded once in
`index.html`. The site is otherwise complete and content-stable (projects, testimonials, mentor
stats, reviews all live in `src/constants/index.js`), so the fix is architectural, not content
work.

### 1.2 Goals
- Real HTML content in the initial server response (`view-source:` / `curl /`, not just DevTools'
  post-hydration DOM) for every current section: Hero, Services, About, Work, Feedback,
  MentorProfile, StudentReviews, Contact.
- Per-page metadata via the Next.js Metadata API (title, description, canonical, OG, Twitter),
  replacing the static tags in `index.html`.
- `sitemap.xml`, `robots.txt`, and `Person`/`ProfilePage` JSON-LD structured data (the current
  `index.html` already has a `Person` JSON-LD block to carry forward and extend).
- Preserve the app's current look, animation, and interaction behavior exactly — this is an SEO/
  architecture migration, not a redesign. Lenis smooth scroll, GSAP `ScrollTrigger` animations,
  the asset-loading progress screen, and all existing UI/UX behavior must survive unchanged.
- Improve Core Web Vitals opportunistically where the framework swap makes it nearly free
  (`next/font` for Inter/Playfair instead of a render-blocking Google Fonts `<link>`), without
  turning this into a broader performance project.
- Ship on Vercel as a static export (see 1.3) so hosting stays as simple as today.

### 1.3 Non-Goals (explicit MVP exclusions)
- **No information-architecture change.** The site stays one scrolling page with anchor links
  (`#work`, `#contact`, etc.) exactly as today. No section becomes its own route
  (e.g. no `/work/[slug]` project pages). Existing anchor URLs must keep working.
- **No server-rendered/dynamic content.** Static export (SSG) is the target rendering mode —
  content is 100% static today (`constants/index.js`) and there is no near-term plan for a CMS,
  database, or per-request personalization. If that changes later, moving off static export is a
  separate future project, not part of this one.
- **No visual redesign.** Colors, type, spacing, animation timing, and copy are unchanged unless a
  migration constraint forces a specific, minimal adjustment (called out during planning, not
  invented silently).
- **No conversion of preview images to `next/image`.** GSAP measures the existing `.webp` bento/
  project images for layout math; swapping to `next/image` risks fighting those measurements for
  a CWV gain that isn't the point of this project. Revisit separately if desired later.
- **No new content, sections, or copy changes.** Content migrates as-is from `constants/index.js`.
- **No i18n.** Single locale, English — unchanged from today.
- **No auth, accounts, forms-with-backend, or database.** The Contact section's existing behavior
  (whatever it currently does — links/mailto, no server-side form handling) is preserved as-is.

## 2. User Roles
Single implicit role: **site visitor** (anonymous, public). No accounts, no admin surface, no
permissions matrix — omitted as N/A.

## 3. Functional Requirements
- Every section currently rendered by `src/App.jsx` (`Navbar, Hero, Services, About, Work,
  Feedback, MentorProfile, StudentReviews, Contact`) renders with real content present in the
  server-generated HTML, not only after client hydration.
- The asset-loading progress overlay (tracks images + videos + `window load`, documented in
  `CLAUDE.md`) keeps working, and — critically — must not gate whether section content exists in
  the DOM/SSR output. (Today it only toggles a CSS `invisible` class on an always-mounted
  subtree; that behavior must be preserved, not replaced with conditional mounting, or the SEO
  goal of this project is silently defeated.)
- Lenis smooth scrolling, wired into GSAP's ticker and `ScrollTrigger.update`, keeps working
  exactly as today (`src/context/LenisContext.jsx`, `src/lib/gsap.js`).
- All GSAP `useGSAP()` scroll animations continue to use `ScrollTrigger`; none regress to native
  scroll-event listeners.
- Anchor-link navigation (`Navbar` → section IDs) keeps working, including the `scroll-margin-top`
  offset in `src/index.css` that keeps the fixed navbar from covering the target section.
- `<Analytics />` from `@vercel/analytics/react` keeps working unchanged (import path is the same
  under the App Router).

## 4. Surface Breakdown
Single route: `/` (the whole current single-page experience). Supporting non-page surfaces to add:
- `app/sitemap.js` (or `.ts`) — generates `sitemap.xml` for `/`.
- `app/robots.js` (or `.ts`) — generates `robots.txt`.
- `app/layout.jsx` — root metadata (title, description, canonical, OG, Twitter, `metadataBase`,
  `Person`/`ProfilePage` JSON-LD), fonts via `next/font/google`.
- `app/page.jsx` — the migrated single-page content (composition of the existing sections).

## 5. Data Model
No new data model. `src/constants/index.js` (nav links + preview images, projects, testimonials,
mentor stats, student reviews, contact links) is the single source of content and migrates as-is.

## 6. Recommended Tech Stack
- **Framework:** Next.js (App Router), static export (`output: 'export'` or equivalent SSG
  config) — confirm exact Next.js version and export mechanism during `/speckit-plan`.
- **Styling:** Tailwind CSS v4, switching build integration from `@tailwindcss/vite` to
  `@tailwindcss/postcss` (Vite's plugin doesn't apply under Next's webpack/Turbopack build). The
  `@theme` block in `src/index.css` — including `--color-white: #e5e5e0` and the font tokens —
  and the Lenis CSS rules (`html.lenis`, `.lenis.lenis-smooth`, etc. — load-bearing per
  `CLAUDE.md`) must carry over unchanged into the Next global stylesheet.
- **Fonts:** `next/font/google` for Inter and Playfair Display, replacing the `@import
  url(fonts.googleapis.com/...)` in `src/index.css`. Wire the resulting CSS variables into the
  existing `--font-sans` / `--font-serif` theme tokens rather than renaming them at every call
  site.
- **Animation:** GSAP + `@gsap/react` (`useGSAP`), Lenis — unchanged libraries, ported as Client
  Components. Every component using `useGSAP`, `gsap`, `ScrollTrigger`, `useLenis`, `window`/
  `document`, or `react-fast-marquee` needs `"use client"` at the component level — apply this
  per-component (currently: `Work`, `StudentReviews`, `Services`, `StudentReviewCard`, `Navbar`,
  `MentorProfile`, `Hero`, `Contact`, `BentoGallery`, `MaskText`, plus `LenisProvider` and the
  root page-shell component holding the progress-loader state), not as a single blanket directive
  on the root layout — a blanket `"use client"` at the top of the tree is the specific mistake
  that silently defeats the whole SEO goal of this migration and must be avoided.
- **Lint:** swap `eslint-plugin-react-refresh` (Vite-specific) for `eslint-config-next` so `npm
  run lint` keeps working under Next.
- **Removed:** `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `index.html`,
  `vite.config.js`, `src/main.jsx`.
- **Migration approach:** in place, in the current repo/branch (`feature/nextjs-migration`) —
  not a fresh `create-next-app` scaffold merged in later. At this component count the in-place
  diff is small enough to review directly.
- **Assets:** `public/assets/**` map through unchanged; absolute references like
  `/assets/bgvideo.mp4` keep working under Next's `public/` convention with no path changes.
- **Deploy target:** Vercel, static export — hosting model stays close to today's.

## 7. Visual Identity
Unchanged — carry over the current design system as-is (see 1.3, Non-Goals). No new design work.

## 8. File & Data Handling
N/A — no uploads, no user-submitted data, no backend.

## 9. Internationalization
N/A — single locale, English.

## 10. Non-Functional Requirements

### 10.1 Security
No new attack surface (still a fully static site, no forms-with-backend, no auth). Nothing
beyond what a static Next.js export already provides.

### 10.2 Performance
No regression versus the current Vite build; `next/font` swap and static export should be a net
Core Web Vitals improvement (no render-blocking Google Fonts request, precompiled HTML). Not a
performance-optimization project beyond what falls out of the framework swap — no image-pipeline
rework, no bundle-splitting initiative.

### 10.3 Accessibility
No regression versus current markup/semantics. Not an accessibility audit project — carry
forward whatever the current implementation does.

### 10.4 Browser/device support
Unchanged from today — whatever the current Vite build effectively supports (evergreen
browsers); no new target matrix.

## 11. Permissions Matrix
N/A — single anonymous-visitor role.

## 12. Notifications & Real-Time Behavior
N/A — fully static content, no live updates.

## 13. Out of Scope (Explicit Exclusions)
- Multi-route/IA redesign (project detail pages, blog, etc.)
- `next/image` conversion for GSAP-measured images
- Visual/design refresh
- CMS or database-backed content
- i18n / additional locales
- Any new backend functionality for the Contact section

## 14. Effort, Timeline & Budget Reference
Not requested — omitted.

## 15. Risks & Open Items
- **Primary risk (the one this whole project can silently fail on):** a technically-passing
  migration that ships a client-rendered SPA wearing a Next.js costume — e.g. a blanket
  `"use client"` boundary too high in the tree, or GSAP/Lenis components wrapped in
  `dynamic(() => import(...), { ssr: false })` to dodge SSR crashes from `window`/`document`
  access. Both build fine, look fine in DevTools, and ship **zero** SEO gain. **Acceptance
  criterion, not a nice-to-have:** `curl` (or View Source) of the production static export's `/`
  must contain actual section copy — project titles, testimonial text, mentor stats — in the raw
  HTML response, not just a loader shell or empty root div.
- **`output: 'export'` compatibility:** confirm during `/speckit-plan` that every dependency
  (GSAP, Lenis, `@vercel/analytics/react`, `react-fast-marquee`) works cleanly with Next's static
  export mode (no server-only APIs relied on anywhere in the current codebase — expected to be
  fine given the app has no backend today, but verify explicitly).
- **Progress-loader semantics:** confirm the ported version keeps gating only *visibility*
  (CSS `invisible` class) rather than conditional mounting, per the Functional Requirements note
  in §3.
- **Domain/canonical URL:** `index.html` currently hardcodes `https://mohammedabutaleb.com/` in
  canonical/OG/JSON-LD tags — confirm this is still the correct production domain for
  `metadataBase` before finalizing metadata.

## 16. Glossary
- **SSG / static export** — Next.js builds fully static HTML/CSS/JS at build time
  (`output: 'export'`), no Node.js server required at runtime.
- **App Router** — Next.js's file-system router under `app/`, with Server Components by default
  and explicit `"use client"` opt-in for interactive/browser-API components.
- **RSC** — React Server Components; components that render to HTML on the server/at build time
  and ship no JS to the client unless marked `"use client"`.
