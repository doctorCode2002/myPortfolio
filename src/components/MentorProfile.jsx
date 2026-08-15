"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "../lib/gsap";
import Section from "./Section";
import { MENTOR_POINTS, MENTOR_STATS } from "../constants";

export default function MentorProfile() {
  const sectionRef = useRef(null);
  const contentRef = useRef(null);

  useGSAP(
    () => {
      if (!contentRef.current) return;

      gsap.from(contentRef.current.children, {
        y: 48,
        opacity: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
        },
      });
    },
    { scope: sectionRef },
  );

  return (
    <Section
      id="mentor"
      className="bg-[#f5f2e9] text-black"
    >
      <div ref={sectionRef} className="px-5 py-16 sm:px-10 lg:px-16 lg:py-24">
        <div ref={contentRef} className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="flex flex-col gap-6">
            <p className="text-xs uppercase tracking-[0.24em] text-black/45 sm:text-sm sm:tracking-[0.28em]">
              Mentor profile
            </p>

            <h2 className="max-w-3xl font-serif text-4xl leading-tight sm:text-5xl sm:leading-none lg:text-7xl">
              I teach frontend through real projects
            </h2>

            <p className="max-w-xl text-sm leading-7 text-black/65 sm:text-base">
              I work as a Full Stack Developer and Frontend Instructor, helping students move from concepts to working interfaces through structured practice, code reviews, and clear technical feedback.
            </p>
          </div>

          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 border-y border-black/15 sm:grid-cols-3">
              {MENTOR_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="border-b border-black/15 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:last:border-r-0"
                >
                  <p className="font-serif text-4xl leading-none sm:text-5xl">
                    {stat.value}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-black/50">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4">
              {MENTOR_POINTS.map((point, index) => (
                <div
                  key={point}
                  className="grid grid-cols-[48px_1fr] gap-4 border-b border-black/15 pb-4"
                >
                  <span className="font-serif text-2xl leading-none text-black/35">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="text-sm leading-7 text-black/75 sm:text-base">
                    {point}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
