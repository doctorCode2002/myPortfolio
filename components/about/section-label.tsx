import type { ReactNode } from "react";

/** Mono micro-label used above every section: "(02) Story". */
export function SectionLabel({
  index,
  children,
  id,
}: {
  index: number;
  children: ReactNode;
  id?: string;
}): ReactNode {
  return (
    <p
      id={id}
      className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase"
    >
      <span dir="ltr" className="inline-block">
        ({String(index).padStart(2, "0")})
      </span>{" "}
      {children}
    </p>
  );
}
