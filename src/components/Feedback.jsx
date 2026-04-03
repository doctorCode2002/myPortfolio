import React from "react";
import MyMarquee from "./MyMarquee";
import TestimonialCard from "./TestimonialCard";
import Section from "./Section";
export default function Feedback() {
  return (
    <Section className="flex flex-col ">
      <h2 className=" font-serif text-center mb-8 text-3xl sm:text-3xl lg:text-4xl  capitalize">
        Testimonials
      </h2>
      <MyMarquee>
        <TestimonialCard index="01" />
        <TestimonialCard index="02" />
        <TestimonialCard index="03" />
        <TestimonialCard index="04" />
      </MyMarquee>
    </Section>
  );
}
