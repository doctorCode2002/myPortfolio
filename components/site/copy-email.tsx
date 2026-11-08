"use client";

import { useState, type ReactNode } from "react";

/** Shows the address and copies it — for visitors without a mail client set up. */
export function CopyEmail({
  email,
  labels,
}: {
  email: string;
  labels: { copy: string; copied: string };
}): ReactNode {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(email).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        });
      }}
      className="group text-foreground/70 hover:text-foreground inline-flex items-center gap-3 font-mono text-[13px] break-all transition-colors"
    >
      <span className="decoration-foreground/25 underline underline-offset-[6px]">
        {email}
      </span>
      <span
        className="text-muted-foreground text-[10px] tracking-[0.18em] uppercase"
        aria-live="polite"
      >
        {copied ? labels.copied : labels.copy}
      </span>
    </button>
  );
}
