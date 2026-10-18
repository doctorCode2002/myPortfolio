"use client";

import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { ProgressBuildingPanel } from "@/lib/content/world.panels";

const PIXEL_BADGE =
  "0 -1px 0 0 #000, 0 1px 0 0 #000, -1px 0 0 0 #000, 1px 0 0 0 #000";
const PIXEL_TRACK =
  "0 -2px 0 0 #000, 0 2px 0 0 #000, -2px 0 0 0 #000, 2px 0 0 0 #000";

const STATUS_TINT: Record<string, string> = {
  planning: "bg-sky-500/20 text-sky-700 dark:text-sky-300",
  building: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  testing: "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  polishing: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
};

/** Body of the building panel for a project still in progress (workshop island). */
export function ProgressPanelView({
  panel,
  dict,
}: {
  panel: ProgressBuildingPanel;
  dict: Dictionary;
}): ReactNode {
  const { project } = panel;
  const labels = dict.play.buildingPanels;
  const isDev = process.env.NODE_ENV !== "production";
  const barId = `progress-${project.id}`;

  return (
    <div className="space-y-3.5">
      <p className="text-foreground/90 text-xs leading-relaxed sm:text-sm">
        {project.pitch}
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 font-mono text-[11px] sm:text-xs">
          <span id={barId} className="text-muted-foreground">
            {labels.progressLabel}
          </span>
          <span className="text-foreground font-bold tabular-nums">
            {project.progress}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-labelledby={barId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={project.progress}
          style={{ boxShadow: PIXEL_TRACK, imageRendering: "pixelated" }}
          className="bg-muted h-3.5 w-full overflow-hidden sm:h-4"
        >
          <div
            className="bg-accent h-full transition-[width] duration-500 motion-reduce:transition-none"
            style={{
              width: `${project.progress}%`,
              // Hazard stripes along the bar, like the barriers on the site.
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(0,0,0,0.16) 0 6px, transparent 6px 12px)",
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground font-mono text-[11px] sm:text-xs">
          {labels.statusLabel}
        </span>
        <span
          style={{ boxShadow: PIXEL_BADGE }}
          className={`px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${STATUS_TINT[project.status] ?? "bg-muted"}`}
        >
          {project.statusLabel}
        </span>
        {project.demo && isDev && (
          <span
            style={{ boxShadow: PIXEL_BADGE }}
            className="border border-amber-500/30 bg-amber-500/20 px-1 font-mono text-[9px] font-bold text-amber-600 uppercase dark:text-amber-400"
          >
            {labels.demoTag}
          </span>
        )}
      </div>

      {project.href && (
        <a
          href={project.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent inline-flex items-center gap-1 text-xs font-semibold hover:underline"
        >
          <span>{dict.projects.visit}</span>
          <ExternalLink className="h-3 w-3" />
          <span className="sr-only">{labels.newTab}</span>
        </a>
      )}
    </div>
  );
}
