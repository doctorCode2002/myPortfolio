import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Section from "./Section";
import StudentReviewCard from "./StudentReviewCard";
import { STUDENT_REVIEWS } from "../constants";

gsap.registerPlugin(ScrollTrigger);

export default function StudentReviews() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);

  useGSAP(
    () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      if (!section || !track) return;

      const getDistance = () => {
        return Math.max(0, track.scrollWidth - window.innerWidth);
      };

      const tween = gsap.to(track, {
        x: () => -getDistance(),
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${getDistance()}`,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });

      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    },
    { scope: sectionRef },
  );

  return (
    <Section
      id="student-reviews"
      className="overflow-x-hidden bg-[#f5f2e9] py-0 text-black"
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

        <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-visible py-8 sm:py-10">
          <div
            ref={trackRef}
            className="flex w-max gap-5 pl-5 pr-5 sm:gap-7 sm:pl-10 sm:pr-10 lg:gap-14 lg:pl-16 lg:pr-16"
          >
            {STUDENT_REVIEWS.map((review, index) => (
              <StudentReviewCard key={review.name} index={index} {...review} />
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}
