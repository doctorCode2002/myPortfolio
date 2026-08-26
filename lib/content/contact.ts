export const EMAIL = "mohammeda.abutaleb@gmail.com";

export const CV_PATH = "/assets/CV.pdf";

export type SocialId = "linkedin" | "github" | "instagram";

export type Social = {
  id: SocialId;
  href: string;
  /** Accessible label; not translated — these are proper nouns. */
  label: string;
};

export const SOCIALS: readonly Social[] = [
  {
    id: "linkedin",
    href: "https://www.linkedin.com/in/mohammed2002",
    label: "LinkedIn",
  },
  {
    id: "github",
    href: "https://github.com/doctorCode2002",
    label: "GitHub",
  },
  {
    id: "instagram",
    href: "https://www.instagram.com/mohammedabu.taleb/",
    label: "Instagram",
  },
] as const;

/** Structured-data identity, mirrored from the previous site's src/lib/site.js. */
export const PERSON = {
  name: "Mohammed Ashraf",
  jobTitle: "Full-Stack Developer",
  sameAs: SOCIALS.map((s) => s.href),
  knowsAbout: [
    "React",
    "Next.js",
    "TypeScript",
    "Tailwind CSS",
    "GSAP",
    "Supabase",
  ],
} as const;

export const SERVICE_IDS = ["web", "design", "motion"] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

// The bento imagery moved to lib/content/about.ts when the Home About section
// was replaced by the dedicated /about page.
