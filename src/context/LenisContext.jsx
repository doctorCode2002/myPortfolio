"use client";

import { useEffect, useState } from "react";
import Lenis from "lenis";
import gsap, { ScrollTrigger } from "../lib/gsap";
import { LenisContext } from "./useLenis";

export function LenisProvider({ children }) {
  const [lenis, setLenis] = useState(null);

  useEffect(() => {
    const lenisInstance = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });

    // Lenis is an external system instance, not derived state — one-time init.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLenis(lenisInstance);

    lenisInstance.on("scroll", ScrollTrigger.update);
    gsap.ticker.lagSmoothing(0);

    const updateLenis = (time) => {
      lenisInstance.raf(time * 1000);
    };
    gsap.ticker.add(updateLenis);

    if (history.scrollRestoration) {
      history.scrollRestoration = "manual";
    }

    return () => {
      gsap.ticker.remove(updateLenis);
      lenisInstance.destroy();
      setLenis(null);
    };
  }, []);

  return (
    <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
  );
}
