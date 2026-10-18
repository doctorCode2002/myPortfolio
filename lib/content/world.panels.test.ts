import { describe, expect, it } from "vitest";
import { PROJECTS } from "./projects";
import { ISLANDS } from "./world";
import { getAllDemoEntries, getBuildingPanel } from "./world.panels";

describe("Building Panels Selector (lib/content/world.panels.ts)", () => {
  it("resolves every building defined in world.ts in both English and Arabic", () => {
    const allBuildings = ISLANDS.flatMap((island) => island.buildings);
    expect(allBuildings.length).toBeGreaterThan(0);

    const locales = ["en", "ar"] as const;

    for (const locale of locales) {
      for (const building of allBuildings) {
        const panel = getBuildingPanel(building.id, locale);
        expect(
          panel,
          `Expected building "${building.id}" to resolve in locale "${locale}"`
        ).not.toBeNull();

        if (panel?.kind === "info") {
          expect(panel.section).toBeDefined();
          expect(panel.title.trim().length).toBeGreaterThan(0);
          expect(panel.items.length).toBeGreaterThan(0);
          for (const item of panel.items) {
            expect(item.id).toBeDefined();
            expect(item.title.trim().length).toBeGreaterThan(0);
          }
        } else if (panel?.kind === "news") {
          expect(panel.title.trim().length).toBeGreaterThan(0);
          expect(panel.items.length).toBeGreaterThan(0);
          for (const item of panel.items) {
            expect(item.id).toBeDefined();
            expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(item.title.trim().length).toBeGreaterThan(0);
            expect(item.body.trim().length).toBeGreaterThan(0);
          }
        } else if (panel?.kind === "portal") {
          expect(panel.project.id).toBeDefined();
          expect(panel.project.title.trim().length).toBeGreaterThan(0);
          expect(panel.project.summary.trim().length).toBeGreaterThan(0);
          expect(panel.project.tech.length).toBeGreaterThan(0);
          expect(panel.project.liveUrl).toBeDefined();
          expect(panel.project.liveUrl).toMatch(/^https?:\/\//);
        }
      }
    }
  });

  it("returns null for unknown building IDs", () => {
    expect(getBuildingPanel("non_existent_building")).toBeNull();
    expect(getBuildingPanel("foo_bar_building", "en")).toBeNull();
    expect(getBuildingPanel("", "ar")).toBeNull();
  });

  it("resolves friendly / legacy editor aliases accurately", () => {
    const aliasMap = {
      academy: "education",
      castle: "experience",
      forge: "stack",
      pavilion: "hobbies",
      cottage: "family",
    } as const;

    for (const [alias, section] of Object.entries(aliasMap)) {
      const panel = getBuildingPanel(alias);
      expect(panel).not.toBeNull();
      expect(panel?.kind).toBe("info");
      if (panel?.kind === "info") {
        expect(panel.section).toBe(section);
      }
    }

    const newsPanel = getBuildingPanel("notice_board");
    expect(newsPanel?.kind).toBe("news");

    for (const p of PROJECTS) {
      const portalPanel = getBuildingPanel(p.id);
      expect(portalPanel?.kind).toBe("portal");
      if (portalPanel?.kind === "portal") {
        expect(portalPanel.project.id).toBe(p.id);
        expect(portalPanel.project.liveUrl).toBe(p.href);
      }
    }
  });

  it("ensures every portal has a liveUrl or an explicit reason it does not", () => {
    for (const project of PROJECTS) {
      const portalId = `portal_${project.id}`;
      const panel = getBuildingPanel(portalId);
      expect(panel).not.toBeNull();
      expect(panel?.kind).toBe("portal");

      if (panel?.kind === "portal") {
        // Every client / demo project in this portfolio has a deployed liveUrl
        expect(
          panel.project.liveUrl,
          `Portal "${portalId}" must have a valid liveUrl`
        ).toBeDefined();
        expect(panel.project.liveUrl).toBe(project.href);
        expect(panel.project.liveUrl).toMatch(/^https?:\/\//);

        // repoUrl is intentionally undefined for client-owned proprietary projects
        if (!panel.project.repoUrl) {
          expect(
            ["waco", "khidmty", "civicmind", "onyx", "saleh", "eyad"].includes(
              panel.project.id
            )
          ).toBe(true);
        }
      }
    }
  });

  it("lists every demo entry so placeholders are easy to find and replace", () => {
    const demoEntriesEn = getAllDemoEntries("en");
    const demoEntriesAr = getAllDemoEntries("ar");

    expect(demoEntriesEn.length).toBeGreaterThan(0);
    expect(demoEntriesAr.length).toBe(demoEntriesEn.length);

    // Verify all demo entries are flagged with demo: true
    for (const entry of [...demoEntriesEn, ...demoEntriesAr]) {
      expect(entry.demo).toBe(true);
      expect(entry.buildingId).toMatch(
        /^(building_hobbies|building_family|board_news|progress_.+)$/
      );
      expect(entry.title).toBeDefined();
    }

    const hobbyIds = demoEntriesEn
      .filter((e) => e.kind === "hobbies")
      .map((e) => e.id);
    const familyIds = demoEntriesEn
      .filter((e) => e.kind === "family")
      .map((e) => e.id);
    const newsIds = demoEntriesEn
      .filter((e) => e.kind === "news")
      .map((e) => e.id);

    expect(hobbyIds).toEqual([
      "hobby_reading",
      "hobby_walking",
      "hobby_retrogaming",
      "hobby_coffee",
    ]);

    expect(familyIds).toEqual([
      "family_roots",
      "family_community",
      "family_mentorship",
    ]);

    expect(newsIds).toEqual(["news_launch", "news_controls", "news_panels"]);
  });
});
