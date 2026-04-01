import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export default function MaskText({
  ogText = "Writing beautiful code means thinking like an artist and debugging like a detective. Every function is a story, every variable a character. Master your craft through practice, patience, and endless curiosity.",
  ogTextColor = "#000000",
  ogSpan = "beautiful code",
  ogSpanTextColor = "#c0562a",
  maskText = "Building great software requires seeing beyond syntax into architecture and design. Test early, refactor often, document clearly. Success comes from collaboration and caring deeply about user experience.",
  maskSpan = "great software",
  maskTextColor = "#000000",
  maskSpanTextColor = "#c0562a",
  maskColor = "#ffffff",
  bgColor = "#000000",
}) {
  const containerRef = useRef(null);
  const maskRef = useRef(null);
  const ogRef = useRef(null);

  const pos = useRef({ x: -300, y: -300 });
  const size = useRef({ v: 0 });

  const small = 20;
  const large = 100;

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

  const highlightText = (text, span, color) => {
    const parts = text.split(span);
    return (
      <>
        {parts[0]}
        <span style={{ color }}>{span}</span>
        {parts[1]}
      </>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full p-12 flex justify-center items-center  md:cursor-none`}
      style={{ backgroundColor: bgColor }}
    >
      {/* Original text */}
      <div ref={ogRef} className="flex justify-center items-center">
        <p
          className="w-fit md:w-150 max-w-4xl text-lg sm:text-xl md:text-2xl lg:text-3xl font-medium leading-snug m-0 md:m-8"
          style={{ color: ogTextColor }}
        >
          {highlightText(ogText, ogSpan, ogSpanTextColor)}
        </p>
      </div>

      {/* Masked text */}
      <div
        ref={maskRef}
        className="absolute hidden md:flex w-full h-full top-1/2 left-1/2 -translate-1/2  justify-center items-center pointer-events-none opacity-0"
        style={{
          backgroundColor: maskColor,
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
        <p
          className="w-150 max-w-4xl text-lg sm:text-xl md:text-2xl lg:text-3xl font-medium leading-snug m-8"
          style={{ color: maskTextColor }}
        >
          {highlightText(maskText, maskSpan, maskSpanTextColor)}
        </p>
      </div>
    </div>
  );
}
