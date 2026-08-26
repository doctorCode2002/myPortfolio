"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import Image from "next/image";
import { useRef, useSyncExternalStore, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { POLAROIDS, type Polaroid } from "@/lib/content/about";
import { useReducedMotion } from "@/lib/motion";

const EASE = [0.22, 1, 0.36, 1] as const;

function PolaroidCard({
  photo,
  index,
  alt,
  reduced,
}: {
  photo: Polaroid;
  index: number;
  alt: string;
  reduced: boolean;
}): ReactNode {
  const ref = useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 220, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 220, damping: 18, mass: 0.6 });
  const tx = useTransform(sx, (v) => `${v}px`);
  const ty = useTransform(sy, (v) => `${v}px`);

  const handleMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const max = 18;
    mx.set(Math.max(-max, Math.min(max, dx * 0.25)));
    my.set(Math.max(-max, Math.min(max, dy * 0.25)));
  };

  const handleLeave = (): void => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      initial={
        reduced
          ? { opacity: 0, rotate: photo.rotate }
          : { opacity: 0, y: -120, filter: "blur(18px)", rotate: photo.rotate }
      }
      animate={
        reduced
          ? { opacity: 1, rotate: photo.rotate }
          : { opacity: 1, y: 0, filter: "blur(0px)", rotate: photo.rotate }
      }
      transition={{
        duration: reduced ? 0.2 : 0.9,
        delay: reduced ? 0 : 0.05 + index * 0.08,
        ease: EASE,
      }}
      style={{ x: tx, y: ty, rotate: photo.rotate }}
      className="relative aspect-[3/4] w-[clamp(6rem,11vw,9rem)] shrink-0 overflow-hidden rounded-2xl border-6 border-neutral-300/50 bg-white p-1.5 dark:border-white/15 dark:bg-neutral-900"
    >
      <div className="relative h-full w-full overflow-hidden rounded-xl bg-muted">
        <Image
          src={photo.src}
          alt={alt}
          fill
          sizes="(min-width: 640px) 11vw, 40vw"
          className="object-cover grayscale"
          draggable={false}
        />
      </div>
    </motion.div>
  );
}

export function PolaroidStrip({ dict }: { dict: Dictionary }): ReactNode {
  const reduced = useReducedMotion();

  // The cards read pointer geometry on mount, so they render only client-side;
  // the placeholder reserves their height to avoid a layout jump.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div aria-hidden="true" className="h-[clamp(8rem,15vw,12rem)] w-full" />
    );
  }

  return (
    <div className="flex w-full flex-wrap items-start justify-center gap-1 px-4 sm:gap-1.5 sm:px-8">
      {POLAROIDS.map((photo, i) => (
        <PolaroidCard
          key={photo.id}
          photo={photo}
          index={i}
          alt={dict.aboutPage.polaroids[photo.id]}
          reduced={reduced}
        />
      ))}
    </div>
  );
}
