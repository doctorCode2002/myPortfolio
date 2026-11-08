import type { ReactNode } from "react";

/**
 * Typographic stand-in for a portrait: the "Ma" monogram from the header, set
 * huge in Instrument Serif over an ember glow, with a hairline grid and a
 * caption. Decorative — the name is already in the surrounding copy.
 */
export function MonogramPanel({
  caption,
  className = "",
}: {
  caption?: string;
  className?: string;
}): ReactNode {
  return (
    <div
      aria-hidden="true"
      className={`border-line bg-surface relative isolate overflow-hidden ${className}`}
    >
      <div
        className="absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div
        className="absolute inset-x-[-20%] top-[30%] bottom-[-30%] -z-10 rounded-full opacity-45 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--ember), transparent)",
        }}
      />
      <div className="flex size-full items-center justify-center">
        <span className="font-display text-[clamp(7rem,20vw,15rem)] leading-none tracking-[-0.04em] select-none">
          M<span className="text-ember italic">a</span>
        </span>
      </div>
      {caption ? (
        <span className="text-foreground/70 absolute start-5 bottom-5 font-mono text-[10.5px] tracking-[0.2em] uppercase">
          {caption}
        </span>
      ) : null}
    </div>
  );
}
