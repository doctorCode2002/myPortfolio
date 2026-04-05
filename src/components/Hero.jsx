// import bgvideo from "/assets/bgvideo.mp4";
// import Container from "./Container";
// import { useGSAP } from "@gsap/react";
// import { useRef } from "react";
// import gsap from "gsap";
// import CV from "/assets/CV.pdf";
// import { FaArrowRight } from "react-icons/fa";
// export default function Hero() {
//   const lineRefs = useRef([]);

//   useGSAP(() => {
//     gsap.from(lineRefs.current, {
//       opacity: 0,
//       y: 40,
//       stagger: { amount: 0.3 },
//       ease: "none",
//     });
//   }, []);

//   const lines = ["Building the web", "one pixel at a time."];

//   return (
//     <div className="relative h-screen " id="home">
//       <div className="absolute inset-0 -z-5 pointer-events-none">
//         <video
//           className="absolute inset-0 w-full h-full object-cover object-top"
//           autoPlay
//           muted
//           playsInline
//           loop
//           // preload="auto"
//         >
//           <source src={bgvideo} type="video/mp4" />
//         </video>
//       </div>

//       <div className="absolute inset-0 bg-linear-to-b from-transparent  to-black h-full w-full -z-3" />
//       <Container className="h-screen flex justify-start items-end relative">
//         <main className="w-full flex justify-between items-end pb-16 md:pb-32 font-sans leading-tight md:leading-relaxed  capitalize text-white">
//           <h1 className="text-[clamp(2.2rem,4vw,3.5rem)] ">
//             {lines.map((line, i) => (
//               <span
//                 key={i}
//                 ref={(el) => (lineRefs.current[i] = el)}
//                 className="block"
//               >
//                 {line}
//               </span>
//             ))}
//           </h1>
//           <a
//             href={CV}
//             download
//             className="inline-flex items-center gap-2 text-sm pb-2 relative cursor-pointer capitalize transition- duration-300 group before:content-[''] before:absolute before:left-1/2 before:-translate-x-1/2 before:bottom-0 before:w-0 before:h-0.5 before:bg-white before:transition-all before:duration-300 before:origin-center hover:gap-4 hover:before:w-full"
//           >
//             download CV
//             <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
//           </a>
//         </main>
//       </Container>
//     </div>
//   );
// }

import bgvideo from "/assets/bgvideo.mp4";
import Container from "./Container";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import gsap from "gsap";
import CV from "/assets/CV.pdf";
import { FaArrowRight } from "react-icons/fa";

export default function Hero() {
  const lineRefs = useRef([]);
  const linkRef = useRef(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.from(lineRefs.current, {
      opacity: 0,
      y: 60,
      duration: 0.5,
      stagger: 0.15,
    }).from(
      linkRef.current,
      {
        opacity: 0,
        y: 20,
        // duration: 0.6,
      },
      "-=0.3",
    );
  }, []);

  const lines = ["Building the web", "one pixel at a time."];

  return (
    <div className="relative h-dvh" id="home">
      {/* Background video */}
      <div className="absolute inset-0 -z-5 pointer-events-none">
        <video
          className="absolute inset-0 w-full h-full object-cover object-top"
          data-preload="critical"
          autoPlay
          muted
          playsInline
          loop
          preload="metadata"
        >
          <source src={bgvideo} type="video/mp4" />
        </video>
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-b from-transparent to-black w-full h-full -z-3" />

      <Container className="h-dvh flex justify-start items-end relative">
        <main className="w-full flex flex-col gap-6 sm:flex-row sm:gap-0 sm:justify-between sm:items-end pb-10 sm:pb-16 md:pb-32 font-sans leading-tight capitalize text-white">
          {/* Heading — wrap each line to clip the y-slide */}
          <h1 className="text-[clamp(2rem,6vw,3.5rem)] leading-[1.1]">
            {lines.map((line, i) => (
              <span key={i} className="block overflow-hidden">
                <span
                  ref={(el) => (lineRefs.current[i] = el)}
                  className="block"
                >
                  {line}
                </span>
              </span>
            ))}
          </h1>

          {/* Download CV link */}
          <div ref={linkRef}>
            <a
              href={CV}
              download
              className="self-start sm:self-auto inline-flex items-center gap-2 text-sm pb-2 relative cursor-pointer capitalize transition-all duration-300 group before:content-[''] before:absolute before:left-1/2 before:-translate-x-1/2 before:bottom-0 before:w-0 before:h-0.5 before:bg-white before:transition-all before:duration-300 before:origin-center hover:gap-4 hover:before:w-full"
            >
              download CV
              <FaArrowRight className="transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>
        </main>
      </Container>
    </div>
  );
}
