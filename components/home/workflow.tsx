import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { SwarmRebuild } from "@/components/effects/swarm-rebuild";

const STEPS = [
  { id: "form", kind: "trigger" },
  { id: "enrich", kind: "action" },
  { id: "qualify", kind: "ai" },
  { id: "draft", kind: "ai" },
  { id: "crm", kind: "action" },
  { id: "report", kind: "output" },
] as const;

const STATS = ["response", "manual", "always"] as const;

/** Warm-leaning cursor palette that reads on near-black without clashing with ember. */
const CURSORS = [
  "#FF5A1F",
  "#F5C04A",
  "#EDE8E0",
  "#FF8A5B",
  "#9C8CFF",
  "#5ED3A5",
  "#F27AA6",
  "#6FB7FF",
  "#D9A066",
];

const NAMES = [
  "Lina",
  "Omar",
  "Sara",
  "Yousef",
  "Noor",
  "Kareem",
  "Hana",
  "Ziad",
  "Maya",
  "Adam",
  "Rana",
  "Tariq",
  "Leen",
  "Sami",
];
/**
 * The AI-workflow section. A swarm of named cursors wipes and rebuilds it when
 * it scrolls into view, then trails the visitor's pointer. The real content is
 * in the HTML throughout — the swarm only decorates it.
 */
export function HomeWorkflow({ dict }: { dict: Dictionary }): ReactNode {
  const w = dict.studio.workflow;

  return (
    <section
      id="ai"
      aria-labelledby="home-ai"
      className="relative px-5 pt-24 sm:px-10 sm:pt-36"
    >
      <div className="mx-auto max-w-[1440px]">
        <SwarmRebuild
          className="border-line bg-surface overflow-hidden rounded-[28px] border"
          agents={9}
          colors={CURSORS}
          names={NAMES}
          selection="#FF5A1F"
          guide="#F5C04A"
          labelClassName="font-mono tracking-tight"
          replay={<span>↻ {w.replay}</span>}
          replayClassName="absolute end-5 top-5 z-[61] rounded-full border border-line bg-background/70 px-3.5 py-1.5 font-mono text-[11px] tracking-[0.16em] text-foreground/75 uppercase backdrop-blur transition-colors hover:border-ember hover:text-foreground"
        >
          <div className="px-6 pt-16 pb-10 sm:px-12 sm:pt-20 sm:pb-14 lg:px-16">
            <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-7">
                <p className="text-ember font-mono text-[11px] tracking-[0.22em] uppercase">
                  (03) {w.eyebrow}
                </p>
                <h2
                  id="home-ai"
                  className="font-display mt-5 text-[clamp(2.8rem,7vw,6.5rem)] leading-[0.92] tracking-[-0.03em]"
                >
                  {w.title}
                </h2>
              </div>
              <p className="text-foreground/60 max-w-[44ch] text-[16px] leading-[1.6] lg:col-span-5 lg:justify-self-end">
                {w.body}
              </p>
            </div>

            {/* The pipeline. The pen tool traces this path during the rebuild. */}
            <svg
              data-swarm="pen"
              className="mt-14 hidden h-14 w-full lg:block rtl:-scale-x-100"
              viewBox="0 0 1200 56"
              preserveAspectRatio="none"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 28 C 120 4, 180 52, 300 28 S 480 4, 600 28 S 780 52, 900 28 S 1080 4, 1192 28"
                stroke="#FF5A1F"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
              />
            </svg>

            <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:mt-4 lg:grid-cols-6">
              {STEPS.map((s, i) => (
                <li
                  key={s.id}
                  className="border-line bg-background flex min-h-[176px] flex-col justify-between rounded-2xl border p-5"
                >
                  <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] uppercase">
                    <span className="text-foreground/40" dir="ltr">
                      0{i + 1}
                    </span>
                    <span
                      className={
                        s.kind === "ai"
                          ? "bg-ember text-ember-foreground rounded-full px-2 py-0.5"
                          : "border-line text-foreground/55 rounded-full border px-2 py-0.5"
                      }
                    >
                      {w.kinds[s.kind]}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-[28px] leading-none">
                      {w.steps[s.id].label}
                    </h3>
                    <p className="text-foreground/55 mt-2 text-[13px] leading-[1.5]">
                      {w.steps[s.id].detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <dl className="border-line grid border-t sm:grid-cols-3">
            {STATS.map((k) => (
              <div
                key={k}
                className="border-line border-b px-6 py-8 last:border-b-0 sm:border-e sm:border-b-0 sm:px-12 sm:last:border-e-0 lg:px-16"
              >
                <dt className="text-muted-foreground font-mono text-[11px] tracking-[0.2em] uppercase">
                  {w.stats[k].label}
                </dt>
                <dd className="font-display text-ember mt-2 text-[clamp(3rem,6vw,5rem)] leading-none">
                  {w.stats[k].value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="border-line text-muted-foreground border-t px-6 py-5 text-[13px] leading-[1.5] sm:px-12 lg:px-16">
            {w.note}
          </p>
        </SwarmRebuild>
      </div>
    </section>
  );
}
