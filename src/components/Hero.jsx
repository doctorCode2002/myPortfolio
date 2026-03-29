import bg from "/bg.png";
import Container from "./Container";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import gsap from "gsap";

export default function Hero() {
  const lineRefs = useRef([]);

  useGSAP(() => {
    // Animate each line with fade-in and slight upward movement
    gsap.from(lineRefs.current, {
      opacity: 0,
      y: 40,
      stagger: {
        amount: 0.3,
      },
      ease: "none",
    });
  }, []);

  const lines = ["Building the web", "one pixel at a time."];
  return (
    <div className="relative h-screen" id="home">
      <div className="absolute inset-0 -z-5 pointer-events-none">
        <img src={bg} alt="" className=" w-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-linear-to-b from-transparent from-40% to-black h-full w-full " />
      <Container className="h-screen flex justify-start items-end relative ">
        <main>
          <h1 className="text-5xl font-serif leading-relaxed pb-40 capitalize text-white">
            {lines.map((line, i) => (
              <span
                key={i}
                ref={(el) => (lineRefs.current[i] = el)}
                className="block"
              >
                {line}
              </span>
            ))}
          </h1>
        </main>
      </Container>
    </div>
  );
}
