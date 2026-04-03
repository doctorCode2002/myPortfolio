import { useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import MaskText from "./MaskText";

gsap.registerPlugin(ScrollTrigger, Flip);

const IMAGES = [
  "/assets/bentoGrid/top-left.webp",
  "/assets/bentoGrid/top-center.webp",
  "/assets/bentoGrid/center.webp",
  "/assets/bentoGrid/top-right.webp",
  "/assets/bentoGrid/left-center.webp",
  "/assets/bentoGrid/right-bottom.webp",
  "https://assets.codepen.io/16327/portrait-pattern-3.jpg",
  "https://assets.codepen.io/16327/portrait-image-1.jpg",
];

function setVhProperty() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

export default function BentoGallery() {
  const wrapRef = useRef(null);
  const galleryRef = useRef(null);
  const flipCtxRef = useRef(null);
  const resizeTimerRef = useRef(null);

  // const createTween = useCallback(() => {
  //   const galleryEl = galleryRef.current;
  //   if (!galleryEl) return;

  //   const galleryItems = galleryEl.querySelectorAll(".gallery__item");

  //   // Tear down any previous instance cleanly
  //   if (flipCtxRef.current) {
  //     flipCtxRef.current.revert();
  //     flipCtxRef.current = null;
  //   }
  //   galleryEl.classList.remove("gallery--final");

  //   flipCtxRef.current = gsap.context(() => {
  //     // Snapshot the expanded (final) state while the class is applied
  //     galleryEl.classList.add("gallery--final");
  //     const flipState = Flip.getState(galleryItems);
  //     galleryEl.classList.remove("gallery--final");

  //     const flip = Flip.to(flipState, {
  //       simple: true,
  //       ease: "expoScale(1, 5)",
  //     });

  //     const tl = gsap.timeline({
  //       scrollTrigger: {
  //         trigger: galleryEl,
  //         start: "center center",
  //         end: "+=100%",
  //         scrub: true,
  //         pin: galleryEl.parentNode,
  //         anticipatePin: 1,
  //         preventOverlaps: true,
  //       },
  //     });

  //     tl.add(flip);

  //     return () => gsap.set(galleryItems, { clearProps: "all" });
  //   });
  // }, []);

  const createTween = useCallback(() => {
    const galleryEl = galleryRef.current;
    if (!galleryEl) return;

    const galleryItems = galleryEl.querySelectorAll(".gallery__item");

    if (flipCtxRef.current) {
      flipCtxRef.current.revert();
      flipCtxRef.current = null;
    }
    galleryEl.classList.remove("gallery--final");

    flipCtxRef.current = gsap.context(() => {
      galleryEl.classList.add("gallery--final");
      const flipState = Flip.getState(galleryItems);
      galleryEl.classList.remove("gallery--final");

      const flip = Flip.to(flipState, {
        // Removed simple:true — lets GSAP track each element independently
        ease: "expoScale(1, 5)",
        invalidateOnRefresh: true, // Re-measures on ScrollTrigger.refresh()
        immediateRender: false, // Don't snap to end-state before scroll starts
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: galleryEl,
          start: "center center",
          end: "+=100%",
          scrub: 1, // Smoothed scrub (was true/instant) reduces jank
          pin: galleryEl.parentNode,
          anticipatePin: 1,
          preventOverlaps: true,
          fastScrollEnd: true, // Snaps tween to end if user scrolls past fast
          invalidateOnRefresh: true, // Recalculates pin/trigger on refresh

          // Force correct visual state when blown past in either direction
          onEnter: () => tl.progress(0),
          onLeave: () => tl.progress(1),
          onEnterBack: () => tl.progress(1),
          onLeaveBack: () => tl.progress(0),
        },
      });

      tl.add(flip);

      return () => gsap.set(galleryItems, { clearProps: "all" });
    });
  }, []);

  useEffect(() => {
    setVhProperty();

    // Only normalize scroll momentum on iOS — avoids desyncing on Android fast flings
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIos) ScrollTrigger.normalizeScroll({ momentum: 0.1 });

    createTween();

    const handleResize = () => {
      setVhProperty();
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        ScrollTrigger.refresh(true); // true = forces immediate recalc
        createTween();
      }, 250);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimerRef.current);
      if (flipCtxRef.current) flipCtxRef.current.revert();
      ScrollTrigger.normalizeScroll(false);
    };
  }, [createTween]);
  useEffect(() => {
    setVhProperty();

    ScrollTrigger.normalizeScroll(true);

    createTween();

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
        {/* <h2 className="text-3xl font-bold font-serif -mb-8">About Me</h2> */}
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
