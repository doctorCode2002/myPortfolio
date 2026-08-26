import type { ReactNode } from "react";

export function SkipToContent({ label }: { label: string }): ReactNode {
  return (
    <a href="#main-content" className="skip-to-content">
      {label}
    </a>
  );
}
