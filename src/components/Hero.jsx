import bgvideo1 from "/bgvideo1.mp4";
import bgvideo2 from "/bgvideo2.mp4";
import Container from "./Container";
import { useGSAP } from "@gsap/react";
import { useRef, useEffect } from "react";
import gsap from "gsap";

export default function Hero() {
  const lineRefs = useRef([]);
  const video1Ref = useRef(null);
  const video2Ref = useRef(null);

  useEffect(() => {
    const v1 = video1Ref.current;
    const v2 = video2Ref.current;

    // Pre-load and pause the second video so it's ready
    v2.load();

    const handleVideo1End = () => {
      video1Ref.current.style.opacity = 0;
      video2Ref.current.style.opacity = 1;
      video2Ref.current.play();
    };

    v1.addEventListener("ended", handleVideo1End);
    return () => v1.removeEventListener("ended", handleVideo1End);
  }, []);

  useGSAP(() => {
    gsap.from(lineRefs.current, {
      opacity: 0,
      y: 40,
      stagger: { amount: 0.3 },
      ease: "none",
    });
  }, []);

  const lines = ["Building the web", "one pixel at a time."];

  return (
    <div className="relative h-screen" id="home">
      <div className="absolute inset-0 -z-5 pointer-events-none">
        {/* First video */}
        <video
          ref={video1Ref}
          className="absolute inset-0 w-full h-full object-cover object-top"
          autoPlay
          muted
          playsInline
          preload="auto"
        >
          <source src={bgvideo1} type="video/mp4" />
        </video>

        {/* Second video — hidden until first ends */}
        <video
          ref={video2Ref}
          className="absolute inset-0 w-full h-full object-cover object-top opacity-0"
          muted
          playsInline
          preload="auto"
          loop
        >
          <source src={bgvideo2} type="video/mp4" />
        </video>
      </div>

      <div className="absolute inset-0 bg-linear-to-b from-transparent from-40% to-black h-full w-full" />
      <Container className="h-screen flex justify-start items-end relative">
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
