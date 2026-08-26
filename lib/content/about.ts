/**
 * About-page structure. Locale-neutral: dates, ordering, image paths, brand
 * colours, and proper nouns live here; every piece of prose (role titles,
 * descriptions, degree names, skill labels, alt text) lives in the dictionaries
 * under `aboutPage.*`.
 *
 * Source of truth for the experience and education entries is public/assets/CV.pdf.
 */

/* ---------------------------------------------------------------- experience */

export type ExperienceId =
  | "instructor"
  | "freelance"
  | "aiWeek"
  | "zeroToHero";

export type ExperienceEntry = {
  id: ExperienceId;
  /**
   * Tile colour behind the organisation's initial. Org name, role, and period
   * are prose (periods contain "Present", org names transliterate) and live in
   * the dictionary under aboutPage.experience.<id>.
   */
  brand: string;
  /** Local SVG under /icons; omit to fall back to the org's first letter. */
  icon?: string;
};

// `instructor` and `zeroToHero` are two different roles at the same organisation
// (teaching, and the volunteer full-stack work) — the repeated org name is
// intentional and matches the CV.
// Ordered ongoing-first, then by recency.
export const EXPERIENCE: readonly ExperienceEntry[] = [
  { id: "instructor", brand: "#ab4c24" },
  { id: "freelance", brand: "#14110f" },
  { id: "aiWeek", brand: "#2f6f8f" },
  { id: "zeroToHero", brand: "#3b7d5e" },
] as const;

/* ---------------------------------------------------------------- education */

export type EducationId =
  | "alAzhar"
  | "iug"
  | "aiPython"
  | "metaFrontend"
  | "dsa";

export type EducationEntry = {
  id: EducationId;
  /** Degrees render before certificates and carry slightly more weight. */
  kind: "degree" | "certificate";
  icon?: string;
};

// School, qualification, and period are prose — see aboutPage.education.<id>.
export const EDUCATION: readonly EducationEntry[] = [
  { id: "alAzhar", kind: "degree" },
  { id: "iug", kind: "degree" },
  { id: "aiPython", kind: "certificate" },
  { id: "metaFrontend", kind: "certificate" },
  { id: "dsa", kind: "certificate" },
] as const;

/* ------------------------------------------------------------------- skills */

export const SKILL_IDS = [
  "react",
  "next",
  "javascript",
  "tailwind",
  "supabase",
  "convex",
  "postgres",
  "restApis",
  "auth",
  "responsive",
  "performance",
  "uiux",
  "figma",
  "prompt",
  "mentorship",
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

/* -------------------------------------------------------------------- stack */

export type StackChip = {
  id: string;
  /** Product name — a proper noun, rendered as-is in both locales. */
  label: string;
  bg: string;
  fg: string;
  icon: string;
};

/**
 * Only technologies backed by the CV or by a shipped project. Icons are served
 * from /icons rather than cdn.simpleicons.org so the page makes no third-party
 * request — see scripts note in README.
 */
export const STACK_CHIPS: readonly StackChip[] = [
  { id: "react", label: "React", bg: "#0f7a8a", fg: "#ffffff", icon: "/icons/react.svg" },
  { id: "next", label: "Next.js", bg: "#1f1f1f", fg: "#ffffff", icon: "/icons/nextdotjs.svg" },
  { id: "javascript", label: "JavaScript", bg: "#7d6c00", fg: "#ffffff", icon: "/icons/javascript.svg" },
  { id: "tailwind", label: "Tailwind CSS", bg: "#16759e", fg: "#ffffff", icon: "/icons/tailwindcss.svg" },
  { id: "supabase", label: "Supabase", bg: "#2c7a52", fg: "#ffffff", icon: "/icons/supabase.svg" },
  { id: "convex", label: "Convex", bg: "#5b2d8f", fg: "#ffffff", icon: "/icons/convex.svg" },
  { id: "postgres", label: "PostgreSQL", bg: "#2f5d7c", fg: "#ffffff", icon: "/icons/postgresql.svg" },
  { id: "gsap", label: "GSAP", bg: "#0a7d33", fg: "#ffffff", icon: "/icons/gsap.svg" },
  { id: "git", label: "Git", bg: "#c04628", fg: "#ffffff", icon: "/icons/git.svg" },
  { id: "github", label: "GitHub", bg: "#181717", fg: "#ffffff", icon: "/icons/github.svg" },
  { id: "figma", label: "Figma", bg: "#1f1f1f", fg: "#ffffff", icon: "/icons/figma.svg" },
] as const;

/* ---------------------------------------------------------------- polaroids */

export type PolaroidId =
  | "portrait"
  | "desk"
  | "glasses"
  | "skills"
  | "medtech"
  | "monogram";

export type Polaroid = {
  id: PolaroidId;
  src: string;
  /** Resting tilt in degrees. */
  rotate: number;
};

/**
 * Reuses the bento imagery from the previous site. `medtech` earns its place
 * because the medicine-to-engineering switch is part of the story on this page.
 * The stethoscope/patient-records shot from the same set is deliberately left
 * out: it reads as clinical practice, which the CV does not claim.
 */
export const POLAROIDS: readonly Polaroid[] = [
  { id: "portrait", src: "/assets/bentoGrid/center.webp", rotate: -8 },
  { id: "desk", src: "/assets/bentoGrid/left-center.webp", rotate: 6 },
  { id: "glasses", src: "/assets/bentoGrid/top-center.webp", rotate: -4 },
  { id: "skills", src: "/assets/bentoGrid/top-left.webp", rotate: 7 },
  { id: "medtech", src: "/assets/bentoGrid/bottom-center.webp", rotate: -6 },
  { id: "monogram", src: "/assets/bentoGrid/top-right.webp", rotate: 5 },
] as const;
