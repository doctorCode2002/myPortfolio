import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import MaskText from "./MaskText";

gsap.registerPlugin(ScrollTrigger, Flip);

const IMAGES = [
  "https://assets.codepen.io/16327/portrait-pattern-1.jpg",
  "https://assets.codepen.io/16327/portrait-image-12.jpg",
  "https://assets.codepen.io/16327/portrait-image-8.jpg",
  "/assets/bentoGrid/top-right.png",
  "https://assets.codepen.io/16327/portrait-image-4.jpg",
  "https://assets.codepen.io/16327/portrait-image-3.jpg",
  "https://assets.codepen.io/16327/portrait-pattern-3.jpg",
  "https://assets.codepen.io/16327/portrait-image-1.jpg",
];

// Bento grid areas for initial state (compact)
const BENTO_AREAS = [
  "1 / 1 / 3 / 2",
  "1 / 2 / 2 / 3",
  "2 / 2 / 4 / 3",
  "1 / 3 / 3 / 3",
  "3 / 1 / 3 / 2",
  "3 / 3 / 5 / 4",
  "4 / 1 / 5 / 2",
  "4 / 2 / 5 / 3",
];

export default function BentoGallery() {
  const wrapRef = useRef(null);
  const galleryRef = useRef(null);
  const flipCtxRef = useRef(null);

  useEffect(() => {
    const createTween = () => {
      const galleryEl = galleryRef.current;
      if (!galleryEl) return;

      const galleryItems = galleryEl.querySelectorAll(".gallery__item");

      // Clean up previous context
      if (flipCtxRef.current) {
        flipCtxRef.current.revert();
      }
      galleryEl.classList.remove("gallery--final");

      flipCtxRef.current = gsap.context(() => {
        // Capture the final expanded state
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
            pin: galleryEl.parentNode,
          },
        });

        tl.add(flip);

        return () => gsap.set(galleryItems, { clearProps: "all" });
      });
    };

    createTween();
    window.addEventListener("resize", createTween);

    return () => {
      window.removeEventListener("resize", createTween);
      if (flipCtxRef.current) {
        flipCtxRef.current.revert();
      }
    };
  }, []);

  return (
    <>
      <style>{`
        .gallery-wrap {
          position: relative;
          width: 100%;
          height: 100vh;
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
        }
        .gallery__item img {
          object-fit: cover;
          width: 100%;
          height: 100%;
        }
        .gallery--bento {
          display: grid;
          gap: 1vh;
          grid-template-columns: repeat(3, 32.5vw);
          grid-template-rows: repeat(4, 23vh);
          justify-content: center;
          align-content: center;
        }
        .gallery--final.gallery--bento {
          grid-template-columns: repeat(3, 100vw);
          grid-template-rows: repeat(4, 49.5vh);
          gap: 1vh;
        }
        .gallery--bento .gallery__item:nth-child(1) { grid-area: 1 / 1 / 3 / 2; }
        .gallery--bento .gallery__item:nth-child(2) { grid-area: 1 / 2 / 2 / 3; }
        .gallery--bento .gallery__item:nth-child(3) { grid-area: 2 / 2 / 4 / 3; }
        .gallery--bento .gallery__item:nth-child(4) { grid-area: 1 / 3 / 3 / 3; }
        .gallery--bento .gallery__item:nth-child(5) { grid-area: 3 / 1 / 3 / 2; }
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
              <img src={src} alt={`Gallery item ${i + 1}`} />
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
