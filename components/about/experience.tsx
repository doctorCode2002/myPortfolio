"use client";

import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { interpolate } from "@/app/[lang]/dictionaries";
import type { Dictionary } from "@/app/[lang]/dictionaries";
import { EXPERIENCE, type ExperienceEntry } from "@/lib/content/about";

const COLLAPSED_COUNT = 2.5;
const ROW_HEIGHT = 64;
const ROW_GAP = 8;

export function Experience({ dict }: { dict: Dictionary }): ReactNode {
  const [open, setOpen] = useState(false);

  const collapsedHeight =
    Math.floor(COLLAPSED_COUNT) * ROW_HEIGHT +
    Math.floor(COLLAPSED_COUNT) * ROW_GAP +
    (COLLAPSED_COUNT % 1) * ROW_HEIGHT;
  const hiddenCount = EXPERIENCE.length - Math.floor(COLLAPSED_COUNT);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold text-foreground">
        {dict.aboutPage.experienceHeading}
      </h2>

      <div className="relative rounded-4xl border border-foreground/10 bg-muted/50 p-2 sm:p-4">
        <motion.div
          initial={false}
          animate={{ height: open ? "auto" : collapsedHeight }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{ overflow: "hidden" }}
        >
          <ul className="flex flex-col gap-2">
            {EXPERIENCE.map((entry) => (
              <ExperienceRow key={entry.id} entry={entry} dict={dict} />
            ))}
          </ul>
        </motion.div>

        <AnimatePresence>
          {!open && hiddenCount > 0 && (
            <motion.div
              key="fade"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{
                height: ROW_HEIGHT,
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                maskImage:
                  "linear-gradient(to bottom, transparent 0%, black 80%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, transparent 0%, black 80%)",
              }}
            />
          )}
        </AnimatePresence>

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`focus-ring flex w-full cursor-pointer items-center justify-center gap-1.5 bg-transparent text-[15px] font-medium text-foreground ${
              open
                ? "relative mt-4"
                : "absolute inset-x-0 bottom-0 z-10 py-3 sm:py-4"
            }`}
          >
            {open
              ? dict.aboutPage.showLess
              : interpolate(dict.aboutPage.showMore, { count: hiddenCount })}
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              className="inline-flex"
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </motion.span>
          </button>
        )}
      </div>
    </div>
  );
}

function ExperienceRow({
  entry,
  dict,
}: {
  entry: ExperienceEntry;
  dict: Dictionary;
}): ReactNode {
  const copy = dict.aboutPage.experience[entry.id];

  return (
    <li
      className="flex items-center gap-4 rounded-3xl border border-foreground/10 bg-background p-2"
      style={{ minHeight: ROW_HEIGHT }}
    >
      <span
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center text-[18px] font-semibold text-white ring-1 ring-foreground/10"
        aria-hidden="true"
        style={{ borderRadius: 14, backgroundColor: entry.brand }}
      >
        {copy.org.charAt(0)}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-[17px] font-semibold text-foreground sm:text-[18px]">
          {copy.org}
        </span>
        <span className="mt-0.5 text-[14px] text-muted-foreground sm:text-[15px]">
          {copy.role}
          <span className="mx-2 text-foreground/25" aria-hidden="true">
            •
          </span>
          <span>{copy.period}</span>
        </span>
      </div>
    </li>
  );
}
