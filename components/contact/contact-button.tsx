"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Mail } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { EMAIL } from "@/lib/content/contact";

const EASE = [0.22, 1, 0.36, 1] as const;

export type ContactButtonLabels = {
  showEmail: string;
  copyEmail: string;
  copied: string;
  contactLabel: string;
};

export function ContactButton({
  labels,
}: {
  labels: ContactButtonLabels;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const flagCopied = (): void => {
    setCopied(true);
    if (timeoutRef.current !== undefined) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(EMAIL);
      flagCopied();
    } catch {
      const ta = document.createElement("textarea");
      ta.value = EMAIL;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        flagCopied();
      } catch {
        // Clipboard unavailable — the address is on screen to copy by hand.
      }
      document.body.removeChild(ta);
    }
  };

  return (
    <motion.button
      type="button"
      layout
      onClick={() => void handleCopy()}
      onHoverStart={() => setOpen(true)}
      onHoverEnd={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-label={
        copied
          ? labels.copied
          : open
            ? labels.copyEmail.replace("{email}", EMAIL)
            : labels.showEmail
      }
      transition={{ layout: { duration: 0.55, ease: EASE } }}
      style={{ borderRadius: 12 }}
      className="focus-ring relative inline-flex h-11 cursor-pointer items-center justify-center bg-accent px-5 text-sm font-medium text-accent-foreground"
    >
      <span aria-live="polite" className="sr-only">
        {copied ? labels.copied : ""}
      </span>
      <motion.span
        layout="position"
        className="relative inline-flex items-center"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {open ? (
            <motion.span
              key="email"
              layout="position"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.35, ease: EASE }}
              className="inline-flex items-center gap-2 whitespace-nowrap"
            >
              <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
                <AnimatePresence initial={false} mode="wait">
                  {copied ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="inline-flex"
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="inline-flex"
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span dir="ltr" className="tabular-nums">
                {EMAIL}
              </span>
            </motion.span>
          ) : (
            <motion.span
              key="contact"
              layout="position"
              initial={{ opacity: 0, filter: "blur(8px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(8px)" }}
              transition={{ duration: 0.35, ease: EASE }}
              className="inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{labels.contactLabel}</span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
    </motion.button>
  );
}
