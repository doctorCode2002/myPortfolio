import React, { useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import ScrollSmootherLayout from "./components/ScrollSmootherLayout.jsx";
import Hero from "./components/Hero.jsx";
import About from "./components/About.jsx";
import Services from "./components/Services.jsx";
import Contact from "./components/Contact.jsx";
import Work from "./components/Work.jsx";
import Feedback from "./components/Feedback.jsx";

const ASSET_TIMEOUT_MS = 8000;
const MIN_LOADER_MS = 450;

export default function App() {
  const [targetProgress, setTargetProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const loaderStartRef = useRef(0);
  const roundedDisplayProgress = Math.round(displayProgress);

  useEffect(() => {
    loaderStartRef.current = performance.now();

    let loadedCount = 0;
    let isCancelled = false;
    const cleanupFns = [];
    const timeoutIds = [];
    const criticalImages = Array.from(
      document.querySelectorAll('img[data-preload="critical"]'),
    );
    const criticalVideos = Array.from(
      document.querySelectorAll('video[data-preload="critical"]'),
    );
    const includesFonts = Boolean(document.fonts?.ready);
    const totalAssets =
      criticalImages.length + criticalVideos.length + (includesFonts ? 1 : 0) + 1; // +1 for window load

    const updateProgress = () => {
      if (isCancelled) return;
      const next = Math.round((loadedCount / totalAssets) * 100);
      setTargetProgress((prev) => Math.max(prev, next));
    };

    const markLoaded = (teardown) => {
      if (teardown) teardown();
      if (isCancelled) return;
      loadedCount += 1;
      updateProgress();
    };

    const createOnceDone = (teardown) => {
      let done = false;

      return () => {
        if (done) return;
        done = true;
        markLoaded(teardown);
      };
    };

    criticalImages.forEach((image) => {
      if (image.complete) {
        markLoaded();
        return;
      }

      let assetTimeout = 0;
      let onLoad = null;
      let onError = null;
      const onDone = createOnceDone(() => {
        if (onLoad) image.removeEventListener("load", onLoad);
        if (onError) image.removeEventListener("error", onError);
        window.clearTimeout(assetTimeout);
      });

      assetTimeout = window.setTimeout(onDone, ASSET_TIMEOUT_MS);
      timeoutIds.push(assetTimeout);

      onLoad = () => onDone();
      onError = () => onDone();
      image.addEventListener("load", onLoad, { once: true });
      image.addEventListener("error", onError, { once: true });
      cleanupFns.push(() => {
        image.removeEventListener("load", onLoad);
        image.removeEventListener("error", onError);
        window.clearTimeout(assetTimeout);
      });
    });

    criticalVideos.forEach((video) => {
      if (video.readyState >= 2) {
        markLoaded();
        return;
      }

      let assetTimeout = 0;
      let onLoadedData = null;
      let onError = null;
      const onDone = createOnceDone(() => {
        if (onLoadedData) video.removeEventListener("loadeddata", onLoadedData);
        if (onError) video.removeEventListener("error", onError);
        window.clearTimeout(assetTimeout);
      });

      assetTimeout = window.setTimeout(onDone, ASSET_TIMEOUT_MS);
      timeoutIds.push(assetTimeout);

      onLoadedData = () => onDone();
      onError = () => onDone();
      video.addEventListener("loadeddata", onLoadedData, { once: true });
      video.addEventListener("error", onError, { once: true });
      cleanupFns.push(() => {
        video.removeEventListener("loadeddata", onLoadedData);
        video.removeEventListener("error", onError);
        window.clearTimeout(assetTimeout);
      });
    });

    const onFontsDone = createOnceDone();
    if (includesFonts) {
      let fontTimeout = 0;
      fontTimeout = window.setTimeout(onFontsDone, ASSET_TIMEOUT_MS);
      timeoutIds.push(fontTimeout);
      document.fonts.ready.finally(() => {
        window.clearTimeout(fontTimeout);
        onFontsDone();
      });
    } else {
      onFontsDone();
    }

    const onWindowLoaded = createOnceDone();

    if (document.readyState === "complete") {
      onWindowLoaded();
    } else {
      window.addEventListener("load", onWindowLoaded, { once: true });
      cleanupFns.push(() =>
        window.removeEventListener("load", onWindowLoaded),
      );
    }

    return () => {
      isCancelled = true;
      cleanupFns.forEach((fn) => fn());
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    let rafId = 0;

    const animate = () => {
      setDisplayProgress((current) => {
        if (current >= targetProgress || targetProgress <= 0) {
          return current;
        }

        const diff = targetProgress - current;
        const step = diff > 20 ? 3.2 : diff > 8 ? 1.8 : 0.8;
        const next = Math.min(current + step, targetProgress);

        if (next < targetProgress) {
          rafId = window.requestAnimationFrame(animate);
        }

        return next;
      });
    };

    rafId = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(rafId);
  }, [targetProgress]);

  useEffect(() => {
    if (targetProgress !== 100 || roundedDisplayProgress !== 100) return;

    const elapsed = performance.now() - loaderStartRef.current;
    const delay = Math.max(0, MIN_LOADER_MS - elapsed);

    const doneTimer = window.setTimeout(() => {
      setIsReady(true);
    }, delay);

    return () => window.clearTimeout(doneTimer);
  }, [targetProgress, roundedDisplayProgress]);

  useEffect(() => {
    if (isReady) return;

    const scrollY = window.scrollY;
    const previousStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      top: document.body.style.top,
      overscrollBehaviorY: document.documentElement.style.overscrollBehaviorY,
    };

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    document.body.style.top = `-${scrollY}px`;
    document.documentElement.style.overscrollBehaviorY = "none";

    return () => {
      document.body.style.overflow = previousStyles.overflow;
      document.body.style.position = previousStyles.position;
      document.body.style.width = previousStyles.width;
      document.body.style.top = previousStyles.top;
      document.documentElement.style.overscrollBehaviorY =
        previousStyles.overscrollBehaviorY;
      window.scrollTo(0, scrollY);
    };
  }, [isReady]);

  return (
    <div className="bg-black relative flex justify-center">
      {!isReady && (
        <div className="fixed inset-0 z-9999 bg-black flex items-center justify-center">
          <div className="w-[min(440px,80vw)]">
            <div
              className="h-1 w-full bg-white/20 overflow-hidden"
              role="progressbar"
              aria-label="Page loading progress"
              aria-valuenow={roundedDisplayProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-white transition-[width] duration-150 ease-out"
                style={{ width: `${roundedDisplayProgress}%` }}
              />
            </div>
            <p className="mt-4 text-center text-white text-sm tabular-nums" aria-live="polite">
              {roundedDisplayProgress}%
            </p>
          </div>
        </div>
      )}

      <div className={isReady ? "w-full flex flex-col items-center justify-center" : "w-full invisible"}>
        <Navbar />
        <ScrollSmootherLayout enabled={isReady}>
          <Hero />
          <Services />
          <About />
          <Work />
          <Feedback />
          <Contact />
        </ScrollSmootherLayout>
      </div>
    </div>
  );
}
