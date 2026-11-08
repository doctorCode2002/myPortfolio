import type { ServiceId } from "./services";

/**
 * Locale-neutral project data. Prose (title, description) lives in the
 * dictionaries under `projects.items.<id>`; the category label under
 * `studio.projects.categories.<id>`.
 *
 * Order is the display order. `featured` projects lead the home page and the
 * work index at full width.
 */

export type ProjectId =
  "waco" | "teryaq" | "khidmty" | "civicmind" | "onyx" | "saleh" | "eyad";

export type Project = {
  id: ProjectId;
  href: string;
  image: string;
  /** Every screenshot is ~16:9; the card box uses this directly. */
  ratio: number;
  frameworks: readonly string[];
  /** Services this project demonstrates — drives the Services ↔ Work links. */
  services: readonly ServiceId[];
  year: string;
  featured?: boolean;
};

export const PROJECTS: readonly Project[] = [
  {
    id: "waco",
    href: "https://waco.sa",
    image: "/assets/projects/waco.webp",
    ratio: 16 / 9,
    frameworks: ["Next.js", "Laravel", "Filament", "GSAP"],
    services: ["web", "uiux", "animation"],
    year: "2026",
    featured: true,
  },
  {
    id: "teryaq",
    href: "https://teryaq-med.com",
    image: "/assets/projects/teryaq.webp",
    ratio: 16 / 9,
    frameworks: ["Next.js", "Drizzle", "PostgreSQL", "Motion"],
    services: ["web", "uiux"],
    year: "2026",
    featured: true,
  },
  {
    id: "khidmty",
    href: "https://khidmty.com",
    image: "/assets/projects/khidmty.webp",
    ratio: 16 / 9,
    frameworks: ["Next.js", "Supabase", "shadcn/ui"],
    services: ["web", "uiux"],
    year: "2025",
  },
  {
    id: "civicmind",
    href: "https://municipal-ai-system2.vercel.app/",
    image: "/assets/projects/civicMind.webp",
    ratio: 16 / 9,
    frameworks: ["React", "Tailwind CSS", "GSAP", "Python"],
    services: ["web", "aiWorkflows"],
    year: "2025",
  },
  {
    id: "onyx",
    href: "https://e-commerce-pink-iota.vercel.app/",
    image: "/assets/projects/onyx.webp",
    ratio: 16 / 9,
    frameworks: ["React", "GSAP", "Motion"],
    services: ["web", "animation"],
    year: "2025",
  },
  {
    id: "saleh",
    href: "https://salehaburayya.com",
    image: "/assets/projects/saleh-website-previeew.webp",
    ratio: 16 / 9,
    frameworks: ["React", "Tailwind CSS", "GSAP"],
    services: ["web", "animation"],
    year: "2025",
  },
  {
    id: "eyad",
    href: "https://olive-weasel-365141.hostingersite.com/",
    image: "/assets/projects/eyadDesinger.webp",
    ratio: 16 / 9,
    frameworks: ["React", "Tailwind CSS", "GSAP"],
    services: ["web"],
    year: "2024",
  },
] as const;

export const FEATURED_COUNT = 4;
