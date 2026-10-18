"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { localePath, type Locale } from "@/lib/i18n";
import { MobileMenu } from "./mobile-menu";
import {
  LanguageSwitch,
  NAV_ROUTES,
  NavThemeToggle,
  useActiveRouteIndex,
  type NavLabels,
} from "./nav-parts";

export type { NavLabels } from "./nav-parts";

/**
 * The site navigation. From the `sm` breakpoint up it's the centred pill; below it
 * it's an icon that opens the full-screen menu. The switch is pure CSS (`hidden
 * sm:flex` / `sm:hidden`), so the server HTML already matches the device and
 * nothing flashes or mismatches on hydration.
 */
export function Nav({
  locale,
  labels,
}: {
  locale: Locale;
  labels: NavLabels;
}): ReactNode {
  return (
    <nav aria-label={labels.label}>
      {/* Without JS the menu button can't open anything: show the pill instead. */}
      <noscript
        dangerouslySetInnerHTML={{
          __html:
            "<style>.nav-desktop{display:flex!important}.nav-mobile-toggle{display:none!important}</style>",
        }}
      />
      <DesktopPill locale={locale} labels={labels} />
      <MobileMenu locale={locale} labels={labels} />
    </nav>
  );
}

function DesktopPill({
  locale,
  labels,
}: {
  locale: Locale;
  labels: NavLabels;
}): ReactNode {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [pillRect, setPillRect] = useState<{ x: number; width: number } | null>(
    null
  );
  const [hasMeasured, setHasMeasured] = useState(false);
  const activeIndex = useActiveRouteIndex(locale);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = (): void => {
      const activeEl = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
      const listRect = list.getBoundingClientRect();
      // Hidden below `sm`: nothing to measure until the pill is shown.
      if (!activeEl || listRect.width === 0) {
        setPillRect(null);
        return;
      }
      const itemRect = activeEl.getBoundingClientRect();
      setPillRect({
        x: itemRect.left - listRect.left,
        width: itemRect.width,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeIndex, pathname]);

  useEffect(() => {
    if (!pillRect) return;
    const id = requestAnimationFrame(() => setHasMeasured(true));
    return () => cancelAnimationFrame(id);
  }, [pillRect]);

  return (
    // Centred by a full-width flex row (not left-50% + translate, which caps the
    // pill at half the viewport); max-w-full keeps it inside the padding.
    <div className="nav-desktop pointer-events-none fixed inset-x-0 top-6 z-50 hidden justify-center px-3 sm:flex">
      <div className="border-foreground/10 bg-background pointer-events-auto flex max-w-full min-w-0 items-center gap-1 rounded-full border p-1.5 shadow-sm">
        <ul ref={listRef} className="relative flex items-center gap-1">
          {pillRect && (
            <motion.span
              aria-hidden="true"
              initial={false}
              animate={{ x: pillRect.x, width: pillRect.width }}
              transition={
                hasMeasured
                  ? { type: "spring", stiffness: 380, damping: 32 }
                  : { duration: 0 }
              }
              style={{ left: 0, top: 0, bottom: 0 }}
              className="bg-accent/10 ring-accent/25 absolute rounded-full ring-1"
            />
          )}
          {NAV_ROUTES.map((route, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={route.key}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                className="relative"
              >
                <Link
                  href={localePath(locale, route.path)}
                  aria-current={isActive ? "page" : undefined}
                  className="focus-ring relative inline-flex cursor-pointer items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-300"
                >
                  <span
                    className={
                      isActive
                        ? "text-foreground relative z-10"
                        : "text-muted-foreground hover:text-foreground relative z-10"
                    }
                  >
                    {labels[route.key]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex shrink-0 items-center gap-1">
          <LanguageSwitch locale={locale} labels={labels} />
          <NavThemeToggle labels={labels} />
        </div>
      </div>
    </div>
  );
}
