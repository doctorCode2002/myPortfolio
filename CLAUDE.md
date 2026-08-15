# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # Production build
npm run preview   # Preview production build locally
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

Single-page portfolio app built with React 19 + Vite 8. All content renders in a single scrollable page — no routes, just anchor-linked sections.

**Page layout** (`src/App.jsx`): wraps everything in `<LenisProvider>` and shows a progress loader (tracks images + videos + window load) that hides the page until assets are ready, then calls `ScrollTrigger.refresh()`.

**Scroll system** (`src/context/LenisContext.jsx`): Lenis provides smooth scrolling, wired into GSAP's ticker via `gsap.ticker.add()` and connected to `ScrollTrigger.update` on the Lenis scroll event. All GSAP scroll animations must use ScrollTrigger — do not rely on native scroll events. Components that need to scroll programmatically should call `useLenis()` and use `lenis.scrollTo()`.

**Section order**: `Navbar → Hero → Services → About → Work → Feedback → MentorProfile → StudentReviews → Contact`

**Layout primitives**:
- `Container` — max-width wrapper with responsive horizontal padding
- `Section` — full-width `<section>` with vertical padding and optional `id`

**Animation pattern**: All GSAP animations live inside `useGSAP()` hooks (from `@gsap/react`). `ScrollTrigger` is registered once globally in `App.jsx`. Refs are used for direct DOM targeting; avoid querying by class inside GSAP when a ref is available.

**Static data** (`src/constants/index.js`): all content (nav links with preview images, projects, testimonials, mentor stats, student reviews, contact links) is exported from this single file. Add or edit content here — components just consume the arrays.

**Styling**: Tailwind CSS v4 (config-less, via `@tailwindcss/vite`). Theme overrides live in `src/index.css` under `@theme` — notably `--color-white: #e5e5e0` (off-white, not pure white). Fonts: Inter (sans) and Playfair Display (serif), loaded via Google Fonts. Lenis CSS rules are also in `index.css` and must remain for smooth scroll to work.

**Assets**: Images and videos are served from `public/assets/`. Reference them with absolute paths like `/assets/bgvideo.mp4`. Project preview images use `.webp` format.

**Analytics**: `<Analytics />` from `@vercel/analytics/react` is rendered in `App.jsx` — it's a no-op outside Vercel deployments.
