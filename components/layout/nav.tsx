"use client";

import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  LOCALES,
  LOCALE_LABEL,
  localePath,
  switchLocalePath,
  type Locale,
} from "@/lib/i18n";

export type NavLabels = {
  label: string;
  home: string;
  projects: string;
  mentoring: string;
  about: string;
  play: string;
  toggleTheme: string;
  toLight: string;
  toDark: string;
  switchLanguage: string;
  skipToContent: string;
};

const NAV_ROUTES = [
  { key: "home", path: "/" },
  { key: "projects", path: "/projects" },
  { key: "about", path: "/about" },
  { key: "mentoring", path: "/mentoring" },
  { key: "play", path: "/play" },
] as const;

function useIsMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function NavThemeToggle({ labels }: { labels: NavLabels }): ReactNode {
  const mounted = useIsMounted();
  const { setTheme, resolvedTheme } = useTheme();
  const isDark = mounted && resolvedTheme === "dark";

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>): void => {
    const next = isDark ? "light" : "dark";

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const startViewTransition = document.startViewTransition?.bind(document);

    if (!startViewTransition || prefersReducedMotion) {
      setTheme(next);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = Math.hypot(
      Math.max(cx, window.innerWidth - cx),
      Math.max(cy, window.innerHeight - cy)
    );

    const root = document.documentElement;
    root.style.setProperty("--theme-cx", `${cx}px`);
    root.style.setProperty("--theme-cy", `${cy}px`);
    root.style.setProperty("--theme-r", `${radius}px`);
    root.dataset["themeAnim"] = "1";

    const transition = startViewTransition(() => {
      setTheme(next);
    });

    void transition.finished.finally(() => {
      delete root.dataset["themeAnim"];
    });
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        mounted ? (isDark ? labels.toLight : labels.toDark) : labels.toggleTheme
      }
      aria-pressed={mounted ? isDark : undefined}
      className="focus-ring bg-background ring-foreground/10 hover:ring-accent/40 relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full ring-1 transition-colors"
    >
      <span aria-hidden="true" className="relative h-4 w-4">
        <Sun
          className={`text-foreground absolute inset-0 h-4 w-4 transition-all duration-300 ${
            mounted && isDark
              ? "scale-100 rotate-0 opacity-100"
              : "scale-0 -rotate-90 opacity-0"
          }`}
        />
        <Moon
          className={`text-foreground absolute inset-0 h-4 w-4 transition-all duration-300 ${
            mounted && !isDark
              ? "scale-100 rotate-0 opacity-100"
              : "scale-0 rotate-90 opacity-0"
          }`}
        />
      </span>
    </button>
  );
}

function LanguageSwitch({
  locale,
  labels,
}: {
  locale: Locale;
  labels: NavLabels;
}): ReactNode {
  const pathname = usePathname();
  const other = LOCALES.find((l) => l !== locale);

  // Single-locale build (Arabic is off — see lib/i18n.ts): nothing to switch to,
  // so the control disappears rather than linking the page back to itself.
  if (other === undefined) return null;

  return (
    <Link
      href={switchLocalePath(pathname, other)}
      hrefLang={other}
      lang={other}
      aria-label={labels.switchLanguage}
      className="focus-ring bg-background text-foreground ring-foreground/10 hover:ring-accent/40 inline-flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-full px-2 text-[13px] font-medium ring-1 transition-colors"
    >
      {LOCALE_LABEL[other]}
    </Link>
  );
}

export function Nav({
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

  const activeIndex = NAV_ROUTES.findIndex((route) => {
    const href = localePath(locale, route.path);
    return route.path === "/"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  });

  useLayoutEffect(() => {
    const list = listRef.current;
    const activeEl = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    if (!list || !activeEl) {
      setPillRect(null);
      return;
    }
    const listRect = list.getBoundingClientRect();
    const itemRect = activeEl.getBoundingClientRect();
    setPillRect({
      x: itemRect.left - listRect.left,
      width: itemRect.width,
    });
  }, [activeIndex, pathname]);

  useEffect(() => {
    if (!pillRect) return;
    const id = requestAnimationFrame(() => setHasMeasured(true));
    return () => cancelAnimationFrame(id);
  }, [pillRect]);

  return (
    <nav
      aria-label={labels.label}
      className="fixed top-6 left-1/2 z-50 -translate-x-1/2"
    >
      {/* max-w cap: the pill is centred with a translate, so without it a long
          label set can push past the viewport and cause horizontal scroll on
          small phones. */}
      <div className="border-foreground/10 bg-background flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-full border p-1.5 shadow-sm">
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
                  className="focus-ring relative inline-flex cursor-pointer items-center justify-center rounded-full px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-300 sm:px-4 sm:text-sm"
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
        <LanguageSwitch locale={locale} labels={labels} />
        <NavThemeToggle labels={labels} />
      </div>
    </nav>
  );
}
