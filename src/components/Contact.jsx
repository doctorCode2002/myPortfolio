import { useRef } from "react";
import gsap from "../lib/gsap";
import { useGSAP } from "@gsap/react";
import Container from "./Container";
import { CONTACT_DATA } from "../constants";

export default function Contact() {
  const sectionRef = useRef(null);
  const textRef = useRef(null);
  const infoRef = useRef(null);

  useGSAP(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          end: "bottom bottom",
          scrub: true,
        },
      });

      tl.from(textRef.current.children, {
        y: 100,
        opacity: 0,
        stagger: 0.2,
        ease: "power3.out",
      });

      tl.from(
        infoRef.current.children,
        {
          y: 80,
          opacity: 0,
          stagger: 0.15,
          ease: "power2.out",
        },
        0.2,
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <footer
      ref={sectionRef}
      id="contact"
      className="bg-black text-white py-20 border-t border-white/10"
    >
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          {/* LEFT */}
          <div ref={textRef} className="flex flex-col gap-6">
            <h2 className="text-4xl md:text-6xl font-serif leading-tight">
              Let's build something meaningful
            </h2>

            <p className="text-white/60 max-w-md text-sm md:text-base">
              Whether you have an idea, a project, or just want to connect — I'm
              always open to discussing new opportunities.
            </p>
          </div>

          {/* RIGHT */}
          <div
            ref={infoRef}
            className="flex flex-col gap-6 text-sm md:text-base uppercase text-white"
          >
            {CONTACT_DATA.map((item, idx) => (
              <a
                key={idx}
                href={item.link}
                target="_blank"
                className="border-b  border-white/20 pb-2 hover:text-white/70  cursor-pointer"
              >
                {item.text}
              </a>
            ))}

            <span className="text-white/40 pt-6 text-xs normal-case">
              © {new Date().getFullYear()} — All rights reserved
            </span>
          </div>
        </div>
      </Container>
    </footer>
  );
}
