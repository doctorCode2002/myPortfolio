import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Section from "./Section";
import Container from "./Container";
import servicesImg from "/assets/servicesImg.webp";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function Services() {
  const sectionRef = useRef(null);
  const imageRef = useRef(null);
  const textRef = useRef(null);

  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom top",
        scrub: true,
        pin: true,
      },
    });

    // Image scale + parallax
    tl.fromTo(
      imageRef.current,
      { scale: 1 },
      { scale: 1.1, ease: "power1.out" },
    );

    // Text fade in + slide
    tl.from(
      textRef.current.children,
      {
        y: 80,
        opacity: 0,
        stagger: 0.15,
        ease: "power3.out",
      },
      0,
    );
  }, []);

  return (
    <Section id="services" className="rounded-b-2xl bg-black">
      <Container>
        <div
          ref={sectionRef}
          className="relative flex flex-col md:flex-row items-center justify-center gap-10 md:gap-20 h-screen "
        >
          {/* IMAGE */}
          <div className="overflow-hidden  rounded-lg">
            <img
              ref={imageRef}
              src={servicesImg}
              alt="services"
              loading="lazy"
              decoding="async"
              className="object-cover w-full max-w-lg"
            />
            <div className="absolute inset-0 bg-black/30" />
          </div>

          {/* TEXT */}
          <div
            ref={textRef}
            className=" flex flex-col justify-start gap-2 w-full md:max-w-1/2 text-white  z-10"
          >
            <h2 className="text-3xl md:text-5xl font-serif leading-tight w-fit">
              Crafting digital experiences that feel effortless
            </h2>

            <p className="text-sm md:text-base text-white/70 max-w-md">
              I design and develop modern web applications with a focus on
              performance, usability, and clean aesthetics.
            </p>

            <div className="flex flex-col gap-3 text-sm uppercase">
              <span>• Web Development</span>
              <span>• UI/UX Design</span>
              <span>• Interactive Animations</span>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
