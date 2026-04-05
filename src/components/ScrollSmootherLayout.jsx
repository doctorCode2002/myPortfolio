import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import ScrollSmoother from "gsap/ScrollSmoother";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

export default function ScrollSmootherLayout({ children, enabled = true }) {
  const wrapperRef = useRef(null);
  const contentRef = useRef(null);

  useGSAP(() => {
    if (!enabled || !wrapperRef.current || !contentRef.current) return;

    const smoother = ScrollSmoother.create({
      wrapper: wrapperRef.current,
      content: contentRef.current,
      smooth: 1,
      effects: true,
      smoothTouch: 0.1,
    });

    return () => {
      smoother.kill();
    };
  }, { dependencies: [enabled], revertOnUpdate: true });

  return (
    <div ref={wrapperRef} id="smooth-wrapper">
      <div ref={contentRef} id="smooth-content">
        {children}
      </div>
    </div>
  );
}
