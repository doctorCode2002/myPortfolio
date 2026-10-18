/**
 * Locale-neutral project data. All prose (title, description) lives in the
 * dictionaries keyed by `id` — see app/dictionaries/{en,ar}.json.
 *
 * Order is the display order; the home page features the first four.
 */

export type ProjectId =
  "waco" | "khidmty" | "civicmind" | "onyx" | "saleh" | "eyad";

export type Project = {
  id: ProjectId;
  href: string;
  image: string;
  /** Every screenshot is ~16:9; the card box uses this directly. */
  ratio: number;
  frameworks: readonly string[];
  year: string;
};

export const PROJECTS: readonly Project[] = [
  {
    id: "waco",
    href: "https://waco.sa",
    image: "/assets/projects/waco.webp",
    ratio: 16 / 9,
    frameworks: ["Next.js", "Laravel", "Filament"],
    year: "2026",
  },
  {
    id: "khidmty",
    href: "https://khidmty.com",
    image: "/assets/projects/khidmty.webp",
    ratio: 16 / 9,
    frameworks: ["Next.js", "Supabase", "shadcn/ui"],
    year: "2025",
  },
  {
    id: "civicmind",
    href: "https://municipal-ai-system2.vercel.app/",
    image: "/assets/projects/civicMind.webp",
    ratio: 16 / 9,
    frameworks: ["React", "Tailwind CSS", "GSAP", "Python"],
    year: "2025",
  },
  {
    id: "onyx",
    href: "https://e-commerce-pink-iota.vercel.app/",
    image: "/assets/projects/onyx.webp",
    ratio: 16 / 9,
    frameworks: ["React", "GSAP", "Motion"],
    year: "2025",
  },
  {
    id: "saleh",
    href: "https://salehaburayya.com",
    image: "/assets/projects/saleh-website-previeew.webp",
    ratio: 16 / 9,
    frameworks: ["React", "Tailwind CSS", "GSAP"],
    year: "2025",
  },
  {
    id: "eyad",
    href: "https://olive-weasel-365141.hostingersite.com/",
    image: "/assets/projects/eyadDesinger.webp",
    ratio: 16 / 9,
    frameworks: ["React", "Tailwind CSS", "GSAP"],
    year: "2024",
  },
] as const;

export const FEATURED_COUNT = 4;
