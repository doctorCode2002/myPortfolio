"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "../lib/gsap";
import Section from "./Section";
import Container from "./Container";
import StudentReviewCard from "./StudentReviewCard";
import { STUDENT_REVIEWS } from "../constants";

export default function StudentReviews() {
  const gridRef = useRef(null);

  useGSAP(() => {
    gsap.from(gridRef.current.children, {
      y: 60,
      opacity: 0,
      duration: 0.8,
      stagger: 0.12,
      ease: "power3.out",
      scrollTrigger: {
        trigger: gridRef.current,
        start: "top 85%",
      },
    });
  }, []);

  return (
    <Section id="student-reviews" className="bg-[#f5f2e9] text-black">
      <Container>
        <div className="mb-10 flex flex-col gap-2 sm:mb-14 sm:gap-4 lg:mb-16">
          <p className="text-xs uppercase tracking-[0.24em] text-black/45 sm:text-sm sm:tracking-[0.28em]">
            Student reviews
          </p>

          <h2 className="max-w-4xl font-serif text-4xl leading-[1.05] sm:text-5xl sm:leading-none lg:text-7xl">
            Notes from students I have taught
          </h2>
        </div>

        <div
          ref={gridRef}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3 lg:gap-10"
        >
          {STUDENT_REVIEWS.map((review, index) => (
            <StudentReviewCard
              key={`${review.name}-${index}`}
              index={index}
              {...review}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
