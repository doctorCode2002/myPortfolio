import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export default function MaskText({
  ogText = "Writing beautiful code means thinking like an artist and debugging like a detective. Every function is a story, every variable a character. Master your craft through practice, patience, and endless curiosity.",
  ogSpan = "beautiful code",
  maskText = "Building great software requires seeing beyond syntax into architecture and design. Test early, refactor often, document clearly. Success comes from collaboration and caring deeply about user experience.",
  maskSpan = "great software",
  bgColor= "#000000",
}) {
  const containerRef = useRef(null);
  const maskRef = useRef(null);
  const ogRef = useRef(null);

  const pos = useRef({ x: -300, y: -300 });
  const size = useRef({ v: 0 });

  const small = 40;
  const large = 200;

  useGSAP(() => {
    const container = containerRef.current;
    const mask = maskRef.current;
    const og = ogRef.current;

    function applyMask() {
      const x = pos.current.x - size.current.v / 2;
      const y = pos.current.y - size.current.v / 2;
      mask.style.setProperty("-webkit-mask-position", `${x}px ${y}px`);
      mask.style.setProperty("mask-position", `${x}px ${y}px`);
      mask.style.setProperty(
        "-webkit-mask-size",
        `${size.current.v}px ${size.current.v}px`,
      );
      mask.style.setProperty(
        "mask-size",
        `${size.current.v}px ${size.current.v}px`,
      );
    }

    gsap.ticker.add(applyMask);

    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      gsap.to(pos.current, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        duration: 0.5,
        ease: "power2.out",
        overwrite: "auto",
      });
    };

    const onMouseEnter = () => {
      gsap.to(size.current, {
        v: small,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
      });
      gsap.to(mask, { autoAlpha: 1, duration: 0.3 });
    };

    const onMouseLeave = () => {
      gsap.to(size.current, {
        v: 0,
        duration: 0.4,
        ease: "power2.in",
        overwrite: "auto",
      });
      gsap.to(mask, { autoAlpha: 0, duration: 0.3 });
    };

    const onOgEnter = () => {
      gsap.to(size.current, {
        v: large,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
      });
    };

    const onOgLeave = () => {
      gsap.to(size.current, {
        v: small,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
      });
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseenter", onMouseEnter);
    container.addEventListener("mouseleave", onMouseLeave);
    og.addEventListener("mouseenter", onOgEnter);
    og.addEventListener("mouseleave", onOgLeave);

    return () => {
      gsap.ticker.remove(applyMask);
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseenter", onMouseEnter);
      container.removeEventListener("mouseleave", onMouseLeave);
      og.removeEventListener("mouseenter", onOgEnter);
      og.removeEventListener("mouseleave", onOgLeave);
    };
  }, []);

  const highlightText = (text, span) => {
    const parts = text.split(span);
    return (
      <>
        {parts[0]}
        <span>{span}</span>
        {parts[1]}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full py-24 ${bgColor} flex justify-center items-center overflow-hidden cursor-none font-[Archivo]`}
    >
      {/* original */}
      <div ref={ogRef} className="flex justify-center items-center">
        <p className="w-150 text-2xl font-medium leading-snug text-white/35 [&>span]:text-[#7ecfb3]">
          {highlightText(ogText, ogSpan)}
        </p>
      </div>

      {/* mask */}
      <div
        ref={maskRef}
        className={`absolute inset-0 flex justify-center items-center bg-[#e8f4f0] opacity-0 pointer-events-none`}
        style={{
          WebkitMaskImage: "url(/assets/circle.png)",
          maskImage: "url(/assets/circle.png)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "0px 0px",
          maskSize: "0px 0px",
          WebkitMaskPosition: "-300px -300px",
          maskPosition: "-300px -300px",
        }}
      >
        <p className="w-150 text-2xl font-medium leading-snug text-[#1a3550] [&>span]:text-[#c0562a]">
          {highlightText(maskText, maskSpan)}
        </p>
      </div>
    </div>
  );
}
