# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Next.js, Turbopack)
npm run build     # Production build (static export to out/)
npm run start     # Serve the static export locally (out/)
npm run lint      # Run ESLint
```

No test suite is configured.

## Git Workflow

For any new feature or a fix that touches multiple files / has meaningful scope:

1. **Create a branch before writing any code.**
   ```bash
   git checkout -b feature/<short-name>   # new feature
   git checkout -b fix/<short-name>       # bug fix
   ```
2. **Work and commit on that branch.** Keep commits focused.
3. **Do not merge into `main` without explicit user approval.** When the work is ready, present a summary and wait for the user to say it's good before merging.
4. **Merge only after permission is given:**
   ```bash
   git checkout main
   git merge --no-ff <branch-name>
   ```

Small, self-contained edits (typo fixes, single-line tweaks, content updates in `constants/index.js`) can go directly on the current branch without a new branch.

## Architecture

Single-page portfolio app built with React 19 + Next.js 16 (App Router, static export via `output: 'export'`). All content renders in a single scrollable page — no routes, just anchor-linked sections. `app/layout.jsx` and `app/page.jsx` are Server Components; `app/page.jsx` composes all section components (which live under `src/components/`) inside `<PageShell>`.

**Page shell** (`src/components/PageShell.jsx`, `"use client"`): wraps everything in `<LenisProvider>` and shows a progress loader (tracks images + videos + window load) that hides the page until assets are ready, then calls `ScrollTrigger.refresh()`. Kept as a separate client component (rather than living in `app/page.jsx` itself) so the section tree stays server-rendered — see constitution Principle IV in `.specify/memory/constitution.md` (gitignored; ask if you need to see it) for why this boundary matters.

**Scroll system** (`src/context/LenisContext.jsx`): Lenis provides smooth scrolling, wired into GSAP's ticker via `gsap.ticker.add()` and connected to `ScrollTrigger.update` on the Lenis scroll event. All GSAP scroll animations must use ScrollTrigger — do not rely on native scroll events. Components that need to scroll programmatically should call `useLenis()` and use `lenis.scrollTo()`.

**Section order**: `Navbar → Hero → Services → About → Work → Feedback → MentorProfile → StudentReviews → Contact`

**Layout primitives**:
- `Container` — max-width wrapper with responsive horizontal padding
- `Section` — full-width `<section>` with vertical padding and optional `id`

**Animation pattern**: All GSAP animations live inside `useGSAP()` hooks (from `@gsap/react`). `ScrollTrigger`/`ScrollToPlugin`/`Flip` are registered once in `src/lib/gsap.js` — always import `gsap` from there (`../lib/gsap`), not the bare `gsap` package, so plugin registration is guaranteed before use. Refs are used for direct DOM targeting; avoid querying by class inside GSAP when a ref is available. Every component using GSAP/Lenis/browser APIs needs its own `"use client"` directive — never place one on `app/layout.jsx` or `app/page.jsx`, and never use `dynamic(..., { ssr: false })` to dodge an SSR issue (this silently defeats the point of being on Next.js — fix the underlying SSR-safety issue instead).

**Static data** (`src/constants/index.js`): all content (nav links with preview images, projects, testimonials, mentor stats, student reviews, contact links) is exported from this single file. Add or edit content here — components just consume the arrays. Image/asset references are plain string paths (e.g. `"/assets/bgvideo.mp4"`), not JS imports — root-absolute `import x from "/assets/..."` is a Vite-only resolution behavior that fails to build under Next.

**Styling**: Tailwind CSS v4 (config-less, via `@tailwindcss/postcss`). Theme overrides live in `app/globals.css` under `@theme` — notably `--color-white: #e5e5e0` (off-white, not pure white) and `--font-sans`/`--font-serif`, which reference CSS variables from `next/font/google` (Inter, Playfair Display) set up in `app/layout.jsx` — do not reintroduce a Google Fonts `<link>`/`@import`. Lenis CSS rules are also in `app/globals.css` and must remain for smooth scroll to work.

**Assets**: Images and videos are served from `public/assets/`. Reference them with absolute paths like `/assets/bgvideo.mp4`. Project preview images use `.webp` format.

**Analytics**: `<Analytics />` from `@vercel/analytics/react` is rendered in `PageShell.jsx` — it's a no-op outside Vercel deployments.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
