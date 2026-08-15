"use client";

import { useRef, useState, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap, { ScrollTrigger } from "../lib/gsap";
import StudentReviewCard from "./StudentReviewCard";
import { STUDENT_REVIEWS } from "../constants";

export default function StudentReviews() {
  // outerRef = the <section> that gets pinned.
  // sectionRef = inner content div (NOT the pin target — scope and pin must be different elements).
  const outerRef = useRef(null);
  const sectionRef = useRef(null);
  const trackRef = useRef(null);

  // Starts false to match the server-rendered markup (no `window` on the server);
  // corrected to the real viewport width immediately after mount below. Reading
  // `window.innerWidth` directly in the initializer would make the client's first
  // render diverge from the SSR output on mobile viewports — a hydration mismatch.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      ScrollTrigger.refresh();
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile && trackRef.current?.parentElement) {
      trackRef.current.parentElement.scrollLeft = 0;
    }
  }, [isMobile]);

  useGSAP(
    () => {
      if (isMobile) return;

      const outer = outerRef.current;
      const track = trackRef.current;
      const container = track?.parentElement;

      if (!outer || !track || !container) return;

      const navH = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue("--nav-h") || "80",
        10,
      );

      const getDistance = () =>
        Math.max(0, track.scrollWidth - container.clientWidth);

      gsap.to(track, {
        x: () => -getDistance(),
        ease: "none",
        scrollTrigger: {
          trigger: outer,
          start: `top ${navH}px`,
          end: () => `+=${getDistance()}`,
          // scrub: true instead of scrub: 1 — no lerp lag so the animation
          // always matches the scroll position exactly when the pin releases.
          scrub: true,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
    },
    // scope must NOT be the pinned element (outerRef). Use sectionRef (inner div).
    { scope: sectionRef, dependencies: [isMobile] },
  );

  return (
    // Plain <section> so outerRef can reference it directly for pinning.
    <section
      ref={outerRef}
      id="student-reviews"
      className="bg-[#f5f2e9] text-black w-full"
    >
      <div
        ref={sectionRef}
        className="relative flex min-h-[calc(var(--vh,1vh)*100)] flex-col justify-center px-5 py-8 sm:px-10 sm:py-14 lg:min-h-screen lg:px-16 lg:py-16"
      >
        <div className="mb-7 flex flex-col gap-2 sm:mb-10 sm:gap-4 lg:mb-16">
          <p className="text-xs uppercase tracking-[0.24em] text-black/45 sm:text-sm sm:tracking-[0.28em]">
            Student reviews
          </p>

          <h2 className="max-w-4xl font-serif text-4xl leading-[1.05] sm:text-5xl sm:leading-none lg:text-7xl">
            Notes from students I have taught
          </h2>
        </div>

        {/*
          overflow-x-hidden on desktop: clips cards that extend beyond the
          viewport so they don't bleed over adjacent sections.
          snap-x only on mobile; desktop scroll position is driven by GSAP.
        */}
        <div
          data-lenis-prevent={isMobile ? true : undefined}
          className="relative left-1/2 w-screen -translate-x-1/2 overflow-x-auto md:overflow-x-hidden py-8 sm:py-10 scrollbar-none snap-x snap-mandatory md:snap-none"
        >
          <div
            ref={trackRef}
            className="flex w-max gap-5 pl-5 pr-5 sm:gap-7 sm:pl-10 sm:pr-10 lg:gap-14 lg:pl-16 lg:pr-16"
          >
            {STUDENT_REVIEWS.map((review, index) => (
              <StudentReviewCard
                key={`${review.name}-${index}`}
                index={index}
                {...review}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
