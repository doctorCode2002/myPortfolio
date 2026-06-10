import { useRef } from "react";
import gsap from "gsap";

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
      className="relative w-[82vw] max-w-[360px] shrink-0 select-none rounded-[28px] border border-black/5 bg-[#f5f2e9] p-4 shadow-[0_24px_45px_rgba(0,0,0,0.16)] sm:w-[360px] sm:p-5 lg:w-[410px] lg:max-w-[410px] lg:p-6"
    >
      <div
        className="absolute left-1/2 top-0 z-10 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 shadow-[0_12px_18px_rgba(220,38,38,0.35)]"
        aria-hidden="true"
      >
        <span className="absolute left-1/2 top-1 h-8 w-8 -translate-x-1/2 rounded-full bg-red-500" />
        <span className="absolute bottom-1 left-1/2 h-3 w-7 -translate-x-1/2 rounded-full bg-red-800/60" />
      </div>

      <div className="absolute inset-x-8 bottom-0 h-8 translate-y-4 rounded-full bg-black/10 blur-xl" />

      <div
        className={`relative flex min-h-[260px] flex-col justify-between rounded-[18px] border bg-gradient-to-br p-6 ${color.panel} ${color.border} sm:min-h-[290px] lg:min-h-[315px] lg:p-7`}
      >
        <div>
          <div className="mb-7 flex items-start justify-between gap-4">
            <span className={`font-serif text-5xl leading-none ${color.number}`}>
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

          <p className="font-serif text-2xl leading-tight text-black sm:text-3xl">
            "{quote}"
          </p>
        </div>

        <div className="mt-8 border-t border-black/15 pt-4">
          <p className="text-base font-semibold leading-tight text-black">{name}</p>
          <p className="mt-1 text-sm text-black/55">
            {role}
            {company ? <span> / {company}</span> : null}
          </p>
        </div>
      </div>
    </article>
  );
}
