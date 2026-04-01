
import { useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import MaskText from "./MaskText";

gsap.registerPlugin(ScrollTrigger, Flip);

const IMAGES = [
  "https://assets.codepen.io/16327/portrait-pattern-1.jpg",
  "https://assets.codepen.io/16327/portrait-image-12.jpg",
  "/assets/bentoGrid/center.webp",
  "/assets/bentoGrid/top-right.webp",
  "https://assets.codepen.io/16327/portrait-image-4.jpg",
  "https://assets.codepen.io/16327/portrait-image-3.jpg",
  "https://assets.codepen.io/16327/portrait-pattern-3.jpg",
  "https://assets.codepen.io/16327/portrait-image-1.jpg",
];

// ------------------------------------------------------------------
// Sets a CSS custom property --vh to the *actual* visible viewport
// height. This compensates for mobile browsers that include their
// chrome in the standard `vh` unit, causing layout jumps.
// ------------------------------------------------------------------
function setVhProperty() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

export default function BentoGallery() {
  const wrapRef = useRef(null);
  const galleryRef = useRef(null);
  const flipCtxRef = useRef(null);
  const resizeTimerRef = useRef(null);

  // ------------------------------------------------------------------
  // Build (or rebuild) the ScrollTrigger + FLIP animation.
  // Isolated so it can be called on mount and after debounced resize.
  // ------------------------------------------------------------------
  const createTween = useCallback(() => {
    const galleryEl = galleryRef.current;
    if (!galleryEl) return;

    const galleryItems = galleryEl.querySelectorAll(".gallery__item");

    // Tear down any previous instance cleanly
    if (flipCtxRef.current) {
      flipCtxRef.current.revert();
      flipCtxRef.current = null;
    }
    galleryEl.classList.remove("gallery--final");

    flipCtxRef.current = gsap.context(() => {
      // Snapshot the expanded (final) state while the class is applied
      galleryEl.classList.add("gallery--final");
      const flipState = Flip.getState(galleryItems);
      galleryEl.classList.remove("gallery--final");

      const flip = Flip.to(flipState, {
        simple: true,
        ease: "expoScale(1, 5)",
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: galleryEl,
          start: "center center",
          end: "+=100%",
          scrub: true,
          // `pin` needs the wrapper, not the gallery itself, so the
          // page continues scrolling while the gallery stays fixed.
          pin: galleryEl.parentNode,
          // Prevents the subtle jump that occurs on mobile when the
          // browser toolbar appears / disappears mid-scroll.
          anticipatePin: 1,
          // Smooth out momentum-based over-scrolling on iOS.
          preventOverlaps: true,
        },
      });

      tl.add(flip);

      return () => gsap.set(galleryItems, { clearProps: "all" });
    });
  }, []);

  useEffect(() => {
    // Sync the --vh variable on first render
    setVhProperty();

    // On mobile, normalizeScroll smooths out the scroll experience and
    // prevents ScrollTrigger from misfiring when the browser toolbar
    // animates in/out.
    ScrollTrigger.normalizeScroll(true);

    createTween();

    // Debounce resize to avoid destroying/rebuilding the GSAP context
    // dozens of times during a drag-resize or orientation animation.
    const handleResize = () => {
      setVhProperty();
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(createTween, 250);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimerRef.current);
      if (flipCtxRef.current) {
        flipCtxRef.current.revert();
      }
      // Clean up normalizeScroll so it doesn't affect other pages
      ScrollTrigger.normalizeScroll(false);
    };
  }, [createTween]);

  return (
    <>
      <style>{`
        /* ----------------------------------------------------------------
           Base gallery wrapper
           Uses --vh instead of vh so mobile browsers with dynamic chrome
           (address bar, bottom nav bar) don't mis-size the container.
        ---------------------------------------------------------------- */
        .gallery-wrap {
          position: relative;
          width: 100%;
          height: calc(var(--vh, 1vh) * 100);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .gallery {
          position: relative;
          width: 100%;
          height: 100%;
          flex: none;
        }

        .gallery__item {
          background-position: 50% 50%;
          background-size: cover;
          flex: none;
          position: relative;
          /* GPU-composite hint: avoids repaints during the FLIP animation */
          will-change: transform;
          /* Ensure crisp edges on retina screens during scaling */
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        .gallery__item img {
          object-fit: cover;
          width: 100%;
          height: 100%;
          /* Prevent iOS long-press popup on images */
          -webkit-touch-callout: none;
          pointer-events: none;
          display: block;
        }

        /* ----------------------------------------------------------------
           Bento grid — compact initial state
           3 columns on all screen sizes so nth-child(3) always sits in
           the center column and becomes the focal zoom image on scroll.
           32.5vw × 3 = 97.5vw — fits portrait mobile without overflow.
        ---------------------------------------------------------------- */
        .gallery--bento {
          display: grid;
          gap: 1vh;
          grid-template-columns: repeat(3, 32.5vw);
          grid-template-rows: repeat(4, calc(var(--vh, 1vh) * 23));
          justify-content: center;
          align-content: center;
        }

        /* ----------------------------------------------------------------
           Bento grid — expanded final state (post-animation)
           3 full-viewport-width columns so each image fills the screen
           as the FLIP animation completes.
        ---------------------------------------------------------------- */
        .gallery--final.gallery--bento {
          gap: 1vh;
          grid-template-columns: repeat(3, 100vw);
          grid-template-rows: repeat(4, calc(var(--vh, 1vh) * 49.5));
        }

        /* ----------------------------------------------------------------
           Grid item placement — both compact and final states inherit
           the same areas; only the column/row sizes change above.

           Bugs fixed from original:
             nth-child(4) was 1/3/3/3  → col-end = col-start = 0 width
             nth-child(5) was 3/1/3/2  → row-end = row-start = 0 height
             nth-child(5) new area must end at row 4 (not 5) so it
             doesn't overlap nth-child(7) which occupies row 4/1/5/2.
        ---------------------------------------------------------------- */
        .gallery--bento .gallery__item:nth-child(1) { grid-area: 1 / 1 / 3 / 2; }
        .gallery--bento .gallery__item:nth-child(2) { grid-area: 1 / 2 / 2 / 3; }
        .gallery--bento .gallery__item:nth-child(3) { grid-area: 2 / 2 / 4 / 3; }
        .gallery--bento .gallery__item:nth-child(4) { grid-area: 1 / 3 / 3 / 4; }
        .gallery--bento .gallery__item:nth-child(5) { grid-area: 3 / 1 / 4 / 2; }
        .gallery--bento .gallery__item:nth-child(6) { grid-area: 3 / 3 / 5 / 4; }
        .gallery--bento .gallery__item:nth-child(7) { grid-area: 4 / 1 / 5 / 2; }
        .gallery--bento .gallery__item:nth-child(8) { grid-area: 4 / 2 / 5 / 3; }
      `}</style>

      <div className="gallery-wrap" ref={wrapRef}>
        <div
          ref={galleryRef}
          id="gallery-8"
          className="gallery gallery--bento gallery--switch"
        >
          {IMAGES.map((src, i) => (
            <div className="gallery__item" key={i}>
              <img
                src={src}
                alt={`Gallery item ${i + 1}`}
                // Prevent lazy-load stutter during the FLIP animation
                loading={i < 4 ? "eager" : "lazy"}
                decoding="async"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 py-8 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold font-serif -mb-8">About Me</h2>
        <MaskText
          ogText="Crafting software taught me how to engineer intricate full-stack systems and code the frontend page. Every failure is a clue, and every component requires deep insight and precision."
          ogTextColor="black"
          ogSpan="deep insight"
          ogSpanTextColor="#0ea5e9"
          maskText="Studying medicine taught me how to diagnose intricate biological systems and heal the human body. Every symptom is a clue, and every treatment requires deep empathy and precision."
          maskSpan="deep empathy"
          maskColor="black"
          maskTextColor="white"
          maskSpanTextColor="#f59e0b"
          bgColor="transparent"
        />
      </div>
    </>
  );
}
