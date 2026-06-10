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

      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        const getDistance = () => {
          return Math.max(0, track.scrollWidth - window.innerWidth + 96);
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
            invalidateOnRefresh: true,
          },
        });

        return () => {
          tween.scrollTrigger?.kill();
          tween.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: sectionRef },
  );

  return (
    <Section
      id="student-reviews"
      className="bg-[#eee9dd] py-16 text-black sm:py-20 lg:overflow-hidden lg:py-0"
    >
      <div
        ref={sectionRef}
        className="relative flex min-h-screen flex-col justify-center overflow-x-auto px-5 py-16 md:overflow-hidden sm:px-10 lg:px-16"
      >
        <div className="mb-10 flex flex-col gap-4 sm:mb-14 lg:mb-16">
          <p className="text-sm uppercase tracking-[0.28em] text-black/45">
            Student reviews
          </p>
          <h2 className="max-w-4xl font-serif text-4xl leading-none sm:text-6xl lg:text-7xl">
            Notes from students I have taught
          </h2>
        </div>

        <div
          ref={trackRef}
          className="flex w-max gap-7 pr-5 sm:gap-10 sm:pr-16 lg:gap-14"
        >
          {STUDENT_REVIEWS.map((review, index) => (
            <StudentReviewCard key={review.name} index={index} {...review} />
          ))}
        </div>
      </div>
    </Section>
  );
}
