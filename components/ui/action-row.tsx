"use client";

import { ArrowRight, Download } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  ContactButton,
  type ContactButtonLabels,
} from "@/components/contact/contact-button";

const EASE = [0.22, 1, 0.36, 1] as const;

export type SecondaryAction = {
  href: string;
  label: string;
  icon?: "arrow" | "download";
  /** Set for file links so the browser downloads rather than navigates. */
  download?: boolean;
};

/**
 * The copy-email primary plus one or more secondary links. Shared by the hero
 * and the contact card so the two never drift apart.
 */
export function ActionRow({
  contactLabels,
  secondary,
}: {
  contactLabels: ContactButtonLabels;
  secondary: readonly SecondaryAction[];
}): ReactNode {
  return (
    <LayoutGroup>
      <motion.div
        layout
        transition={{ layout: { duration: 0.55, ease: EASE } }}
        className="mt-2 flex flex-wrap items-center gap-3"
      >
        <ContactButton labels={contactLabels} />

        {secondary.map((action) => (
          <motion.div
            key={action.href}
            layout
            transition={{ layout: { duration: 0.55, ease: EASE } }}
          >
            <Link
              href={action.href}
              {...(action.download === true
                ? // A file, not a page: no RSC prefetch for it.
                  { download: true, prefetch: false }
                : {})}
              className="focus-ring group border-foreground/10 bg-background text-foreground hover:border-accent/40 hover:bg-accent/5 inline-flex cursor-pointer items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium shadow-sm transition-colors"
            >
              {action.label}
              {action.icon === "download" ? (
                <Download className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                  aria-hidden="true"
                />
              )}
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </LayoutGroup>
  );
}
