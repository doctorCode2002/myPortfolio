"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import SpotlightCard from "@/components/vendor/reactbits/SpotlightCard";
import type { ServiceGroup, ServiceId } from "@/lib/content/services";
import { useMotionAllowed } from "@/lib/motion";

export type WorkItem = {
  id: string;
  /** Position in the full list, "01"… — stable whatever the filter. */
  number: string;
  title: string;
  description: string;
  category: string;
  image: string;
  href: string;
  year: string;
  stack: readonly string[];
  services: readonly { id: ServiceId; label: string }[];
  groups: readonly ServiceGroup[];
  featured: boolean;
  caseStudy: {
    role: string;
    challenge: string;
    approach: string;
    outcome: string;
  };
};

export type WorkCopy = {
  featured: string;
  index: string;
  filter: {
    label: string;
    all: string;
    countOne: string;
    countTwo: string;
    countFew: string;
    countMany: string;
    service: string;
    clear: string;
  };
  columns: {
    project: string;
    category: string;
    services: string;
    year: string;
  };
  caseStudy: {
    open: string;
    close: string;
    role: string;
    challenge: string;
    approach: string;
    outcome: string;
    stack: string;
  };
  empty: { title: string; body: string; cta: string };
  visit: string;
  opensInNewTab: string;
};

type Filter =
  | { kind: "all" }
  | { kind: "group"; group: ServiceGroup }
  | { kind: "service"; service: ServiceId };

function countLabel(n: number, f: WorkCopy["filter"]): string {
  const t =
    n === 1
      ? f.countOne
      : n === 2
        ? f.countTwo
        : n >= 3 && n <= 10
          ? f.countFew
          : f.countMany;
  return t.replace("{count}", String(n));
}

function readFilter(
  groups: readonly ServiceGroup[],
  services: ReadonlyMap<ServiceId, string>
): Filter {
  const q = new URLSearchParams(window.location.search);
  const service = q.get("service");
  if (service && services.has(service as ServiceId))
    return { kind: "service", service: service as ServiceId };
  const group = q.get("group");
  if (group && (groups as readonly string[]).includes(group))
    return { kind: "group", group: group as ServiceGroup };
  return { kind: "all" };
}

/**
 * Filterable work: featured cards, then a numbered editorial index whose rows
 * open into a short case study. The full list is server-rendered (good for
 * search and no-JS); the filter is read from and written to the URL
 * (?group=… or ?service=…) so the Services page can deep-link into it.
 */
export function WorkExplorer({
  items,
  groups,
  serviceLabels,
  copy,
}: {
  items: readonly WorkItem[];
  groups: readonly { id: ServiceGroup; label: string }[];
  serviceLabels: Readonly<Record<ServiceId, string>>;
  copy: WorkCopy;
}): ReactNode {
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);
  const serviceMap = useMemo(
    () => new Map(Object.entries(serviceLabels) as [ServiceId, string][]),
    [serviceLabels]
  );

  // Initial filter from the URL, and back/forward navigation.
  useEffect(() => {
    const sync = (): void => setFilter(readFilter(groupIds, serviceMap));
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [groupIds, serviceMap]);

  const apply = useCallback((next: Filter): void => {
    setFilter(next);
    const url = new URL(window.location.href);
    url.searchParams.delete("group");
    url.searchParams.delete("service");
    if (next.kind === "group") url.searchParams.set("group", next.group);
    if (next.kind === "service") url.searchParams.set("service", next.service);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const visible = items.filter((p) =>
    filter.kind === "all"
      ? true
      : filter.kind === "group"
        ? p.groups.includes(filter.group)
        : p.services.some((s) => s.id === filter.service)
  );
  const featured = visible.filter((p) => p.featured);
  const activeGroup =
    filter.kind === "group"
      ? groups.find((g) => g.id === filter.group)
      : undefined;

  return (
    <div>
      {/* Filter bar */}
      <div className="border-line border-y py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div
            role="group"
            aria-label={copy.filter.label}
            className="flex flex-wrap gap-2"
          >
            <FilterChip
              active={filter.kind === "all"}
              onClick={() => apply({ kind: "all" })}
            >
              {copy.filter.all}
            </FilterChip>
            {groups.map((g) => (
              <FilterChip
                key={g.id}
                active={filter.kind === "group" && filter.group === g.id}
                onClick={() => apply({ kind: "group", group: g.id })}
              >
                {g.label}
              </FilterChip>
            ))}
          </div>
          <p
            aria-live="polite"
            className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase"
          >
            {countLabel(visible.length, copy.filter)}
          </p>
        </div>
        {filter.kind === "service" ? (
          <div className="text-foreground/70 mt-4 flex flex-wrap items-center gap-3 text-[14px]">
            <span>
              {copy.filter.service.replace(
                "{service}",
                serviceLabels[filter.service]
              )}
            </span>
            <button
              type="button"
              onClick={() => apply({ kind: "all" })}
              className="border-line hover:border-foreground rounded-full border px-3 py-1 font-mono text-[10.5px] tracking-[0.16em] uppercase transition-colors"
            >
              {copy.filter.clear}
            </button>
          </div>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="py-20 sm:py-28">
          <h2 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.03em]">
            {copy.empty.title.replace(
              "{group}",
              activeGroup?.label ??
                (filter.kind === "service" ? serviceLabels[filter.service] : "")
            )}
          </h2>
          <p className="text-foreground/65 mt-5 max-w-[48ch] text-[16px] leading-[1.6]">
            {copy.empty.body}
          </p>
          <a
            href="#contact"
            className="hover:bg-ember bg-foreground text-background mt-8 inline-flex items-center gap-3 rounded-full px-6 py-3.5 text-[14px] font-medium transition-colors"
          >
            {copy.empty.cta}{" "}
            <span aria-hidden="true" className="rtl:-scale-x-100">
              →
            </span>
          </a>
        </div>
      ) : (
        <>
          {featured.length > 0 ? (
            <section aria-label={copy.featured} className="pt-12 sm:pt-16">
              <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
                ({copy.featured})
              </p>
              <div
                className={`mt-6 grid gap-4 ${featured.length > 1 ? "lg:grid-cols-2" : ""}`}
              >
                {featured.map((p, i) => (
                  <FeaturedCard key={p.id} p={p} copy={copy} eager={i < 2} />
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label={copy.index} className="pt-16 sm:pt-24">
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.22em] uppercase">
              ({copy.index})
            </p>
            <WorkIndex items={visible} copy={copy} />
          </section>
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors ${
        active
          ? "border-ember bg-ember text-ember-foreground"
          : "border-line text-foreground/70 hover:border-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function FeaturedCard({
  p,
  copy,
  eager,
}: {
  p: WorkItem;
  copy: WorkCopy;
  eager: boolean;
}): ReactNode {
  return (
    <SpotlightCard
      spotlightColor="rgba(255, 90, 31, 0.55)"
      intensity={0.22}
      spotlightSize={420}
      borderGlow={0.8}
      className="group !rounded-[24px] !p-0"
      style={{ ["--spotlight-card-surface" as string]: "#111112" }}
    >
      <a
        href={p.href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-full flex-col p-3 sm:p-4"
      >
        <div className="bg-surface-2 relative aspect-video w-full overflow-hidden rounded-[16px]">
          <Image
            src={p.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            loading={eager ? "eager" : "lazy"}
            className="object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.2,.7,.1,1)] group-hover:scale-[1.04]"
          />
        </div>
        <div className="flex flex-1 flex-col px-2 pt-5 pb-2 sm:px-3">
          <div className="text-muted-foreground flex items-center justify-between font-mono text-[10.5px] tracking-[0.18em] uppercase">
            <span>
              {p.number} · {p.category}
            </span>
            <span>{p.year}</span>
          </div>
          <h3 className="font-display mt-3 flex items-baseline justify-between gap-4 text-[clamp(2.6rem,4.5vw,4rem)] leading-none tracking-[-0.02em]">
            {p.title}
            <span
              className="text-ember text-[22px] opacity-60 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100 rtl:group-hover:-translate-x-1"
              aria-hidden="true"
            >
              ↗
            </span>
          </h3>
          <p className="text-foreground/65 mt-4 max-w-[58ch] text-[15px] leading-[1.6]">
            {p.description}
          </p>
          <p className="text-muted-foreground mt-auto pt-5 font-mono text-[10.5px] tracking-[0.14em] uppercase">
            <span className="latin">{p.stack.join(" · ")}</span>
          </p>
          <span className="sr-only">
            {copy.visit} ({copy.opensInNewTab})
          </span>
        </div>
      </a>
    </SpotlightCard>
  );
}

/**
 * Numbered index. On fine pointers with motion allowed, hovering a row floats
 * that project's screenshot after the cursor (decorative: aria-hidden, no
 * pointer events). Rows expand into the case study with a native disclosure.
 */
function WorkIndex({
  items,
  copy,
}: {
  items: readonly WorkItem[];
  copy: WorkCopy;
}): ReactNode {
  const motion = useMotionAllowed();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [finePointer, setFinePointer] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const pos = useRef({ x: 0, y: 0 });
  const raf = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const set = (): void => setFinePointer(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  const enabled = motion && finePointer;

  useEffect(() => {
    if (!enabled || !hoverId) return;
    const tick = (): void => {
      pos.current.x += (target.current.x - pos.current.x) * 0.16;
      pos.current.y += (target.current.y - pos.current.y) * 0.16;
      const el = previewRef.current;
      if (el)
        el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)`;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [enabled, hoverId]);

  const onMove = (e: React.PointerEvent): void => {
    target.current = { x: e.clientX, y: e.clientY };
  };
  const onEnter = (id: string, e: React.PointerEvent): void => {
    if (!enabled) return;
    if (!hoverId) pos.current = { x: e.clientX, y: e.clientY };
    target.current = { x: e.clientX, y: e.clientY };
    setHoverId(id);
  };

  const hovered = items.find((p) => p.id === hoverId);

  return (
    <>
      <div
        className="border-line text-muted-foreground mt-6 hidden grid-cols-[3.5rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_4rem] gap-6 border-b pb-3 font-mono text-[10.5px] tracking-[0.18em] uppercase lg:grid"
        aria-hidden="true"
      >
        <span>№</span>
        <span>{copy.columns.project}</span>
        <span>{copy.columns.category}</span>
        <span>{copy.columns.services}</span>
        <span className="text-end">{copy.columns.year}</span>
      </div>

      <ol
        className="mt-2 lg:mt-0"
        onPointerMove={enabled ? onMove : undefined}
        onPointerLeave={() => setHoverId(null)}
      >
        {items.map((p) => (
          <li key={p.id} className="group border-line border-b">
            <details className="[&_summary::-webkit-details-marker]:hidden">
              <summary
                onPointerEnter={(e) => onEnter(p.id, e)}
                onPointerLeave={() => setHoverId(null)}
                className="hover:text-foreground grid cursor-pointer list-none grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-2 py-6 transition-colors lg:grid-cols-[3.5rem_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1.2fr)_4rem] lg:gap-6 lg:py-7"
              >
                <span className="text-muted-foreground font-mono text-[11px]">
                  {p.number}
                </span>
                <span className="font-display group-hover:text-ember text-[clamp(2rem,4vw,3.2rem)] leading-none tracking-[-0.02em] transition-colors">
                  {p.title}
                </span>
                <span className="text-muted-foreground font-mono text-[11px] lg:hidden">
                  {p.year}
                </span>
                <span className="text-foreground/60 col-start-2 text-[14px] lg:col-start-auto">
                  {p.category}
                </span>
                <span className="col-start-2 flex flex-wrap gap-1.5 lg:col-start-auto">
                  {p.services.map((s) => (
                    <span
                      key={s.id}
                      className="border-line text-foreground/60 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.1em] uppercase"
                    >
                      {s.label}
                    </span>
                  ))}
                </span>
                <span className="text-muted-foreground hidden text-end font-mono text-[11px] lg:block">
                  {p.year}
                </span>
                <span className="text-ember col-start-2 inline-flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] uppercase lg:col-span-4 lg:col-start-2">
                  <span>
                    <span className="[details[open]_&]:hidden">
                      {copy.caseStudy.open}
                    </span>
                    <span className="hidden [details[open]_&]:inline">
                      {copy.caseStudy.close}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="transition-transform [details[open]_&]:rotate-45"
                  >
                    +
                  </span>
                </span>
              </summary>

              <div className="grid gap-8 pb-10 lg:grid-cols-[3.5rem_minmax(0,1fr)] lg:gap-6">
                <span className="hidden lg:block" />
                <div className="grid gap-8 md:grid-cols-3">
                  <CaseBlock
                    label={copy.caseStudy.challenge}
                    text={p.caseStudy.challenge}
                  />
                  <CaseBlock
                    label={copy.caseStudy.approach}
                    text={p.caseStudy.approach}
                  />
                  <CaseBlock
                    label={copy.caseStudy.outcome}
                    text={p.caseStudy.outcome}
                    accent
                  />
                  <div className="border-line flex flex-wrap items-end justify-between gap-6 border-t pt-6 md:col-span-3">
                    <dl className="grid gap-4 font-mono text-[11px] tracking-[0.14em] uppercase sm:grid-cols-2 sm:gap-10">
                      <div>
                        <dt className="text-muted-foreground">
                          {copy.caseStudy.role}
                        </dt>
                        <dd className="text-foreground/80 mt-1.5 text-[12px] tracking-normal normal-case">
                          {p.caseStudy.role}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">
                          {copy.caseStudy.stack}
                        </dt>
                        <dd className="latin text-foreground/80 mt-1.5 text-[12px] tracking-normal normal-case">
                          {p.stack.join(" · ")}
                        </dd>
                      </div>
                    </dl>
                    <a
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-line hover:border-ember hover:text-ember inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[13px] transition-colors"
                    >
                      {copy.visit} <span aria-hidden="true">↗</span>
                      <span className="sr-only"> ({copy.opensInNewTab})</span>
                    </a>
                  </div>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>

      {enabled ? (
        <div
          ref={previewRef}
          aria-hidden="true"
          className={`border-line bg-surface pointer-events-none fixed top-0 left-0 z-[70] w-[340px] overflow-hidden rounded-[14px] border shadow-2xl shadow-black/60 transition-[opacity,scale] duration-300 ease-out ${
            hovered ? "scale-100 opacity-100" : "scale-90 opacity-0"
          }`}
        >
          {items.map((p) => (
            <div
              key={p.id}
              className={`relative aspect-video ${p.id === hoverId ? "block" : "hidden"}`}
            >
              <Image
                src={p.image}
                alt=""
                fill
                sizes="340px"
                loading="eager"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function CaseBlock({
  label,
  text,
  accent = false,
}: {
  label: string;
  text: string;
  accent?: boolean;
}): ReactNode {
  return (
    <div>
      <p
        className={`font-mono text-[10.5px] tracking-[0.2em] uppercase ${accent ? "text-ember" : "text-muted-foreground"}`}
      >
        {label}
      </p>
      <p className="text-foreground/75 mt-3 text-[15px] leading-[1.65]">
        {text}
      </p>
    </div>
  );
}
