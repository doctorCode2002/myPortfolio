# Refactor + Fixed-Nav / Lenis / GSAP Conflict Fix Plan

> **Goal:** Clean up the codebase (remove dead code, centralize GSAP setup, fix lint
> errors, drop the unused router) and harden the **fixed Navbar** so it never fights
> Lenis smooth scroll or the GSAP/ScrollTrigger animations. The one intentional
> behavior change: **restore the StudentReviews desktop scroll-jack pin** (native
> swipe stays on mobile).
>
> **Scope confirmed:** Cleanup + nav fixes (no other behavior changes).
> **No code is written in this plan — it is the implementation spec.**

---

## 0. Branch

Per `CLAUDE.md`, this is a large multi-file change. Work on a dedicated branch
(`feature/refactor-nav-fixes`, or continue on the current
`feature/lenis-scroll-migration` branch) and only merge to `main` after review/approval.

---

## 1. Current State (verified)

- `npm run build` **passes**.
- `npm run lint` reports **3 errors + 1 warning**:
  1. `StudentReviews.jsx` — `useGSAP` imported but never used.
  2. `LenisContext.jsx` — `setState` called synchronously inside an effect.
  3. `LenisContext.jsx` — `react-refresh/only-export-components` (the file exports both
     `LenisProvider` and the `useLenis` hook).
  4. (warning) `StudentReviews.jsx` — `useEffect` missing `trackRef` dependency.
- `StudentReviews.jsx` uses **TypeScript generics in a `.jsx` file**
  (`useRef<HTMLDivElement>(null)`). It compiles today only because the Oxc-based React
  plugin tolerates it, but it is invalid JSX and should be removed.
- The **desktop horizontal scroll-jack** in `StudentReviews` is fully commented out;
  cards currently use a plain native `overflow-x-auto` track on all screen sizes.
- `main.jsx` wraps the app in `<BrowserRouter>` but there are **no routes** — the site is
  a single anchor-scroll page.
- `gsap.registerPlugin(ScrollTrigger)` is repeated in **6 files**
  (`App`, `Services`, `Contact`, `MentorProfile`, `StudentReviews`, `BentoGallery`).
- Large blocks of **dead commented code** exist in `Hero`, `BentoGallery`,
  `StudentReviews`, `TestimonialCard`, and `MaskText` defaults.
- The `--vh` CSS custom property is **owned by `BentoGallery`** but also consumed by
  `StudentReviews` — a cross-component coupling that breaks if BentoGallery unmounts.

---

## 2. Fixed-Nav vs Lenis / GSAP — Conflict Analysis

The Navbar is `position: fixed` (`z-50`), with a full-screen menu overlay (`z-40`).
Because Lenis scrolls the real document (`documentElement`) rather than a faked wrapper,
fixed positioning works natively — **but four real conflicts remain:**

### Conflict A — `scrollTo` lands sections *behind* the fixed nav
`Navbar.handleScroll` calls `lenis.scrollTo(target)` with no offset, so the target
section's top aligns to viewport `y=0`, hidden under the ~80px fixed nav.
**Fix:** introduce a single navbar-height source of truth and offset every scroll-to.

### Conflict B — Pinned sections pin at the viewport top, under the nav
`Services` (`pin: true`, `start: "top top"`) and the to-be-restored `StudentReviews`
pin trigger pin their content flush to the viewport top — partially occluded by the nav.
`BentoGallery` (`start: "center center"`) is centered so it's visually fine, but its pin
math must still be Lenis-aware.
**Fix:** offset pin `start` by the nav height (e.g. `start: "top <navH>"`) and/or add
top padding so pinned content clears the nav.

### Conflict C — Menu open does not stop Lenis
When the full-screen menu opens, the page **still scrolls** behind it via wheel/touch
because Lenis is never paused. `App.jsx` only locks `body.overflow` during the initial
loader, not while the menu is open.
**Fix:** call `lenis.stop()` when the menu opens and `lenis.start()` when it closes.

### Conflict D — Mixed scroll drivers
`Navbar.handleScroll` falls back to `gsap.to(window, { scrollTo })` when `lenis` is null.
Once Lenis is live, two drivers can fight over `window.scrollY`.
**Fix:** prefer Lenis; only fall back to a plain `scrollIntoView`/native jump before
Lenis is ready, never an animated `window` tween that overlaps Lenis.

> Hero is `h-dvh` (not fixed) and needs no change.

---

## 3. Tasks

### Task 1 — Centralize GSAP plugin registration
**New file:** `src/lib/gsap.js` (or `src/lib/gsapSetup.js`)
- Register `ScrollTrigger` (and `ScrollToPlugin`, `Flip`) **once** here and re-export `gsap`.
- Remove the 6 redundant `gsap.registerPlugin(...)` calls across components; import from
  the central module instead.
- Keep `gsap.ticker.lagSmoothing(0)` in `LenisContext` (it belongs with the Lenis driver).

### Task 2 — Single navbar-height source of truth
**Files:** `src/index.css`, `src/components/Navbar.jsx`, section components
- Define `--nav-h` (e.g. `5rem`) as a CSS variable in `index.css` `@theme`/`:root`.
- Apply `scroll-margin-top: var(--nav-h)` to all anchored sections (or a shared class) so
  even native anchor jumps clear the nav.
- Use the same value to compute the Lenis `scrollTo` `offset` (negative nav height) in
  `Navbar.handleScroll`.

### Task 3 — Harden Navbar scroll behavior (Conflicts A, C, D)
**File:** `src/components/Navbar.jsx`
- `handleScroll`: call `lenis.scrollTo(target, { offset: -navH, duration: 1.2 })`.
  Remove the animated `gsap.to(window, { scrollTo })` fallback; if `lenis` is not ready,
  do a plain native jump (`el.scrollIntoView()`), not an overlapping tween.
- On menu open → `lenis?.stop()`; on menu close → `lenis?.start()`. Ensure cleanup
  re-enables Lenis if the component unmounts while open.
- Leave the FlowingMenu / MenuItem marquee logic as-is (out of scope), but it can move to
  its own file if convenient — optional, no behavior change.

### Task 4 — Offset pinned-section triggers for the fixed nav (Conflict B)
**Files:** `src/components/Services.jsx`, `src/components/StudentReviews.jsx`
(and verify `BentoGallery.jsx`)
- `Services`: change pin `start` from `"top top"` to clear the nav (`"top var(--nav-h)"`
  equivalent, or read nav height at runtime). Confirm the pinned content isn't clipped.
- `StudentReviews` (see Task 6): start the restored pin below the nav.
- `BentoGallery`: confirm `start: "center center"` still centers correctly post-nav-offset;
  no change expected, but re-test the pin.

### Task 5 — Lift `--vh` ownership to app level
**Files:** `src/App.jsx` (or a small `useViewportUnit` effect / `src/lib`), `BentoGallery.jsx`,
`StudentReviews.jsx`
- Move the `--vh` set + resize listener out of `BentoGallery` into an app-level effect so
  the variable exists regardless of which sections are mounted.
- Remove the duplicate `setVhProperty` logic from `BentoGallery`; both consumers read the
  app-level variable.

### Task 6 — Restore StudentReviews desktop scroll-jack (intentional behavior change)
**File:** `src/components/StudentReviews.jsx`
- Remove the TypeScript generics: `useRef<HTMLDivElement>(null)` → `useRef(null)`.
- Re-enable the commented `useGSAP` block as a **desktop-only** pinned horizontal scroll:
  - Guard with `if (isMobile) return;`.
  - Pin the section; translate the track by its overflow distance on vertical scroll.
  - Use `start` offset for the fixed nav (Task 4), `invalidateOnRefresh: true`,
    `scrub` (test `1` vs `true`), and `anticipatePin: 1`.
  - Return a cleanup that kills the tween + its ScrollTrigger; pass
    `{ scope: sectionRef, dependencies: [isMobile] }`.
- **Mobile (<768px):** keep the native `overflow-x-auto` + `snap-x` track and keep
  `data-lenis-prevent` on it so Lenis doesn't intercept horizontal swipes.
- This resolves the unused-`useGSAP` lint error and the missing-dep warning.

### Task 7 — Remove the unused router
**Files:** `src/main.jsx`, `package.json`
- Remove `<BrowserRouter>` from `main.jsx`.
- Uninstall `react-router-dom` (`npm uninstall react-router-dom`).

### Task 8 — Delete dead code
**Files:** `Hero.jsx`, `BentoGallery.jsx`, `TestimonialCard.jsx`, `StudentReviews.jsx`,
`MaskText.jsx`
- `Hero.jsx`: delete the top commented-out component (lines ~1–63).
- `BentoGallery.jsx`: delete the old commented `createTween` and the commented `MaskText`
  block / commented `<h2>`.
- `TestimonialCard.jsx`: delete the commented arrow-badge block.
- `StudentReviews.jsx`: the old commented hook is replaced by Task 6.
- `MaskText.jsx`: keep (defaults are fine); only remove genuinely dead branches if any.

### Task 9 — Resolve remaining lint errors
**File:** `src/context/LenisContext.jsx`
- `react-refresh/only-export-components`: move the `useLenis` hook into its own file
  (e.g. `src/context/useLenis.js`) or a `src/hooks/` file, leaving `LenisContext.jsx`
  to export only the provider component.
- `set-state-in-effect`: this is a legitimate "store an external instance" case. Either
  keep `useState` and silence the rule with a scoped disable + comment explaining Lenis is
  an external system, or refactor so the instance is created in a way the rule accepts.
  Document the choice in the diff.

### Task 10 — Validate
- `npm run lint` → **0 errors**.
- `npm run build` → passes.
- Manual checks below.

---

## 4. Files Summary

| File | Action |
|---|---|
| `src/lib/gsap.js` | **NEW** — central GSAP plugin registration |
| `src/context/LenisContext.jsx` | Export provider only; keep `lagSmoothing(0)` |
| `src/context/useLenis.js` (or `src/hooks/`) | **NEW** — `useLenis` hook (fixes react-refresh) |
| `src/index.css` | Add `--nav-h`; `scroll-margin-top` on sections |
| `src/components/Navbar.jsx` | `scrollTo` offset; stop/start Lenis on menu; drop window tween fallback |
| `src/components/Services.jsx` | Pin `start` offset for nav; use central gsap |
| `src/components/StudentReviews.jsx` | Remove TS generics; restore desktop scroll-jack; nav offset |
| `src/components/BentoGallery.jsx` | Remove `--vh` ownership + dead code; use central gsap |
| `src/App.jsx` | App-level `--vh`; use central gsap |
| `src/main.jsx` | Remove `BrowserRouter` |
| `src/components/Hero.jsx` / `TestimonialCard.jsx` | Delete dead commented code |
| `package.json` | Uninstall `react-router-dom` |

---

## 5. Risks & Notes

- **Nav-offset value must be consistent** — drive everything from `--nav-h` so the
  `scrollTo` offset, `scroll-margin-top`, and pin `start` never drift apart.
- **Restoring the scroll-jack is the highest-risk task** — pinned horizontal scrub plus a
  fixed nav plus Lenis is exactly the combination that previously janked on iOS. Test the
  desktop pin AND confirm mobile still uses native swipe (no pin) with `data-lenis-prevent`.
- **`lenis.stop()` on menu open** must be paired with `start()` on every close path
  (button, link navigation, unmount) or scrolling stays frozen.
- **Centralizing `registerPlugin`** is safe (idempotent), but import order matters — the
  central module must be imported before any component uses a plugin.
- **`--vh` move**: verify no flash of mis-sized BentoGallery/StudentReviews on first paint;
  set the variable as early as possible (before first render if feasible).
- Keep `react-fast-marquee` and the `MyMarquee` resolver shim untouched (out of scope).

---

## 6. Validation Checklist

**Desktop**
- [ ] Smooth Lenis vertical scroll; no double-driver jump.
- [ ] Navbar link click scrolls to section with content fully below the nav (not occluded).
- [ ] Services pin starts below the nav; content not clipped.
- [ ] BentoGallery FLIP pin/scrub still correct.
- [ ] StudentReviews pins and scrubs horizontally to completion, starting below the nav.
- [ ] Opening the menu freezes background scroll; closing restores it.

**Mobile (iOS Safari + Android Chrome)**
- [ ] No vertical scroll jank.
- [ ] StudentReviews swipes horizontally with snap (native, `data-lenis-prevent`).
- [ ] BentoGallery pin doesn't rubber-band.
- [ ] Navbar stays fixed; menu open/close toggles scroll lock correctly.

**Tooling**
- [ ] `npm run lint` → 0 errors.
- [ ] `npm run build` → passes.
