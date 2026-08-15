"use client";

import { useRef } from "react";
import gsap from "../lib/gsap";

const CARD_COLORS = [
  {
    number: "text-[#c47a12]",
    panel: "from-[#fff2d7] to-[#fffaf0]",
    border: "border-[#e6ad58]/70",
  },
  {
    number: "text-[#2f6f91]",
    panel: "from-[#e8f4ff] to-[#f7fbff]",
    border: "border-[#78a8c8]/70",
  },
  {
    number: "text-[#9a3785]",
    panel: "from-[#ffe6f5] to-[#fff7fd]",
    border: "border-[#cd83be]/70",
  },
  {
    number: "text-[#357a53]",
    panel: "from-[#e6f7ea] to-[#f7fff9]",
    border: "border-[#81bd91]/70",
  },
];

export default function StudentReviewCard({
  quote = "The lessons made React feel clear for the first time.",
  name = "mohammed",
  role = "Student",
  company = "Frontend Mentoring",
  rating = 5,
  index = 0,
}) {
  const cardRef = useRef(null);
  const color = CARD_COLORS[index % CARD_COLORS.length];
  const displayIndex = String(index + 1).padStart(2, "0");

  const swingCard = () => {
    gsap.killTweensOf(cardRef.current);
    gsap.to(cardRef.current, {
      keyframes: [
        { rotate: -2.8, duration: 0.14 },
        { rotate: 2.2, duration: 0.14 },
        { rotate: -1.1, duration: 0.12 },
        { rotate: 0.6, duration: 0.1 },
        { rotate: 0, duration: 0.12 },
      ],
      transformOrigin: "50% 8%",
      ease: "power1.inOut",
    });
  };

  const resetCard = () => {
    gsap.to(cardRef.current, {
      rotate: 0,
      y: 0,
      duration: 0.25,
      ease: "power2.out",
    });
  };

  return (
    <article
      ref={cardRef}
      onMouseEnter={swingCard}
      onMouseLeave={resetCard}
      className="relative h-[360px] w-[72vw] max-w-[290px] shrink-0 select-none rounded-[24px] border border-black/5 bg-[#f5f2e9] p-3.5 shadow-[0_20px_36px_rgba(0,0,0,0.14)] sm:h-[430px] sm:w-[330px] sm:max-w-none sm:rounded-[28px] sm:p-5 md:w-[350px] lg:h-[440px] lg:w-[410px] lg:p-6 lg:shadow-[0_24px_45px_rgba(0,0,0,0.16)] snap-center"
    >
      <div
        className="absolute left-1/2 top-0 z-10 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 shadow-[0_12px_18px_rgba(220,38,38,0.35)] sm:h-12 sm:w-12"
        aria-hidden="true"
      >
        <span className="absolute left-1/2 top-1 h-7 w-7 -translate-x-1/2 rounded-full bg-red-500 sm:h-8 sm:w-8" />
        <span className="absolute bottom-1 left-1/2 h-2.5 w-6 -translate-x-1/2 rounded-full bg-red-800/60 sm:h-3 sm:w-7" />
      </div>

      <div className="absolute inset-x-8 bottom-0 h-8 translate-y-4 rounded-full bg-black/10 blur-xl" />

      <div
        className={`relative flex h-full flex-col justify-between rounded-[16px] border bg-linear-to-br p-4 ${color.panel} ${color.border} sm:rounded-[18px] sm:p-5 lg:p-7`}
      >
        <div className="min-h-0">
          <div className="mb-3 flex items-start justify-between gap-4 sm:mb-6">
            <span className={`font-serif text-3xl leading-none sm:text-4xl lg:text-5xl ${color.number}`}>
              {displayIndex}
            </span>

            <div className="flex gap-1 pt-2" aria-label={`${rating} out of 5 rating`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full border border-black/60 ${
                    i < rating ? "bg-black" : "bg-transparent"
                  }`}
                />
              ))}
            </div>
          </div>

          <p className="font-serif text-[13px] leading-6 text-black sm:text-base lg:text-lg">
            &quot;{quote}&quot;
          </p>
        </div>

        <div className="mt-4 border-t border-black/15 pt-3 sm:mt-7 sm:pt-4">
          <p className="text-sm font-semibold leading-tight text-black sm:text-base">{name}</p>
          <p className="mt-1 text-xs text-black/55 sm:text-sm">
            {role}
            {company ? <span> / {company}</span> : null}
          </p>
        </div>
      </div>
    </article>
  );
}
