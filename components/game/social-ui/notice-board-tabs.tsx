"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { GuestbookList } from "./guestbook-list";

type Tab = "news" | "guestbook";
const TABS: readonly Tab[] = ["news", "guestbook"];

/** The notice board's "News" / "Guestbook" tabs (the guestbook loads only when opened). */
export function NoticeBoardTabs({
  dict,
  locale,
  news,
}: {
  dict: Dictionary;
  locale: string;
  news: ReactNode;
}): ReactNode {
  const t = dict.play.social.guestbook;
  const [tab, setTab] = useState<Tab>("news");
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({
    news: null,
    guestbook: null,
  });
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const i = TABS.indexOf(tab);
    const next =
      e.key === "Home"
        ? TABS[0]
        : e.key === "End"
          ? TABS[TABS.length - 1]
          : TABS[(i + 1) % TABS.length];
    if (!next) return;
    setTab(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="flex flex-col gap-2.5">
      <div
        role="tablist"
        aria-label={dict.play.buildingPanels.news}
        onKeyDown={onKey}
        className="border-foreground/10 flex gap-1 border-b"
      >
        {TABS.map((id) => (
          <button
            key={id}
            ref={(el) => {
              refs.current[id] = el;
            }}
            type="button"
            role="tab"
            id={`board-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`board-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            data-social-tab={id}
            className={`focus-ring -mb-px cursor-pointer border-b-2 px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
              tab === id
                ? "border-accent text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            {id === "news" ? t.tabNews : t.tabGuestbook}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`board-panel-${tab}`}
        aria-labelledby={`board-tab-${tab}`}
      >
        {tab === "news" ? news : <GuestbookList dict={dict} locale={locale} />}
      </div>
    </div>
  );
}
