import React from "react";
import MyMarquee from "./MyMarquee";
import TestimonialCard from "./TestimonialCard";
import Section from "./Section";
import { TESTIMONIALS } from "../constants";
export default function Feedback() {
  return (
    <Section className="flex flex-col bg-[#f5f2e9]">
      <h2 className=" font-serif text-center mb-8 text-3xl sm:text-3xl lg:text-4xl  capitalize">
        Testimonials
      </h2>
      <MyMarquee>
        {TESTIMONIALS.map((testimonial, index) => (
          <TestimonialCard key={index} {...testimonial} />
        ))}
      </MyMarquee>
    </Section>
  );
}
