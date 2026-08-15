# Lenis Scroll Migration & Performance Fix Plan

> **Goal:** Replace GSAP ScrollSmoother with Lenis for smoother, more performant scrolling across all devices (especially iOS & mobile), fix the horizontal scroll lag in `StudentReviews`, and keep all GSAP animations fully intact.

---

## 📖 Recommendation: Keep GSAP, Replace Only ScrollSmoother

**Short answer: Keep GSAP for animations, replace ScrollSmoother with Lenis.**

| Concern | GSAP ScrollSmoother | Lenis |
|---|---|---|
| Requires GSAP Club membership | ✅ Yes (paid) | ❌ No (free) |
| iOS / mobile support | ⚠️ Jittery (`smoothTouch: 0.1`) | ✅ Native-feel momentum |
| Fixed navbar compatibility | ❌ Requires manual `data-lag` workarounds | ✅ Works out of the box |
| Integration with ScrollTrigger | ✅ Native | ✅ Via `lenis.on('scroll', ScrollTrigger.update)` |
| Bundle overhead | Heavy (ScrollSmoother + ScrollTrigger) | Lightweight (~4KB) |
| Pinned sections (BentoGallery) | Works but can jank on iOS | Works cleanly |

**Verdict:** Lenis is the clear winner for your stack. Your GSAP animations (timelines, ScrollTrigger pins, Flip, quickTo) all stay untouched — only the *scroll driver* changes. ScrollSmoother is removed, Lenis drives native scroll events that ScrollTrigger listens to.

---

## 🗂️ Tasks

### Task 1 — Install Lenis

**File:** `package.json` (via terminal)

```bash
npm install lenis
```

Lenis v1.x is the stable release. It exposes a `@studio-freight/lenis` or simply `lenis` package.
Check correct package name: `lenis` (the official maintained fork by darkroom.engineering).

---

### Task 2 — Create a `useLenis` Hook

**File (new):** `src/hooks/useLenis.js`

Create a reusable custom React hook that:
1. Instantiates `Lenis` once on mount.
2. Wires Lenis' `scroll` event into `ScrollTrigger.update` so all existing ScrollTrigger animations keep working.
3. Starts the GSAP ticker loop (`gsap.ticker.add`) to drive Lenis' `raf` each frame.
4. Exposes the `lenis` instance so other components can call `lenis.scrollTo(target)`.
5. Returns a cleanup function that destroys Lenis and removes the ticker on unmount.

**Key Lenis options to set:**
```js
new Lenis({
  duration: 1.2,          // scroll duration multiplier
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo ease
  orientation: 'vertical',
  gestureOrientation: 'vertical',
  smoothWheel: true,
  wheelMultiplier: 1,
  touchMultiplier: 2,     // improves mobile feel
  infinite: false,
})
```

> ⚠️ **Fixed Navbar note:** Lenis scrolls `document.documentElement` (the real scroll container), NOT a fake div like ScrollSmoother does. This means `position: fixed` elements like the Navbar work 100% natively — no offsets, no `data-lag`, nothing to change in `Navbar.jsx`.

---

### Task 3 — Create a `LenisProvider` Context

**File (new):** `src/context/LenisContext.jsx`

Wrap the app in a React context that:
- Calls `useLenis()` internally.
- Exposes `lenis` instance via `useLenisContext()` hook.
- Enables any component (e.g., Navbar) to call `lenis.scrollTo('#section-id')` for smooth navigation.

---

### Task 4 — Replace `ScrollSmootherLayout` with `LenisProvider`

**File modified:** `src/components/ScrollSmootherLayout.jsx`  
**File modified:** `src/App.jsx`

#### In `App.jsx`:
- Remove `<ScrollSmootherLayout>` wrapper.
- Wrap app (or just the content div) in `<LenisProvider>`.
- Remove the `enabled` prop logic — Lenis can be paused on init and started after loading instead.

#### Delete or repurpose `ScrollSmootherLayout.jsx`:
- Remove all imports of `ScrollSmoother`.
- The `#smooth-wrapper` / `#smooth-content` divs can be removed; Lenis uses `document.documentElement` as its root, so no wrapper divs are needed.

> ⚠️ **Important:** After removing ScrollSmoother, the page body will scroll normally again. The Navbar is `position: fixed` which already works with native scroll — so no Navbar changes are required.

---

### Task 5 — Update `Navbar.jsx` Scroll-To Logic

**File modified:** `src/components/Navbar.jsx`

Currently `handleScroll` uses:
```js
gsap.to(window, { scrollTo: target, ... })
```

Replace with Lenis' `scrollTo` for consistency:
```js
const { lenis } = useLenisContext();
lenis.scrollTo(target, { duration: 1.2, easing: ... });
```

This ensures Lenis controls the animated scroll-to as well — mixing `gsap.scrollTo(window, ...)` with Lenis can cause conflicts since both try to control `window.scrollY`.

---

### Task 6 — Fix `StudentReviews` Horizontal Scroll (Mobile & iOS)

**File modified:** `src/components/StudentReviews.jsx`

#### Root Causes of Current Lag:
1. **ScrollTrigger pin + scrub on mobile** — ScrollTrigger's `pin: true` creates a synthetic scroll zone. On iOS, touch momentum interferes with the synthetic position, causing a "rubbery" or laggy feel.
2. **`scrub: 1`** — adds a lerp delay on top of already-laggy touch events.
3. **No `overflowX` native fallback on mobile** — the pinned approach forces vertical scroll to drive horizontal, which feels unnatural on touch screens.

#### Solution — Dual Strategy (Desktop vs Mobile):

**Desktop (≥768px):** Keep the current GSAP ScrollTrigger pin + horizontal scrub. It looks great on desktop with a mouse.

**Mobile (<768px):** Replace the pin entirely with **native CSS horizontal scroll** (`overflow-x: scroll; scroll-snap-type: x mandatory`). This is butter-smooth on iOS because the browser handles the scroll natively (no JS overhead).

**Implementation steps inside `StudentReviews.jsx`:**
1. Add a `useEffect` (or media-query check) that detects `window.innerWidth < 768`.
2. On **mobile**: skip the GSAP ScrollTrigger pin entirely; apply CSS classes that enable `overflow-x: scroll` + `scroll-snap-align: start` on each card.
3. On **desktop**: initialize the existing GSAP horizontal scroll animation as before (with minor Lenis-awareness: call `ScrollTrigger.update` after lenis tick, which Task 2 already handles).
4. Add a `resize` listener to switch between modes.

**CSS to add (via Tailwind or inline style on mobile):**
```css
/* Mobile track */
.reviews-track-mobile {
  overflow-x: scroll;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch; /* iOS momentum */
  scrollbar-width: none;
}
.reviews-track-mobile::-webkit-scrollbar { display: none; }

/* Each card snaps */
.reviews-track-mobile .review-card {
  scroll-snap-align: start;
}
```

5. On mobile, **pause Lenis** for the horizontal track container (use `data-lenis-prevent` attribute or `lenis.stop()` / `lenis.start()` on touch events within the section) to prevent Lenis from intercepting vertical scroll while the user is swiping horizontally.

---

### Task 7 — Update `BentoGallery.jsx` ScrollTrigger Compatibility

**File modified:** `src/components/BentoGallery.jsx`

Current issue: `BentoGallery` has **two `useEffect` hooks that both call `ScrollTrigger.normalizeScroll`** — this is a bug that causes double-initialization and can conflict with Lenis.

Fixes:
1. **Remove both `ScrollTrigger.normalizeScroll()` calls** — Lenis replaces this entirely. Lenis normalizes scroll cross-browser natively; calling `normalizeScroll` alongside Lenis will cause double-interception of scroll events.
2. **Merge the two duplicate `useEffect` blocks** into a single one.
3. Keep `invalidateOnRefresh: true` and `anticipatePin: 1` on the ScrollTrigger config — these are still valid with Lenis.

---

### Task 8 — Update CSS: Remove ScrollSmoother-specific Styles

**File modified:** `src/index.css`

ScrollSmoother requires the body/html to have `overflow: hidden` and the scroll to happen inside `#smooth-content`. After switching to Lenis:
- Remove any `overflow: hidden` on `html` or `body` that was added for ScrollSmoother.
- Ensure `html, body { height: 100%; }` is NOT set to a fixed height (let content be natural height).
- The custom scrollbar CSS (`::-webkit-scrollbar`) can be kept as-is.

---

### Task 9 — Add `data-lenis-prevent` to Horizontally Scrollable Areas

**File modified:** `src/components/StudentReviews.jsx` (mobile track div)

Lenis v1 supports a `data-lenis-prevent` attribute on any element. When this attribute is present on a scrollable child, Lenis will not intercept scroll events within it — allowing native scroll to work.

Add `data-lenis-prevent` to the mobile horizontal scroll container:
```jsx
<div
  data-lenis-prevent
  className="reviews-track-mobile flex gap-5 overflow-x-scroll ..."
>
  {/* cards */}
</div>
```

This is the correct, officially supported way to let inner scroll areas work alongside Lenis.

---

### Task 10 — Test & Validate

#### Desktop:
- [ ] Smooth vertical scroll (Lenis easing)
- [ ] Hero entry animation fires on load
- [ ] BentoGallery FLIP animation pins and scrubs correctly
- [ ] Work section hover + scroll animations work
- [ ] StudentReviews horizontal scroll (mouse + trackpad)
- [ ] Navbar `scrollTo` navigates smoothly
- [ ] Navbar stays fixed and never shifts

#### Mobile (iOS Safari):
- [ ] No scroll jank on vertical scroll
- [ ] StudentReviews swipes horizontally with snap
- [ ] BentoGallery pin doesn't rubber-band
- [ ] Navbar remains fixed during scroll

#### Mobile (Android Chrome):
- [ ] Smooth vertical scroll
- [ ] StudentReviews touch scroll works
- [ ] No white flash or scroll desync

---

## 📁 Files Summary

| File | Action |
|---|---|
| `package.json` | Install `lenis` |
| `src/hooks/useLenis.js` | **NEW** — core Lenis setup hook |
| `src/context/LenisContext.jsx` | **NEW** — React context for lenis instance |
| `src/components/ScrollSmootherLayout.jsx` | **REMOVE** or convert to passthrough |
| `src/App.jsx` | Replace `<ScrollSmootherLayout>` with `<LenisProvider>` |
| `src/components/Navbar.jsx` | Replace `gsap.scrollTo` with `lenis.scrollTo` |
| `src/components/StudentReviews.jsx` | Dual-mode: GSAP on desktop, native CSS scroll on mobile |
| `src/components/BentoGallery.jsx` | Remove duplicate `useEffect`, remove `normalizeScroll` |
| `src/index.css` | Clean up ScrollSmoother body/html overrides |

---

## ⚠️ Risks & Notes

- **ScrollSmoother is a GSAP Club plugin** — if you rely on it for other pages or projects, consider that removing it here only affects this project.
- **`gsap.to(window, { scrollTo })` must be replaced** — Lenis owns the scroll, and fighting it with `window.scrollTo` or `gsap scrollTo` will cause jumps.
- **`lenis.scrollTo('#id')` resolves selectors automatically** — no need to pass `document.querySelector(...)`.
- **Do not set `smoothTouch` in Lenis config** — Lenis handles touch natively and smoothly by default. The old `smoothTouch: 0.1` in ScrollSmoother was a workaround hack.
- **Testing on real iOS device is critical** — iOS Safari's scroll behavior differs from simulators.
