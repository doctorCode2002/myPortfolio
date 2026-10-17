/**
 * Pure content selectors for building panels in /[lang]/play game mode.
 *
 * No React dependencies. Resolves real portfolio content for info and portal
 * buildings, and demo placeholders for hobbies, family, and news.
 */

import arDictionary from "@/app/dictionaries/ar.json";
import enDictionary from "@/app/dictionaries/en.json";
import { EDUCATION, EXPERIENCE, SKILL_IDS, STACK_CHIPS } from "./about";
import { PROJECTS, type ProjectId } from "./projects";
import { ISLANDS, type Island } from "./world";

export type InfoSectionKind =
  "education" | "experience" | "stack" | "hobbies" | "family";

export type BaseInfoItem = {
  id: string;
  title: string;
  subtitle?: string;
  period?: string;
  description?: string;
  badge?: string;
  icon?: string;
  demo?: boolean;
};

export type EducationInfoItem = BaseInfoItem & {
  school: string;
  qualification: string;
  degreeType: "degree" | "certificate";
};

export type ExperienceInfoItem = BaseInfoItem & {
  org: string;
  role: string;
  brand: string;
};

export type StackInfoItem = BaseInfoItem & {
  category: "technology" | "skill";
  bg?: string;
  fg?: string;
};

export type HobbyInfoItem = BaseInfoItem & {
  demo: true;
};

export type FamilyInfoItem = BaseInfoItem & {
  demo: true;
};

export type InfoItem =
  | EducationInfoItem
  | ExperienceInfoItem
  | StackInfoItem
  | HobbyInfoItem
  | FamilyInfoItem
  | BaseInfoItem;

export type NewsPanelItem = {
  id: string;
  title: string;
  date: string;
  body: string;
  href?: string;
  demo?: boolean;
};

export type PortalProject = {
  id: ProjectId;
  title: string;
  summary: string;
  tech: string[];
  liveUrl?: string | undefined;
  repoUrl?: string | undefined;
  image?: string | undefined;
  year?: string | undefined;
};

export type InfoBuildingPanel = {
  kind: "info";
  section: InfoSectionKind;
  buildingId: string;
  title: string;
  sign?: string;
  items: InfoItem[];
};

export type NewsBuildingPanel = {
  kind: "news";
  buildingId: string;
  title: string;
  sign?: string;
  items: NewsPanelItem[];
};

export type PortalBuildingPanel = {
  kind: "portal";
  buildingId: string;
  sign?: string;
  project: PortalProject;
};

export type BuildingPanel =
  InfoBuildingPanel | NewsBuildingPanel | PortalBuildingPanel;

/** Map of friendly/legacy editor IDs or bare project IDs to canonical world building IDs */
const BUILDING_ALIASES: Record<string, string> = {
  academy: "building_education",
  castle: "building_experience",
  forge: "building_stack",
  pavilion: "building_hobbies",
  cottage: "building_family",
  notice_board: "board_news",
  khidmty: "portal_khidmty",
  civicmind: "portal_civicmind",
  onyx: "portal_onyx",
  saleh: "portal_saleh",
  eyad: "portal_eyad",
};

function getDictionary(lang: string) {
  return lang === "ar" ? arDictionary : enDictionary;
}

// DEMO: replace with real content when user provides personal hobbies
const DEMO_HOBBIES: Record<"en" | "ar", HobbyInfoItem[]> = {
  en: [
    {
      id: "hobby_reading",
      title: "Reading (demo)",
      subtitle: "Technical & Non-fiction",
      description:
        "Exploring books on distributed systems, software design, and history.",
      demo: true,
    },
    {
      id: "hobby_walking",
      title: "Trail Walking (demo)",
      subtitle: "Outdoors & Nature",
      description:
        "Weekend walks along quiet paths and countryside trails to clear the mind.",
      demo: true,
    },
    {
      id: "hobby_retrogaming",
      title: "Retro Gaming (demo)",
      subtitle: "Pixel Art & Classics",
      description:
        "Studying 16-bit RPG mechanics, level pacing, and classic chiptune soundtracks.",
      demo: true,
    },
    {
      id: "hobby_coffee",
      title: "Coffee Brewing (demo)",
      subtitle: "Manual Pour-overs",
      description:
        "Experimenting with grind settings, water temperature, and single-origin roasts.",
      demo: true,
    },
  ],
  ar: [
    {
      id: "hobby_reading",
      title: "القراءة (تجريبي)",
      subtitle: "كتب تقنية وفكرية",
      description:
        "الاطلاع على مؤلفات النظم الموزعة وهندسة البرمجيات والتاريخ.",
      demo: true,
    },
    {
      id: "hobby_walking",
      title: "المشي في الطبيعة (تجريبي)",
      subtitle: "استكشاف الهواء الطلق",
      description: "مسارات المشي الهادئة في عطلات نهاية الأسبوع لتصفية الذهن.",
      demo: true,
    },
    {
      id: "hobby_retrogaming",
      title: "الألعاب الكلاسيكية (تجريبي)",
      subtitle: "فن البكسل والتصميم",
      description: "دراسة ميكانيكيات ألعاب الـ 16-بت الكلاسيكية وبناء العوالم.",
      demo: true,
    },
    {
      id: "hobby_coffee",
      title: "تحضير القهوة (تجريبي)",
      subtitle: "الترشيح اليدوي",
      description: "تجارب متأنية في طحن وتحضير حبوب القهوة المختصة.",
      demo: true,
    },
  ],
};

// DEMO: replace with real content when user provides family/community pillars
const DEMO_FAMILY: Record<"en" | "ar", FamilyInfoItem[]> = {
  en: [
    {
      id: "family_roots",
      title: "Family Roots (demo)",
      subtitle: "Foundation & Values",
      description:
        "The support system, principles, and encouragement that ground daily work.",
      demo: true,
    },
    {
      id: "family_community",
      title: "Community Values (demo)",
      subtitle: "Local Giving",
      description:
        "Belief in uplifting neighbours and contributing positively to local circles.",
      demo: true,
    },
    {
      id: "family_mentorship",
      title: "Volunteer Spirit (demo)",
      subtitle: "Helping Learners",
      description:
        "Sharing technical knowledge freely and mentoring the next generation of coders.",
      demo: true,
    },
  ],
  ar: [
    {
      id: "family_roots",
      title: "الجذور العائلية (تجريبي)",
      subtitle: "الأسس والمبادئ",
      description: "السند والتشجيع والقيم الأخلاقية الراسخة وراء كل جهد يومي.",
      demo: true,
    },
    {
      id: "family_community",
      title: "القيم المجتمعية (تجريبي)",
      subtitle: "المبادرات الإيجابية",
      description:
        "الإيمان بدعم المحيطين والمساهمة الفاعلة في المبادرات المحلية.",
      demo: true,
    },
    {
      id: "family_mentorship",
      title: "روح التطوع (تجريبي)",
      subtitle: "مساندة المتعلمين",
      description:
        "مشاركة المعرفة البرمجية ودعم الأجيال الجديدة في مسارهم التقني.",
      demo: true,
    },
  ],
};

// DEMO: replace with real content when user publishes official dispatches
const DEMO_NEWS: Record<"en" | "ar", NewsPanelItem[]> = {
  en: [
    {
      id: "news_launch",
      title: "Sky Islands Launch (demo)",
      date: "2026-10-17",
      body: "The interactive portfolio realm is officially live with full keyboard navigation and multi-island exploration.",
      demo: true,
    },
    {
      id: "news_controls",
      title: "Mobile Touch & Accessibility (demo)",
      date: "2026-10-14",
      body: "Added responsive virtual joystick, tap-to-interact shortcuts, and reduced motion adaptations.",
      demo: true,
    },
    {
      id: "news_panels",
      title: "Interactive Building Panels (demo)",
      date: "2026-10-11",
      body: "Visitors can now walk up to any building or portal to inspect real case studies and career milestones.",
      demo: true,
    },
  ],
  ar: [
    {
      id: "news_launch",
      title: "إطلاق جزر السماء (تجريبي)",
      date: "2026-10-17",
      body: "أصبح عالم البورتفوليو التفاعلي متاحاً رسمياً للتصفح والاستكشاف عبر الجزر المعلقة.",
      demo: true,
    },
    {
      id: "news_controls",
      title: "التحكم باللمس وسهولة الوصول (تجريبي)",
      date: "2026-10-14",
      body: "إضافة أزرار اللمس للهواتف الذكية ودعم تفضيل الحركة المخففة للمستخدمين.",
      demo: true,
    },
    {
      id: "news_panels",
      title: "لوحات المباني التفاعلية (تجريبي)",
      date: "2026-10-11",
      body: "يمكن الآن الاقتراب من أي مبنى أو بوابة لاستعراض تفاصيل المشاريع ومحطات المسيرة.",
      demo: true,
    },
  ],
};

/**
 * Resolves a BuildingPanel for the requested building ID and locale.
 * Returns null if the buildingId is not recognized.
 */
export function getBuildingPanel(
  buildingId: string,
  lang: string = "en",
  islands: readonly Island[] = ISLANDS
): BuildingPanel | null {
  const normId = BUILDING_ALIASES[buildingId] ?? buildingId;
  const isAr = lang === "ar";
  const dict = getDictionary(isAr ? "ar" : "en");

  // 1. Project Portals
  let projectId: ProjectId | undefined;
  if (normId.startsWith("portal_")) {
    const raw = normId.replace(/^portal_/, "");
    if (PROJECTS.some((p) => p.id === raw)) {
      projectId = raw as ProjectId;
    }
  } else if (PROJECTS.some((p) => p.id === normId)) {
    projectId = normId as ProjectId;
  }

  if (projectId) {
    const project = PROJECTS.find((p) => p.id === projectId);
    if (!project) return null;

    const portalBuildingId = `portal_${project.id}`;
    const dictProject =
      dict.projects.items[project.id as keyof typeof dict.projects.items];
    const sign =
      dict.world.buildings[
        portalBuildingId as keyof typeof dict.world.buildings
      ]?.sign;

    return {
      kind: "portal",
      buildingId: portalBuildingId,
      sign,
      project: {
        id: project.id,
        title: dictProject?.title ?? project.id,
        summary: dictProject?.description ?? "",
        tech: [...project.frameworks],
        liveUrl: project.href,
        repoUrl: undefined, // Live deployed customer project; no public repo
        image: project.image,
        year: project.year,
      },
    };
  }

  // 2. Education
  if (normId === "building_education") {
    const sign = dict.world.buildings.building_education?.sign;
    const title = dict.aboutPage.educationHeading;

    const items: EducationInfoItem[] = EDUCATION.map((edu) => {
      const entry =
        dict.aboutPage.education[
          edu.id as keyof typeof dict.aboutPage.education
        ];
      const isDegree = edu.kind === "degree";
      return {
        id: edu.id,
        title: entry?.qualification ?? edu.id,
        subtitle: entry?.school ?? "",
        school: entry?.school ?? "",
        qualification: entry?.qualification ?? "",
        period: entry?.period ?? "",
        degreeType: edu.kind,
        badge: isDegree
          ? isAr
            ? "درجة جامعية"
            : "Degree"
          : isAr
            ? "شهادة مهنية"
            : "Certificate",
      };
    });

    return {
      kind: "info",
      section: "education",
      buildingId: "building_education",
      title,
      sign,
      items,
    };
  }

  // 3. Experience
  if (normId === "building_experience") {
    const sign = dict.world.buildings.building_experience?.sign;
    const title = dict.aboutPage.experienceHeading;

    const items: ExperienceInfoItem[] = EXPERIENCE.map((exp) => {
      const entry =
        dict.aboutPage.experience[
          exp.id as keyof typeof dict.aboutPage.experience
        ];
      return {
        id: exp.id,
        title: entry?.role ?? exp.id,
        subtitle: entry?.org ?? "",
        org: entry?.org ?? "",
        role: entry?.role ?? "",
        period: entry?.period ?? "",
        brand: exp.brand,
      };
    });

    return {
      kind: "info",
      section: "experience",
      buildingId: "building_experience",
      title,
      sign,
      items,
    };
  }

  // 4. Tech Stack & Tooling
  if (normId === "building_stack") {
    const sign = dict.world.buildings.building_stack?.sign;
    const title = dict.aboutPage.stackHeading;

    const techItems: StackInfoItem[] = STACK_CHIPS.map((chip) => ({
      id: chip.id,
      title: chip.label,
      category: "technology",
      bg: chip.bg,
      fg: chip.fg,
      icon: chip.icon,
      badge: isAr ? "تقنية" : "Tech",
    }));

    const skillItems: StackInfoItem[] = SKILL_IDS.map((skillId) => {
      const label =
        dict.aboutPage.skills[skillId as keyof typeof dict.aboutPage.skills] ??
        skillId;
      return {
        id: skillId,
        title: label,
        category: "skill",
        badge: isAr ? "مهارة" : "Skill",
      };
    });

    return {
      kind: "info",
      section: "stack",
      buildingId: "building_stack",
      title,
      sign,
      items: [...techItems, ...skillItems],
    };
  }

  // 5. Hobbies (Demo data)
  if (normId === "building_hobbies") {
    const sign = dict.world.buildings.building_hobbies?.sign;
    const title = dict.world.hobbies.title;

    return {
      kind: "info",
      section: "hobbies",
      buildingId: "building_hobbies",
      title,
      sign,
      items: DEMO_HOBBIES[isAr ? "ar" : "en"],
    };
  }

  // 6. Family & Roots (Demo data)
  if (normId === "building_family") {
    const sign = dict.world.buildings.building_family?.sign;
    const title = dict.world.family.title;

    return {
      kind: "info",
      section: "family",
      buildingId: "building_family",
      title,
      sign,
      items: DEMO_FAMILY[isAr ? "ar" : "en"],
    };
  }

  // 7. News Board (Demo data)
  if (normId === "board_news") {
    const sign = dict.world.buildings.board_news?.sign;
    const title = isAr ? "لوحة الأخبار" : "Notice Board";

    return {
      kind: "news",
      buildingId: "board_news",
      title,
      sign,
      items: DEMO_NEWS[isAr ? "ar" : "en"],
    };
  }

  // Check if it exists as an unknown building on islands
  const existsInWorld = islands.some((isl) =>
    isl.buildings.some((b) => b.id === normId || b.id === buildingId)
  );
  if (!existsInWorld) {
    return null;
  }

  return null;
}

/**
 * Returns all demo entries present in the system, useful for verification and
 * listing placeholders that will eventually be replaced with real user content.
 */
export function getAllDemoEntries(lang: "en" | "ar" = "en"): Array<{
  buildingId: string;
  kind: string;
  id: string;
  title: string;
  demo: boolean;
}> {
  const isAr = lang === "ar";
  const hobbies = DEMO_HOBBIES[isAr ? "ar" : "en"].map((h) => ({
    buildingId: "building_hobbies",
    kind: "hobbies",
    id: h.id,
    title: h.title,
    demo: true,
  }));
  const family = DEMO_FAMILY[isAr ? "ar" : "en"].map((f) => ({
    buildingId: "building_family",
    kind: "family",
    id: f.id,
    title: f.title,
    demo: true,
  }));
  const news = DEMO_NEWS[isAr ? "ar" : "en"].map((n) => ({
    buildingId: "board_news",
    kind: "news",
    id: n.id,
    title: n.title,
    demo: true,
  }));

  return [...hobbies, ...family, ...news];
}
