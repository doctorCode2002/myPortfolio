/**
 * Projects the owner is still building, shown on the workshop island ("Under
 * construction") in /[lang]/play.
 *
 * EDIT HERE: one entry per project. Each entry becomes a building with a door on the
 * workshop island, placed on the next free lot (lot 1 for the first entry, lot 2 for the
 * second, and so on, up to WORKSHOP_LOTS). Unused lots show an empty plot with a blank
 * "for sale" sign. The building's look follows `progress` (foundations, frame, walls,
 * scaffolding), and its panel shows the name, the pitch, a progress bar and the status.
 *
 * Text is kept here (English and Arabic) so a new project needs no dictionary edit.
 */

export type InProgressStatus =
  "planning" | "building" | "testing" | "polishing";

export type LocalizedText = { en: string; ar: string };

export type InProgressProject = {
  /** Stable id (kebab or snake case); the building id becomes `progress_<id>`. */
  id: string;
  name: LocalizedText;
  /** One line: what it is. */
  pitch: LocalizedText;
  /** 0..100. */
  progress: number;
  status: InProgressStatus;
  /** Optional link (a repo or a preview). */
  href?: string;
  demo?: boolean;
};

/** Lots on the workshop island; entries past this are not shown. */
export const WORKSHOP_LOTS = 6;

export const IN_PROGRESS: readonly InProgressProject[] = [
  // DEMO: replace with real content
  {
    id: "demo_alpha",
    name: { en: "Project Alpha (demo)", ar: "المشروع ألفا (تجريبي)" },
    pitch: {
      en: "Placeholder entry: a short pitch for a project in progress goes here.",
      ar: "عنصر تجريبي: يوضع هنا وصف قصير لمشروع قيد العمل.",
    },
    progress: 70,
    status: "testing",
    demo: true,
  },
  // DEMO: replace with real content
  {
    id: "demo_beta",
    name: { en: "Project Beta (demo)", ar: "المشروع بيتا (تجريبي)" },
    pitch: {
      en: "Placeholder entry: one line about what this project will do.",
      ar: "عنصر تجريبي: سطر واحد عمّا سيقدمه هذا المشروع.",
    },
    progress: 40,
    status: "building",
    demo: true,
  },
  // DEMO: replace with real content
  {
    id: "demo_gamma",
    name: { en: "Project Gamma (demo)", ar: "المشروع غاما (تجريبي)" },
    pitch: {
      en: "Placeholder entry: an idea that is still on the drawing board.",
      ar: "عنصر تجريبي: فكرة ما زالت على طاولة التصميم.",
    },
    progress: 10,
    status: "planning",
    demo: true,
  },
];

/** The building id of an in-progress project. */
export function progressBuildingId(projectId: string): string {
  return `progress_${projectId}`;
}

/** The projects that get a lot (the first WORKSHOP_LOTS entries). */
export function projectsOnLots(
  projects: readonly InProgressProject[] = IN_PROGRESS
): readonly InProgressProject[] {
  return projects.slice(0, WORKSHOP_LOTS);
}

export type ConstructionStage = "foundation" | "frame" | "walls" | "scaffold";

/** How far along the half-built house on a lot looks. */
export function constructionStage(progress: number): ConstructionStage {
  const p = Math.max(0, Math.min(100, progress));
  if (p < 25) return "foundation";
  if (p < 50) return "frame";
  if (p < 75) return "walls";
  return "scaffold";
}

export function clampProgress(progress: number): number {
  return Math.round(Math.max(0, Math.min(100, progress)));
}
