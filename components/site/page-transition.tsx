"use client";

import { ViewTransition, type ReactNode } from "react";

/**
 * Route transition for page content. Next.js navigations are React
 * transitions, so this animates automatically: the old page lifts out fast
 * with a slight blur, the new one rises in after it (see the `.page` view
 * transition class in globals.css).
 *
 * Must wrap each page's content inside page.tsx — layouts persist across
 * navigations, so enter/exit never fire there. Skipped entirely when motion
 * is off (globals.css) or the browser lacks the View Transitions API.
 */
export function PageTransition({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <ViewTransition enter="page" exit="page" default="none">
      {children}
    </ViewTransition>
  );
}
