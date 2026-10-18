"use client";

/* Pieces shared by the desktop nav pill and the mobile full-screen menu. */

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";

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
  openMenu: string;
  closeMenu: string;
  menuTitle: string;
  toggleTheme: string;
  toLight: string;
  toDark: string;
  switchLanguage: string;
  skipToContent: string;
};

export const NAV_ROUTES = [
  { key: "home", path: "/" },
  { key: "projects", path: "/projects" },
  { key: "about", path: "/about" },
  { key: "mentoring", path: "/mentoring" },
  { key: "play", path: "/play" },
] as const;

export function useIsMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function NavThemeToggle({ labels }: { labels: NavLabels }): ReactNode {
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

export function LanguageSwitch({
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

/** Index of the NAV_ROUTES entry for the current page, or -1. */
export function useActiveRouteIndex(locale: Locale): number {
  const pathname = usePathname();
  return NAV_ROUTES.findIndex((route) => {
    const href = localePath(locale, route.path);
    return route.path === "/"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  });
}
