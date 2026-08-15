"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { ScrollTrigger } from "../lib/gsap";
import { LenisProvider } from "../context/LenisContext.jsx";

export default function PageShell({ children }) {
  const [targetProgress, setTargetProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty(
        "--vh",
        `${window.innerHeight * 0.01}px`,
      );
    };
    setVh();
    window.addEventListener("resize", setVh);
    return () => window.removeEventListener("resize", setVh);
  }, []);

  useEffect(() => {
    let loadedCount = 0;
    let isWindowLoadedCounted = false;
    const cleanupFns = [];

    const images = Array.from(document.images);
    const videos = Array.from(document.querySelectorAll("video"));
    const totalAssets = images.length + videos.length + 1; // +1 for full window load

    const updateProgress = () => {
      const next = Math.round((loadedCount / totalAssets) * 100);
      setTargetProgress((prev) => Math.max(prev, next));
    };

    const markLoaded = () => {
      loadedCount += 1;
      updateProgress();
    };

    images.forEach((image) => {
      if (image.complete) {
        markLoaded();
        return;
      }

      const onLoad = () => markLoaded();
      const onError = () => markLoaded();
      image.addEventListener("load", onLoad, { once: true });
      image.addEventListener("error", onError, { once: true });
      cleanupFns.push(() => {
        image.removeEventListener("load", onLoad);
        image.removeEventListener("error", onError);
      });
    });

    videos.forEach((video) => {
      if (video.readyState >= 3) {
        markLoaded();
        return;
      }

      const onLoadedData = () => markLoaded();
      const onError = () => markLoaded();
      video.addEventListener("loadeddata", onLoadedData, { once: true });
      video.addEventListener("error", onError, { once: true });
      cleanupFns.push(() => {
        video.removeEventListener("loadeddata", onLoadedData);
        video.removeEventListener("error", onError);
      });
    });

    const onWindowLoaded = () => {
      if (isWindowLoadedCounted) return;
      isWindowLoadedCounted = true;
      markLoaded();
      setTargetProgress(100);
    };

    if (document.readyState === "complete") {
      onWindowLoaded();
    } else {
      window.addEventListener("load", onWindowLoaded, { once: true });
      cleanupFns.push(() =>
        window.removeEventListener("load", onWindowLoaded),
      );
    }

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (displayProgress >= targetProgress) return;

    const timer = window.setInterval(() => {
      setDisplayProgress((current) => {
        if (current >= targetProgress) return current;
        const diff = targetProgress - current;
        const step = diff > 12 ? 4 : 1;
        return Math.min(current + step, targetProgress);
      });
    }, 16);

    return () => window.clearInterval(timer);
  }, [targetProgress, displayProgress]);

  useEffect(() => {
    if (targetProgress !== 100 || displayProgress !== 100) return;

    const doneTimer = window.setTimeout(() => {
      setIsReady(true);
    }, 200);

    return () => window.clearTimeout(doneTimer);
  }, [targetProgress, displayProgress]);

  useEffect(() => {
    document.body.style.overflow = isReady ? "" : "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isReady]);

  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  return (
    <div className="bg-black relative flex justify-center">
      <Analytics />
      {!isReady && (
        <div className="fixed inset-0 z-9999 bg-black flex items-center justify-center">
          <div className="w-[min(440px,80vw)]">
            <div className="h-1 w-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-white transition-[width] duration-150 ease-out"
                style={{ width: `${displayProgress}%` }}
              />
            </div>
            <p className="mt-4 text-center text-white text-sm tabular-nums">
              {displayProgress}%
            </p>
          </div>
        </div>
      )}

      <div className={isReady ? "w-full flex flex-col" : "w-full invisible"}>
        <LenisProvider>{children}</LenisProvider>
      </div>
    </div>
  );
}
