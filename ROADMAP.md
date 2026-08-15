# Roadmap — Next.js Migration

Source: `PRD_NextJSMigration.md`. Each phase after Phase 0 maps to exactly one Spec Kit feature
under `specs/NNN-feature-name/` (gitignored — planning artifacts don't reach the remote; only
this file and the PRD are tracked as the durable source of truth).

Cross-cutting rules every phase's spec must restate:
- Single route (`/`), no IA change, no new routes.
- Static export (SSG) target — no server rendering, no dynamic data.
- No visual/design changes; preserve current look, motion, and interaction exactly.
- `"use client"` applied per-component, never as a blanket boundary at the root layout/page —
  this is the one mistake that silently defeats the whole project (see PRD §15).
- No AI attribution in any commit, PR description, or code comment (repo convention).
- `.claude/`, `.specify/`, `specs/`, `graphify-out/` stay gitignored on every branch.

## Phase 0 — Constitution & guardrails
**Goal:** Establish project principles and repo conventions before any migration code is written.
**Scope:** Run `/speckit-constitution` directly (no spec/feature). Encodes: no-AI-attribution
rule, static-export/no-IA-change/no-redesign constraints from the PRD, and the "`use client`
per-component, not blanket" rule as a binding principle so later phases can't drift from it.
**Exit criteria:** `.specify/memory/constitution.md` exists and reflects the rules above.
**Depends on:** nothing.
**Status:** Done — `.specify/memory/constitution.md` v1.0.0 ratified.

## Phase 1 — Next.js foundation
**Goal:** Replace the Vite toolchain with Next.js App Router + static export, with the site's
visual/theme foundation (Tailwind v4 theme tokens, fonts, base metadata) working end to end, even
before every section is ported.
**Scope:**
- Scaffold `app/` (root `layout.jsx`, minimal `page.jsx`), Next.js config for static export.
- Swap `@tailwindcss/vite` → `@tailwindcss/postcss`; carry the `@theme` block (incl.
  `--color-white: #e5e5e0`, font tokens) and the Lenis CSS rules from `src/index.css` into the
  Next global stylesheet unchanged.
- `next/font/google` for Inter + Playfair Display, wired into the existing `--font-sans` /
  `--font-serif` tokens.
- Root metadata shell in `app/layout.jsx` (title, description, canonical, OG, Twitter,
  `metadataBase`) ported from `index.html`'s current tags.
- `eslint-plugin-react-refresh` → `eslint-config-next`.
- `package.json` scripts updated (`dev`/`build`/`start`/`lint`) for Next.js.
**Exit criteria:** `npm run build` produces a static export; `npm run dev` serves a page with
correct fonts/theme/colors and metadata present in the raw HTML response (`curl` check); `npm run
lint` passes.
**Depends on:** Phase 0.
**Status:** Done — implemented via `specs/001-nextjs-foundation/` (spec/plan/tasks). All exit
criteria verified: build produces a static export with real metadata and content in the raw HTML,
dev server renders correct theme/fonts (confirmed in-browser), lint passes clean, no Vite files or
dependencies remain.

## Phase 2 — Section migration
**Goal:** Port every current section (Navbar, Hero, Services, About, Work, Feedback,
MentorProfile, StudentReviews, Contact) into the Next.js app with identical behavior — Lenis
smooth scroll, GSAP `ScrollTrigger` animations, the asset-loading progress overlay, anchor-link
navigation — and correct, per-component `"use client"` boundaries.
**Scope:** Port `src/context/LenisContext.jsx`, `src/lib/gsap.js`, and all `src/components/*`
into the Next app; wire `constants/index.js` content through unchanged; preserve the progress
overlay's current semantics (CSS `invisible` toggle on an always-mounted subtree, not conditional
mounting — PRD §3/§15).
**Exit criteria:** Full single-page site renders and behaves identically to the current Vite app
(manual side-by-side check); `curl`/View Source of the static export's `/` contains real section
copy (project titles, testimonial text, mentor stats) in the raw HTML, not just a loader shell.
**Depends on:** Phase 1.
**Status:** Done — implemented via `specs/002-section-migration/`. All 9 sections ported with
per-component `"use client"` boundaries (verified via grep audit, zero `ssr: false` anywhere);
full raw-HTML content check passed; live browser walkthrough (desktop + mobile) confirmed no
regression in Lenis scroll, GSAP animations (Services pin, Work hover preview, BentoGallery Flip,
StudentReviews pin-scroll/mobile scroll-snap, Contact stagger), and nav/anchor navigation. Fixed
7 bugs total: the 5 pre-identified ones below, plus two found live during implementation — a
`servicesImg` instance of the same absolute-import bug missed in the original review, and a real
SSR hydration mismatch in `StudentReviews.jsx` (`isMobile` state read `window.innerWidth` in its
`useState` initializer, diverging from the server's render) caught by Next's dev overlay on a
mobile-viewport check. Also fixed, while touching the same files: missing
`rel="noopener noreferrer"` on `target="_blank"` links in `Work.jsx`/`Contact.jsx`.

**Known issues to resolve in this phase (found during Phase 1 verification):**
- `src/constants/index.js` imports images via root-absolute specifiers (e.g. `import civicMind
  from "/assets/projects/civicMind.webp"`, 9 occurrences). This resolves under Vite (which maps
  root-absolute imports to `public/`) but fails to resolve under Next/Turbopack — confirmed by a
  throwaway test import during Phase 1 (`Module not found`). Fix: change these to plain string
  path literals (`"/assets/projects/civicMind.webp"`) rather than JS imports — the paths already
  work as public URLs under Next's `public/` convention, no asset needs to move.
- `src/lib/gsap.js` calls `gsap.registerPlugin(...)` at module scope, and
  `src/context/LenisContext.jsx` constructs `new Lenis(...)` inside `useEffect` (already SSR-safe
  as written — the constructor doesn't run during render). Verify both explicitly under Next's
  static-export prerendering before porting further: if module-scope GSAP registration ever turns
  out not to be prerender-safe in practice, the fix is to guard/lazy-init it, **not** to reach for
  `dynamic(..., { ssr: false })` — that route is explicitly forbidden by constitution Principle
  IV. `App.jsx`'s progress loader (`document.images`, `document.querySelectorAll("video")`,
  `window.innerHeight`) is already effect-scoped in the current code and must stay that way, per
  FR-003 of this phase's future spec.

## Phase 3 — SEO surfaces
**Goal:** Ship the full SEO kit beyond base metadata.
**Scope:** `app/sitemap.js`, `app/robots.js`, `Person`/`ProfilePage` JSON-LD (extending the
existing `index.html` JSON-LD block), final metadata pass (OG image, Twitter card, canonical
domain confirmation per PRD §15).
**Exit criteria:** `/sitemap.xml` and `/robots.txt` resolve correctly in the static export;
JSON-LD validates (schema.org structure); metadata matches PRD §1.2/§4.
**Depends on:** Phase 2.

## Phase 4 — Cutover & verification
**Goal:** Remove all Vite remnants, confirm the migration meets every PRD acceptance criterion,
and leave the repo in a clean, deployable state.
**Scope:** Delete `index.html`, `vite.config.js`, `src/main.jsx`, `vite`/`@vitejs/plugin-react`
deps; update `CLAUDE.md` commands section for Next.js; full QA pass against PRD §3 functional
requirements and the §15 acceptance criterion; confirm Vercel static-export deploy config.
**Exit criteria:** No Vite files/deps remain; `npm run build && npm run lint` green; the `curl`
raw-HTML acceptance check passes; site verified working in a real browser (not just build
output).
**Depends on:** Phase 3.
