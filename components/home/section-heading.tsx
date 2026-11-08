import type { ReactNode } from "react";

/** "(03) Eyebrow" label + big serif title with an optional italic accent. */
export function SectionHeading({
  index,
  eyebrow,
  title,
  accent,
  id,
  children,
}: {
  index: string;
  eyebrow: string;
  title: string;
  accent?: string;
  id?: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
          ({index}) {eyebrow}
        </p>
        <h2
          id={id}
          className="font-display mt-5 text-[clamp(2.8rem,7vw,6.5rem)] leading-[0.92] tracking-[-0.03em]"
        >
          {title} {accent ? <span className="italic">{accent}</span> : null}
        </h2>
      </div>
      {children}
    </div>
  );
}
