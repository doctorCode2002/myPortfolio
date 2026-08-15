"use client";

import { useEffect, useRef, useCallback } from "react";
import gsap, { ScrollTrigger, Flip } from "../lib/gsap";
import MaskText from "./MaskText";

const IMAGES = [
  "/assets/bentoGrid/top-left.webp",
  "/assets/bentoGrid/top-center.webp",
  "/assets/bentoGrid/center.webp",
  "/assets/bentoGrid/top-right.webp",
  "/assets/bentoGrid/left-center.webp",
  "/assets/bentoGrid/right-bottom.webp",
  "/assets/bentoGrid/left-bottom.webp",
  "/assets/bentoGrid/bottom-center.webp",
];

const MOBILE_BREAKPOINT = 768;
const CENTER_INDEX = 2;
const CENTER_DESKTOP = "/assets/bentoGrid/center.webp";
const CENTER_MOBILE = "/assets/bentoGrid/centerm.webp";

export default function BentoGallery() {
  const wrapRef = useRef(null);
  const galleryRef = useRef(null);
  const flipCtxRef = useRef(null);
  const resizeTimerRef = useRef(null);
  const imgRefs = useRef([]);

  const updateCenterImage = useCallback(() => {
    const img = imgRefs.current[CENTER_INDEX];
    if (!img) return;
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    const next = isMobile ? CENTER_MOBILE : CENTER_DESKTOP;
    if (img.src !== next) img.src = next;
  }, []);

  useEffect(() => {
    updateCenterImage();
    window.addEventListener("resize", updateCenterImage);
    return () => window.removeEventListener("resize", updateCenterImage);
  }, [updateCenterImage]);

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
        ease: "expoScale(1, 5)",
        immediateRender: false,
      });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: galleryEl,
          start: "center center",
          end: "+=100%",
          scrub: 1,
          pin: galleryEl.parentNode,
          anticipatePin: 1,
          preventOverlaps: true,
          fastScrollEnd: true,
          invalidateOnRefresh: true,
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
    createTween();

    const handleResize = () => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        ScrollTrigger.refresh(true);
        createTween();
      }, 250);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(resizeTimerRef.current);
      if (flipCtxRef.current) {
        flipCtxRef.current.revert();
      }
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
          will-change: transform;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        .gallery__item img {
          object-fit: cover;
          width: 100%;
          height: 100%;
          -webkit-touch-callout: none;
          pointer-events: none;
          display: block;
        }

        /* ----------------------------------------------------------------
           Bento grid — compact initial state
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
        ---------------------------------------------------------------- */
        .gallery--final.gallery--bento {
          gap: 1vh;
          grid-template-columns: repeat(3, 100vw);
          grid-template-rows: repeat(4, calc(var(--vh, 1vh) * 49.5));
        }

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
                ref={(el) => (imgRefs.current[i] = el)}
                src={src}
                alt={`Gallery item ${i + 1}`}
                loading={i < 4 ? "eager" : "lazy"}
                decoding="async"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#f5f2e9] px-3 py-8 max-w-5xl mx-auto">
        <MaskText
          ogText="Building software taught me how to design complex full stack systems and deliver reliable user experiences at scale. I work across frontend and backend, integrating APIs and structuring clean architectures that remain efficient over time. Every bug is a signal that reveals deeper patterns, and every solution requires careful thinking and execution. From deploying production systems to mentoring developers, I approach development as a technical and creative journey that pushes me to grow with deep insight and precision."
          ogTextColor="black"
          ogSpan="deep insight"
          ogSpanTextColor="#0ea5e9"
          maskText="Studying medicine taught me how to understand complex human body systems and deliver reliable patient care at scale. I work through symptoms and diagnosis, integrating knowledge and structuring clear reasoning that remains effective over time. Every symptom is a signal that reveals deeper patterns, and every treatment requires careful thinking and execution. From learning clinical practice to supporting patients, I approach medicine as a scientific and human journey that pushes me to grow with deep empathy and precision."
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
