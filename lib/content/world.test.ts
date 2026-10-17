import arDictionary from "@/app/dictionaries/ar.json";
import enDictionary from "@/app/dictionaries/en.json";
import { describe, expect, it } from "vitest";
import { EDUCATION, EXPERIENCE } from "./about";
import { PROJECTS, type ProjectId } from "./projects";
import {
  BRIDGES,
  ISLAND_RADIUS,
  ISLANDS,
  NEWS,
  type Island,
  type IslandId,
} from "./world";
import {
  getIsland,
  getMayorDialogue,
  islandWorldBounds,
  neighbors,
} from "./world.selectors";
import { validateWorld } from "./world.validate";

describe("Sky-islands world data model", () => {
  it("passes comprehensive validateWorld() with zero errors", () => {
    const errors = validateWorld();
    expect(errors).toEqual([]);
  });

  it("ensures all island IDs are unique", () => {
    const ids = ISLANDS.map((i) => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("ensures every ProjectId has exactly one island", () => {
    const projectIds = PROJECTS.map((p) => p.id);
    for (const projectId of projectIds) {
      const matching = ISLANDS.filter((i) => i.id === projectId);
      expect(
        matching,
        `Expected exactly one island for project "${projectId}"`
      ).toHaveLength(1);
    }

    expect(ISLANDS.length).toBe(projectIds.length + 1);
  });

  it("ensures home island is at (0, 0) and hosts all required life buildings", () => {
    const home = getIsland("home");
    expect(home).toBeDefined();
    expect(home!.at).toEqual({ x: 0, y: 0 });
    expect(home!.size).toBe("l");

    const eduBuilding = home!.buildings.find(
      (b) => b.kind === "info" && b.section.type === "education"
    );
    expect(eduBuilding).toBeDefined();
    if (
      eduBuilding &&
      eduBuilding.kind === "info" &&
      eduBuilding.section.type === "education"
    ) {
      const eduIds = EDUCATION.map((e) => e.id);
      expect(eduBuilding.section.ids).toEqual(expect.arrayContaining(eduIds));
      expect(eduBuilding.section.ids.length).toBe(eduIds.length);
    }

    const expBuilding = home!.buildings.find(
      (b) => b.kind === "info" && b.section.type === "experience"
    );
    expect(expBuilding).toBeDefined();
    if (
      expBuilding &&
      expBuilding.kind === "info" &&
      expBuilding.section.type === "experience"
    ) {
      const expIds = EXPERIENCE.map((e) => e.id);
      expect(expBuilding.section.ids).toEqual(expect.arrayContaining(expIds));
      expect(expBuilding.section.ids.length).toBe(expIds.length);
    }

    expect(
      home!.buildings.some(
        (b) => b.kind === "info" && b.section.type === "stack"
      )
    ).toBe(true);
    expect(
      home!.buildings.some(
        (b) => b.kind === "info" && b.section.type === "hobbies"
      )
    ).toBe(true);
    expect(
      home!.buildings.some(
        (b) => b.kind === "info" && b.section.type === "family"
      )
    ).toBe(true);
    expect(home!.buildings.some((b) => b.kind === "board")).toBe(true);
  });

  it("ensures every project island has a portal to its project and a mayor", () => {
    for (const project of PROJECTS) {
      const island = getIsland(project.id);
      expect(island).toBeDefined();
      expect(island!.mayor).toBeDefined();

      const portal = island!.buildings.find((b) => b.kind === "portal");
      expect(portal).toBeDefined();
      if (portal && portal.kind === "portal") {
        expect(portal.projectId).toBe(project.id);
      }
    }
  });

  it("links saleh and eyad mayors to their testimonials", () => {
    const saleh = getIsland("saleh");
    expect(saleh?.mayor?.testimonialId).toBe("saleh");

    const eyad = getIsland("eyad");
    expect(eyad?.mayor?.testimonialId).toBe("eyad");
  });

  it("ensures all bridge endpoints exist and are distinct", () => {
    const islandIds = new Set(ISLANDS.map((i) => i.id));
    for (const bridge of BRIDGES) {
      expect(islandIds.has(bridge.from)).toBe(true);
      expect(islandIds.has(bridge.to)).toBe(true);
      expect(bridge.from).not.toBe(bridge.to);
    }
  });

  it("ensures the graph is connected from home", () => {
    const visited = new Set<IslandId>(["home"]);
    const queue: IslandId[] = ["home"];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighborId of neighbors(current)) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      }
    }

    for (const island of ISLANDS) {
      expect(
        visited.has(island.id),
        `Island "${island.id}" should be reachable from home`
      ).toBe(true);
    }
  });

  it("ensures no island footprints overlap", () => {
    for (let i = 0; i < ISLANDS.length; i++) {
      const a = ISLANDS[i]!;
      const rA = ISLAND_RADIUS[a.size];

      for (let j = i + 1; j < ISLANDS.length; j++) {
        const b = ISLANDS[j]!;
        const rB = ISLAND_RADIUS[b.size];

        const dist = Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y);
        const minClearance = rA + rB;
        expect(
          dist,
          `Footprint overlap between island "${a.id}" and "${b.id}"`
        ).toBeGreaterThanOrEqual(minClearance);
      }
    }
  });

  it("ensures every referenced dictionary key exists in BOTH en and ar", () => {
    const dictionaries = [
      { locale: "en", dict: enDictionary },
      { locale: "ar", dict: arDictionary },
    ] as const;

    for (const { locale, dict } of dictionaries) {
      expect(dict.world, `Missing world section in ${locale}`).toBeDefined();

      for (const island of ISLANDS) {
        const entry =
          dict.world.islands[island.id as keyof typeof dict.world.islands];
        expect(
          entry,
          `Missing world.islands.${island.id} in ${locale}`
        ).toBeDefined();
        expect(
          entry.name?.trim().length,
          `Empty name for ${island.id} in ${locale}`
        ).toBeGreaterThan(0);
        expect(
          entry.sign?.trim().length,
          `Empty sign for ${island.id} in ${locale}`
        ).toBeGreaterThan(0);
      }

      for (const island of ISLANDS) {
        for (const building of island.buildings) {
          const entry =
            dict.world.buildings[
              building.id as keyof typeof dict.world.buildings
            ];
          expect(
            entry,
            `Missing world.buildings.${building.id} in ${locale}`
          ).toBeDefined();
          expect(
            entry.sign?.trim().length,
            `Empty sign for building ${building.id} in ${locale}`
          ).toBeGreaterThan(0);
          expect(
            entry.enterPrompt?.trim().length,
            `Empty enterPrompt for building ${building.id} in ${locale}`
          ).toBeGreaterThan(0);
        }
      }

      for (const island of ISLANDS) {
        if (island.mayor) {
          const m = island.mayor;
          const entry =
            dict.world.mayors[m.id as keyof typeof dict.world.mayors];
          expect(
            entry,
            `Missing world.mayors.${m.id} in ${locale}`
          ).toBeDefined();
          expect(
            entry.lines.length,
            `Empty lines for mayor ${m.id} in ${locale}`
          ).toBeGreaterThan(0);

          if (m.testimonialId) {
            const testimonial =
              dict.testimonials.items[
                m.testimonialId as keyof typeof dict.testimonials.items
              ];
            expect(
              testimonial,
              `Missing testimonials.items.${m.testimonialId} in ${locale}`
            ).toBeDefined();
            expect(testimonial.name?.trim().length).toBeGreaterThan(0);
            expect(testimonial.role?.trim().length).toBeGreaterThan(0);
            expect(testimonial.quote?.trim().length).toBeGreaterThan(0);
            expect((entry as Record<string, unknown>)["name"]).toBeUndefined();
            expect((entry as Record<string, unknown>)["title"]).toBeUndefined();
          } else {
            expect((entry as Record<string, unknown>)["name"]).toBeDefined();
            expect((entry as Record<string, unknown>)["title"]).toBeDefined();
          }
        }
      }

      expect(dict.world.hobbies.title?.trim().length).toBeGreaterThan(0);
      expect(dict.world.hobbies.body?.trim().length).toBeGreaterThan(0);
      expect(dict.world.family.title?.trim().length).toBeGreaterThan(0);
      expect(dict.world.family.body?.trim().length).toBeGreaterThan(0);

      for (const item of NEWS) {
        const entry = dict.world.news[item.id as keyof typeof dict.world.news];
        expect(
          entry,
          `Missing world.news.${item.id} in ${locale}`
        ).toBeDefined();
        expect(entry.title?.trim().length).toBeGreaterThan(0);
        expect(entry.body?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  describe("Selectors", () => {
    it("getIsland returns correct island or undefined", () => {
      expect(getIsland("home")?.id).toBe("home");
      expect(getIsland("khidmty")?.id).toBe("khidmty");
      expect(getIsland("non_existent" as unknown as IslandId)).toBeUndefined();
    });

    it("neighbors returns bidirectional neighbors", () => {
      const homeNeighbors = neighbors("home");
      for (const project of PROJECTS) {
        expect(homeNeighbors).toContain(project.id);
      }

      const salehNeighbors = neighbors("saleh");
      expect(salehNeighbors).toContain("home");
      expect(salehNeighbors).toContain("eyad");

      const eyadNeighbors = neighbors("eyad");
      expect(eyadNeighbors).toContain("home");
      expect(eyadNeighbors).toContain("saleh");
    });

    it("islandWorldBounds calculates accurate tile boundaries", () => {
      const home = getIsland("home")!;
      const bounds = islandWorldBounds(home);
      const expectedRadius = ISLAND_RADIUS[home.size];

      expect(bounds.width).toBe(expectedRadius * 2);
      expect(bounds.height).toBe(expectedRadius * 2);
      expect(bounds.minX).toBe(home.at.x - expectedRadius);
      expect(bounds.maxX).toBe(home.at.x + expectedRadius);
      expect(bounds.minY).toBe(home.at.y - expectedRadius);
      expect(bounds.maxY).toBe(home.at.y + expectedRadius);
    });

    it("getMayorDialogue resolves verbatim quotes for testimonial-backed mayors", () => {
      const saleh = getIsland("saleh")!.mayor!;
      const eyad = getIsland("eyad")!.mayor!;

      // English
      const enSaleh = getMayorDialogue(saleh, enDictionary);
      expect(enSaleh.name).toBe(enDictionary.testimonials.items.saleh.name);
      expect(enSaleh.title).toBe(enDictionary.testimonials.items.saleh.role);
      expect(enSaleh.quote).toBe(enDictionary.testimonials.items.saleh.quote);
      expect(enSaleh.lines).toContain(
        enDictionary.testimonials.items.saleh.quote
      );
      expect(enSaleh.lines[0]).toBe(
        enDictionary.world.mayors.mayor_saleh.lines[0]
      );

      const enEyad = getMayorDialogue(eyad, enDictionary);
      expect(enEyad.name).toBe(enDictionary.testimonials.items.eyad.name);
      expect(enEyad.title).toBe(enDictionary.testimonials.items.eyad.role);
      expect(enEyad.quote).toBe(enDictionary.testimonials.items.eyad.quote);
      expect(enEyad.lines).toContain(
        enDictionary.testimonials.items.eyad.quote
      );
      expect(enEyad.lines[0]).toBe(
        enDictionary.world.mayors.mayor_eyad.lines[0]
      );

      // Arabic
      const arSaleh = getMayorDialogue(saleh, arDictionary);
      expect(arSaleh.name).toBe(arDictionary.testimonials.items.saleh.name);
      expect(arSaleh.title).toBe(arDictionary.testimonials.items.saleh.role);
      expect(arSaleh.quote).toBe(arDictionary.testimonials.items.saleh.quote);
      expect(arSaleh.lines).toContain(
        arDictionary.testimonials.items.saleh.quote
      );
      expect(arSaleh.lines[0]).toBe(
        arDictionary.world.mayors.mayor_saleh.lines[0]
      );

      const arEyad = getMayorDialogue(eyad, arDictionary);
      expect(arEyad.name).toBe(arDictionary.testimonials.items.eyad.name);
      expect(arEyad.title).toBe(arDictionary.testimonials.items.eyad.role);
      expect(arEyad.quote).toBe(arDictionary.testimonials.items.eyad.quote);
      expect(arEyad.lines).toContain(
        arDictionary.testimonials.items.eyad.quote
      );
      expect(arEyad.lines[0]).toBe(
        arDictionary.world.mayors.mayor_eyad.lines[0]
      );
    });

    it("getMayorDialogue handles non-testimonial mayors with placeholder data", () => {
      const khidmtyMayor = getIsland("khidmty")!.mayor!;
      const dialogue = getMayorDialogue(khidmtyMayor, enDictionary);

      expect(dialogue.name).toBe("Khidmty Mayor");
      expect(dialogue.title).toBe("TODO: user to fill");
      expect(dialogue.quote).toBeUndefined();
      expect(dialogue.lines).toEqual(["TODO: user to fill"]);
    });

    it("validateWorld catches disconnected islands and overlapping islands", () => {
      const disconnectedIsland: Island = {
        id: "khidmty" as ProjectId,
        at: { x: 500, y: 500 },
        size: "s",
        biome: "crystal",
        buildings: [],
      };

      const overlapIsland: Island = {
        id: "onyx" as ProjectId,
        at: { x: 2, y: 2 },
        size: "s",
        biome: "desert",
        buildings: [],
      };

      const customErrors = validateWorld({
        world: {
          islands: [ISLANDS[0]!, disconnectedIsland, overlapIsland],
          bridges: [],
          news: [],
        },
      });

      expect(
        customErrors.some((e) => e.includes('not reachable from "home"'))
      ).toBe(true);
      expect(customErrors.some((e) => e.includes("overlap"))).toBe(true);
    });
  });
});
