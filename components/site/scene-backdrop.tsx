"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";

import { useMotionAllowed } from "@/lib/motion";

/**
 * A futuristic scene (public/assets/scenes) painted behind a section. The
 * subject sits on the right of every scene, so the image is faded into the
 * page from the start side and the bottom — text on the left stays on near
 * black. Purely decorative: the image is alt="" and the video has no audio.
 *
 * With `video`, the still is the poster and stays painted underneath; the loop
 * plays only while motion is allowed and the section is on screen.
 */
export function SceneBackdrop({
  src,
  video,
  position = "70% 40%",
  preload = false,
  opacity = 1,
  className = "",
}: {
  src: string;
  /** Path without extension; `.webm` and `.mp4` are both expected. */
  video?: string;
  /** CSS object-position, so the subject survives narrow crops. */
  position?: string;
  preload?: boolean;
  opacity?: number;
  className?: string;
}): ReactNode {
  const allowed = useMotionAllowed();
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!allowed) {
      el.pause();
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void el.play().catch(() => {});
      else el.pause();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [allowed]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity }}
    >
      <Image
        src={src}
        alt=""
        fill
        preload={preload}
        sizes="100vw"
        className="object-cover"
        style={{ objectPosition: position }}
      />
      {video && allowed ? (
        <video
          ref={ref}
          poster={src}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: position }}
        >
          <source src={`${video}.webm`} type="video/webm" />
          <source src={`${video}.mp4`} type="video/mp4" />
        </video>
      ) : null}
      <div className="from-background via-background/70 absolute inset-0 hidden bg-gradient-to-r to-transparent md:block rtl:bg-gradient-to-l" />
      <div className="bg-background/60 absolute inset-0 md:hidden" />
      <div className="from-background absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t to-transparent" />
      <div className="from-background absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b to-transparent" />
    </div>
  );
}
