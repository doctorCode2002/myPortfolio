# Student Reviews Section Fix Plan

## Problem Analysis

The `StudentReviews` section has **three compounding problems** that need to be fixed together:

### Problem 1 — Broken syntax in `StudentReviews.jsx`
The last edit left orphaned closing tokens at lines 62–64:
```js
  // line 61 — end of correct new useGSAP block
  );
    },               // ← orphaned, duplicated from old block
    { scope: sectionRef },  // ← orphaned
  );                 // ← orphaned
```
This causes TypeScript/build errors and means the component renders with dead code hanging below the hook.

### Problem 2 — Lenis `gsap.ticker.lagSmoothing` conflict
`LenisContext.jsx` drives Lenis using `gsap.ticker.add(updateLenis)`, which converts GSAP's ticker time from **seconds → milliseconds** (`time * 1000`). GSAP's ticker time is already in **seconds** — but Lenis expects `raf()` to receive **milliseconds**. This is correct behavior.

However, GSAP also enables `lagSmoothing` by default. When the tab is hidden or the CPU spikes, GSAP artificially clamps its deltaTime. This can cause Lenis to get out of sync with ScrollTrigger, making the pinned section "jump" or "stick".

**Fix:** Disable GSAP's lag smoothing: `gsap.ticker.lagSmoothing(0)` inside `LenisProvider`.

### Problem 3 — `start: "top top"` miscalculation with fixed Navbar
The ScrollTrigger for `StudentReviews` uses:
```js
start: "top top"
```
This means "when the top of `sectionRef` reaches the top of the viewport". But the page has a **fixed Navbar** that overlaps the top of the viewport. The section starts pinning immediately as it enters the viewport top, but visually the content is already hidden behind the navbar.

**Fix:** Offset the start position by the navbar height:
```js
start: "top 72px"  // approx navbar height
```
Or, even better, read the navbar height dynamically at runtime.

### Problem 4 — `overflow-x-hidden` on `Section` blocks pinned child positioning
The outer `<Section>` wrapper has `className="overflow-x-hidden ..."`. When ScrollTrigger pins the inner `sectionRef` div, it mutates `position` and `top` on that element. The `overflow-x-hidden` on the parent creates a new stacking/clipping context that can clip the pin-spacer height or cause visual glitches with the sticky pin.

**Fix:** Remove `overflow-x-hidden` from the `<Section>` tag in `StudentReviews`. Horizontal overflow is already handled globally via `html, body { overflow-x: hidden }` in `index.css`.

### Problem 5 — `LenisContext` exposes stale ref value via context
`LenisContext.Provider` passes `lenisRef.current` as the context value. At render time of `LenisProvider`, `lenisRef.current` is still `null` (the `useEffect` hasn't run yet). This means all consumers of `useLenis()` receive `null` forever, even after Lenis is initialized — because the context value is never updated after the effect runs.

**Fix:** Use `useState` to hold the `lenis` instance rather than a ref, so consumers get the actual instance once it's created:
```jsx
const [lenis, setLenis] = useState(null);
// inside useEffect:
const lenisInstance = new Lenis({ ... });
setLenis(lenisInstance);
```

---

## Tasks

### Task 1 — Fix `StudentReviews.jsx` syntax error
**File:** `src/components/StudentReviews.jsx`

Remove the orphaned lines 62–64 (`},`, `{ scope: sectionRef },`, `);`) that are leftover from the failed partial replacement. The file should have exactly one `useGSAP(...)` call.

Final clean `useGSAP` structure:
```js
useGSAP(
  () => {
    if (isMobile) return;
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;
    // ... tween + scrollTrigger setup ...
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  },
  { dependencies: [isMobile], scope: sectionRef },
);
```

### Task 2 — Fix `LenisContext.jsx` stale ref + lag smoothing
**File:** `src/context/LenisContext.jsx`

1. Replace `useRef` for Lenis storage with `useState` so the context value updates when Lenis is ready.
2. Add `gsap.ticker.lagSmoothing(0)` immediately after creating the Lenis instance to prevent GSAP's lag clamping from desynchronizing Lenis and ScrollTrigger.

### Task 3 — Fix `StudentReviews.jsx` ScrollTrigger `start` offset for fixed nav
**File:** `src/components/StudentReviews.jsx`

Change `start: "top top"` to `start: "top 72px"` (the approximate fixed navbar height) so the pin triggers after the section fully clears the navbar. This prevents the pinned section from starting while part of it is hidden behind the nav.

### Task 4 — Remove `overflow-x-hidden` from `StudentReviews` outer Section
**File:** `src/components/StudentReviews.jsx`

Change the `<Section>` className from:
```html
className="overflow-x-hidden bg-[#f5f2e9] py-0 text-black"
```
to:
```html
className="bg-[#f5f2e9] py-0 text-black"
```
Horizontal overflow is managed globally.

### Task 5 — Verify build and test
- Run `npm run build` to confirm no compile errors.
- Test on desktop: scroll into the `StudentReviews` section and confirm it pins and the track scrolls horizontally to completion.
- Test on mobile: confirm native horizontal swipe works with scroll-snap, and that vertical scroll is not blocked.

---

## Files Modified

| File | Change |
|---|---|
| `src/components/StudentReviews.jsx` | Fix syntax, fix `start` offset, remove `overflow-x-hidden` |
| `src/context/LenisContext.jsx` | Switch to `useState`, add `lagSmoothing(0)` |
