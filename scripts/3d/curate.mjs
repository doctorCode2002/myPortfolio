#!/usr/bin/env node
/**
 * 3D asset curation pipeline (docs/WORLD_3D_SPEC.md).
 *
 * Copies the chosen CC0 models from the downloaded source packs into public/game3d/models/ with clean kebab-case
 * names, optimises each one with glTF-Transform (dedup, prune, weld, resample, textures resized to <= 512 px, plain
 * KHR_mesh_quantization; no Draco or meshopt, so drei's useGLTF loads them with no decoder setup), measures its
 * bounding box and writes public/game3d/models/manifest.json.
 *
 * Usage:
 *   node scripts/3d/curate.mjs [sourceDir] [--only=<name,name>] [--manifest-only]
 *
 * sourceDir holds kaykit-adventurers/, kaykit-hexagon/ and kenney/3d/<kit>/ (see DEFAULT_SOURCE). Re-running is safe:
 * every selected model is rebuilt and the manifest is regenerated from the SELECTION table below.
 *
 * HARD RULE: no cross symbols. Models with a cross (church tops, windmill blades, crossed swords, crossguard swords,
 * X-braced boards, 4-way road junctions seen from above) are either banned (copied for the dev gallery only, flagged
 * banned:true with a reason; the engine refuses them) or have the offending node stripped (`strip`).
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  quantize,
  resample,
  weld,
} from "@gltf-transform/functions";
import sharp from "sharp";

const DEFAULT_SOURCE =
  "/tmp/claude-1000/-home-mohammed/b1ba6010-9ea1-4ed2-8f3b-791ac93a4c0c/scratchpad/dl-3d";
const OUT_DIR = path.resolve(import.meta.dirname, "../../public/game3d/models");

/* ------------------------------------------------------------------------------------------------------------------ */
/* World unit                                                                                                          */
/* ------------------------------------------------------------------------------------------------------------------ */

// 1 world unit = 1 KayKit Medieval Hexagon native unit. A hex tile is 2.0 across the flats (X axis) and 2.309 corner
// to corner (Z axis, pointy-top). Characters are scaled to CHARACTER_HEIGHT (0.45 x hexSize).
const HEX_SIZE = 2.0;
const CHARACTER_HEIGHT = 0.9;
const MAX_TEXTURE = 512;

// Per-pack scale so every pack matches the world unit (checked side by side in /[lang]/play/gallery).
const PACK_SCALE = {
  "kaykit-hexagon-tile": 1, // tiles, hex-edge fences/walls, bridges, hills: authored at hex size
  "kaykit-hexagon": 2, // buildings, props and single trees: authored as a map miniature, x2 = cottage fills a hex
  "kenney-fantasy-town": 1.2, // wall module 1.0 -> 1.2, lantern 1.9
  "kenney-castle": 1.2,
  "kenney-survival": 1.3, // barrel 0.34 -> 0.44
  "kenney-nature": 1.5, // oak 1.23 -> 1.85, flower 0.29 -> 0.44
};

const LICENSES = {
  "kaykit-adventurers": "CC0", // KayKit : Adventurers Character Pack (1.0), LICENSE.txt: Creative Commons Zero, CC0
  "kaykit-hexagon": "CC0", // KayKit : Medieval Hexagon Pack (1.0), LICENSE.txt: Creative Commons Zero, CC0
  "kenney-castle": "CC0", // kenney/LICENSE.txt + README: all Kenney art is Creative Commons Zero
  "kenney-fantasy-town": "CC0",
  "kenney-nature": "CC0",
  "kenney-survival": "CC0",
  "kenney-mini-characters": "CC0",
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* Selection                                                                                                           */
/* ------------------------------------------------------------------------------------------------------------------ */

const KH = "kaykit-hexagon/addons/kaykit_medieval_hexagon_pack/Assets/gltf";
const KA =
  "kaykit-adventurers/addons/kaykit_character_pack_adventures/Characters/gltf";
const KN = "kenney/3d";

/** Clips kept on the KayKit adventurers (76 in the source; the rest are combat moves). */
const KAYKIT_CLIPS = [
  "Idle",
  "Unarmed_Idle",
  "Walking_A",
  "Walking_B",
  "Walking_C",
  "Walking_Backwards",
  "Running_A",
  "Running_B",
  "Jump_Start",
  "Jump_Idle",
  "Jump_Land",
  "Jump_Full_Short",
  "Cheer",
  "Interact",
  "PickUp",
  "Use_Item",
  "Spellcast_Raise",
  "Hit_A",
  "Sit_Chair_Down",
  "Sit_Chair_Idle",
  "Sit_Chair_StandUp",
  "Sit_Floor_Down",
  "Sit_Floor_Idle",
  "Sit_Floor_StandUp",
];
/** Every hand-held item on the KayKit rigs: swords (crossguards), axes, shields, crossbows, knives, wands, books. */
const KAYKIT_WEAPONS =
  /^(1H_|2H_|Knife|Throwable|Mug$|Spellbook|.*Shield|1H_Sword_Offhand|1H_Axe_Offhand)/;

const KENNEY_MINI_CLIPS = [
  "static",
  "idle",
  "walk",
  "sprint",
  "jump",
  "fall",
  "sit",
  "pick-up",
  "emote-yes",
  "emote-no",
  "interact-right",
  "interact-left",
];

/**
 * @typedef {object} Entry
 * @property {string} name     kebab-case model name (file = <name>.glb)
 * @property {string} src      path relative to the source dir
 * @property {string} source   manifest source id
 * @property {string} pack     PACK_SCALE key
 * @property {"terrain"|"building"|"nature"|"prop"|"character"|"bridge"} kind
 * @property {string[]} tags
 * @property {boolean} [lazy]  not part of the first load
 * @property {boolean} [solid] blocks walking (default: true except terrain/flat decals)
 * @property {string}  [banned] reason; banned models are copied for the dev gallery only
 * @property {RegExp}  [strip] node names to remove (weapons, emblems)
 * @property {string}  [stripNote]
 * @property {string[]} [clips] animation clips to keep (characters)
 * @property {Record<string, number[]>} [recolor] material name -> linear RGB base colour
 * @property {number}  [scale] explicit scale (overrides the pack scale)
 * @property {Record<string, unknown>} [extra] extra manifest fields
 */

/** @type {Entry[]} */
const SELECTION = [];

const kebab = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();

function add(entry) {
  SELECTION.push(entry);
}
/** KayKit hexagon helper: file is relative to Assets/gltf, name derived from the file. */
function kh(file, kind, tags, opts = {}) {
  const base = path.basename(file, ".gltf");
  add({
    name: opts.name ?? kebab(base),
    src: `${KH}/${file}`,
    source: "kaykit-hexagon",
    pack:
      opts.pack ??
      (kind === "terrain" ? "kaykit-hexagon-tile" : "kaykit-hexagon"),
    kind,
    tags,
    ...opts,
  });
}
/** Kenney helper: kit + file name (no extension). */
function kn(kit, file, kind, tags, opts = {}) {
  add({
    name: opts.name ?? kebab(file),
    src: `${KN}/${kit}/${file}.glb`,
    source: `kenney-${kit}`,
    pack: opts.pack ?? `kenney-${kit}`,
    kind,
    tags,
    ...opts,
  });
}

// ---- Terrain: KayKit hex tiles -------------------------------------------------------------------------------------
kh("tiles/base/hex_grass.gltf", "terrain", ["grass", "walkable"], {
  extra: { walkable: true },
});
kh("tiles/base/hex_grass_bottom.gltf", "terrain", ["grass", "base", "stack"], {
  extra: { walkable: true },
});
kh(
  "tiles/base/hex_grass_sloped_low.gltf",
  "terrain",
  ["grass", "slope", "ramp", "walkable"],
  {
    extra: { walkable: true, rise: 0.5 },
  }
);
kh(
  "tiles/base/hex_grass_sloped_high.gltf",
  "terrain",
  ["grass", "slope", "ramp", "walkable"],
  {
    extra: { walkable: true, rise: 1 },
  }
);
kh("tiles/base/hex_water.gltf", "terrain", ["water"], {
  extra: { walkable: false },
});
for (const l of ["A", "B", "C", "D", "E"]) {
  kh(
    `tiles/coast/hex_coast_${l}.gltf`,
    "terrain",
    ["coast", "water", "sand", "beach"],
    {
      lazy: l > "C",
      extra: { walkable: true },
    }
  );
  kh(
    `tiles/coast/waterless/hex_coast_${l}_waterless.gltf`,
    "terrain",
    ["coast", "sand", "cliff"],
    {
      lazy: l > "C",
      extra: { walkable: true },
    }
  );
}
// Roads: A straight, B-M bends and junctions. 4-way junctions (two straight roads crossing) read as an X from the
// top-down camera, so they are banned after visual review (see BANNED_ROADS).
const X_JUNCTION =
  "4+ road arms meeting in the middle read as an X/cross from the top-down camera";
const BANNED_ROADS = {
  H: X_JUNCTION,
  I: X_JUNCTION,
  K: X_JUNCTION,
  L: X_JUNCTION,
};
for (const l of "ABCDEFGHIJKLM") {
  kh(
    `tiles/roads/hex_road_${l}.gltf`,
    "terrain",
    ["road", "path", "walkable"],
    {
      lazy: !"ABCDE".includes(l),
      extra: { walkable: true },
      ...(BANNED_ROADS[l] ? { banned: BANNED_ROADS[l] } : {}),
    }
  );
}
kh(
  "tiles/roads/hex_road_A_sloped_low.gltf",
  "terrain",
  ["road", "slope", "ramp", "walkable"],
  {
    extra: { walkable: true, rise: 0.5 },
  }
);
kh(
  "tiles/roads/hex_road_A_sloped_high.gltf",
  "terrain",
  ["road", "slope", "ramp", "walkable"],
  {
    extra: { walkable: true, rise: 1 },
  }
);
for (const r of ["A", "A_curvy", "B", "C", "D", "E", "F"]) {
  kh(
    `tiles/rivers/hex_river_${r}.gltf`,
    "terrain",
    ["river", "water", "stream"],
    {
      lazy: !["A", "A_curvy", "B"].includes(r),
      extra: { walkable: false },
    }
  );
}
kh(
  "tiles/rivers/hex_river_crossing_A.gltf",
  "terrain",
  ["river", "road", "crossing"],
  {
    lazy: true,
    banned:
      "A road crossing a river at right angles forms a cross shape seen from above",
  }
);

// ---- Buildings: KayKit hexagon (scale 2) ---------------------------------------------------------------------------
const B = (colour, type, tags, opts = {}) =>
  kh(
    `buildings/${colour}/building_${type}_${colour}.gltf`,
    "building",
    [colour, ...tags],
    opts
  );

// home: castle with banners, forge, cottage, academy
B("red", "castle", ["castle", "home", "medieval"]);
B("blue", "castle", ["castle", "medieval"], { lazy: true });
B("red", "blacksmith", ["forge", "workshop", "home"]);
B("red", "home_A", ["cottage", "house", "home"]);
B("red", "home_B", ["house", "academy", "two-storey", "home", "saleh"]);
B("red", "tavern", ["tavern", "academy", "school", "home", "saleh", "gallery"]);
B("red", "tower_A", ["tower", "lookout"], { lazy: true });
// khidmty: guild hall, market, well
B("yellow", "market", ["market", "stalls", "khidmty", "onyx", "bazaar"]);
B("blue", "market", ["market", "stalls", "khidmty"], { lazy: true });
B("blue", "tavern", ["guild-hall", "tavern", "khidmty", "civicmind"]);
B("blue", "well", ["well", "khidmty", "civicmind"]);
B("blue", "lumbermill", ["workshop", "mill", "khidmty"], { lazy: true });
// civicmind: town hall with a bell tower
B("blue", "tower_B", [
  "tower",
  "bell-tower",
  "clock-tower",
  "civicmind",
  "town-hall",
]);
B("blue", "tower_A", ["tower", "bell-tower", "civicmind"], { lazy: true });
B("blue", "home_B", ["house", "town-hall", "civicmind"]);
B("blue", "home_A", ["cottage", "house", "civicmind"], { lazy: true });
// onyx: desert bazaar (yellow roofs read as sand/gold)
B("yellow", "castle", ["palace", "onyx"], { lazy: true });
B("yellow", "tower_B", ["palace", "tower", "onyx"]);
B("yellow", "home_A", ["house", "onyx"]);
B("yellow", "home_B", ["house", "onyx"], { lazy: true });
B("yellow", "well", ["well", "onyx", "oasis"], { lazy: true });
// eyad: spring design studio
B("green", "tavern", ["studio", "eyad"]);
B("green", "home_A", ["cottage", "studio", "eyad"]);
B("green", "home_B", ["house", "studio", "eyad"], { lazy: true });
B("green", "watermill", ["mill", "water"], {
  lazy: true,
  banned: "Spoked water wheel: seen side-on its spokes cross at the hub",
});
B("green", "well", ["well", "eyad"], { lazy: true });
// neutral
kh(
  "buildings/neutral/building_stage_A.gltf",
  "prop",
  ["stage", "construction", "neutral"],
  { lazy: true }
);
kh(
  "buildings/neutral/building_stage_B.gltf",
  "prop",
  ["stage", "construction", "neutral"],
  { lazy: true }
);
kh(
  "buildings/neutral/building_stage_C.gltf",
  "building",
  ["construction", "stage", "neutral"],
  { lazy: true }
);
kh(
  "buildings/neutral/building_scaffolding.gltf",
  "building",
  ["scaffolding", "construction"],
  {
    lazy: true,
  }
);
kh(
  "buildings/neutral/building_grain.gltf",
  "nature",
  ["field", "wheat", "farm"],
  {
    lazy: true,
    solid: false,
  }
);
kh(
  "buildings/neutral/building_dirt.gltf",
  "terrain",
  ["dirt", "plaza", "overlay"],
  {
    pack: "kaykit-hexagon-tile",
    solid: false,
    extra: { walkable: true, overlay: true },
  }
);
// Banned KayKit buildings (copied for the gallery only)
for (const c of ["blue"]) {
  B(c, "church", ["church"], {
    lazy: true,
    banned: "Church with a cross on top of the steeple",
  });
  B(c, "windmill", ["windmill"], {
    lazy: true,
    banned: "Windmill: its four blades form a cross",
  });
  B(c, "barracks", ["barracks"], {
    lazy: true,
    banned:
      "Crossed-swords emblem on the facade (single mesh, cannot be stripped)",
  });
}

// ---- Hex-edge fences, walls and bridges (scale 1: they span a hex edge or a hex) ----------------------------------
const tileOpts = { pack: "kaykit-hexagon-tile" };
kh(
  "buildings/neutral/fence_wood_straight.gltf",
  "prop",
  ["fence", "wood", "hex-edge"],
  tileOpts
);
kh(
  "buildings/neutral/fence_wood_straight_gate.gltf",
  "prop",
  ["fence", "gate", "wood", "hex-edge"],
  tileOpts
);
kh(
  "buildings/neutral/fence_stone_straight.gltf",
  "prop",
  ["fence", "stone", "hex-edge"],
  tileOpts
);
kh(
  "buildings/neutral/fence_stone_straight_gate.gltf",
  "prop",
  ["fence", "gate", "stone", "hex-edge"],
  tileOpts
);
kh(
  "buildings/neutral/wall_straight.gltf",
  "building",
  ["wall", "castle", "hex"],
  { ...tileOpts, lazy: true }
);
kh(
  "buildings/neutral/wall_straight_gate.gltf",
  "building",
  ["wall", "gate", "castle", "hex"],
  {
    ...tileOpts,
    lazy: true,
  }
);
kh(
  "buildings/neutral/wall_corner_A_inside.gltf",
  "building",
  ["wall", "castle", "hex"],
  { ...tileOpts, lazy: true }
);
kh(
  "buildings/neutral/wall_corner_A_outside.gltf",
  "building",
  ["wall", "castle", "hex"],
  { ...tileOpts, lazy: true }
);
kh(
  "buildings/neutral/building_bridge_A.gltf",
  "bridge",
  ["bridge", "stone", "river", "hex"],
  tileOpts
);
kh(
  "buildings/neutral/building_bridge_B.gltf",
  "bridge",
  ["bridge", "wood", "river", "hex"],
  tileOpts
);

// ---- KayKit props (scale 2) -----------------------------------------------------------------------------------------
const P = (file, tags, opts = {}) =>
  kh(`decoration/props/${file}.gltf`, "prop", tags, opts);
P("barrel", ["barrel", "market"]);
P("bucket_water", ["bucket", "well"]);
P("bucket_empty", ["bucket"], { lazy: true });
P("crate_A_big", ["crate", "market"]);
P("crate_A_small", ["crate", "market"]);
P("crate_B_big", ["crate", "market"]);
P("crate_B_small", ["crate", "market"], { lazy: true });
P("crate_long_A", ["crate", "goods", "market"]);
P("crate_long_B", ["crate", "goods", "market"], { lazy: true });
P("crate_long_C", ["crate", "goods", "market"], { lazy: true });
P("crate_open", ["crate", "goods", "market"]);
P("sack", ["sack", "goods", "market"]);
P("pallet", ["pallet", "market"], { lazy: true });
P("wheelbarrow", ["wheelbarrow", "cart", "tools", "khidmty"]);
P("resource_lumber", ["lumber", "planks", "khidmty"]);
P("resource_stone", ["stone", "blocks", "khidmty"], { lazy: true });
P("ladder", ["ladder"], { lazy: true });
P("tent", ["tent", "canopy", "pavilion", "awning", "market", "onyx", "home"]);
P("target", ["target", "archery"], { lazy: true });
for (const c of ["red", "blue", "green", "yellow"])
  P(`flag_${c}`, ["flag", "banner", c]);
P("weaponrack", ["weapons"], {
  lazy: true,
  banned: "Rack of swords with crossguards",
});

// ---- KayKit nature (scale 2 for singles, 1 for hex-sized hills/mountains) ------------------------------------------
const N = (file, tags, opts = {}) =>
  kh(`decoration/nature/${file}.gltf`, "nature", tags, opts);
N("tree_single_A", ["tree", "pine", "green"]);
N("tree_single_B", ["tree", "pine", "green"]);
N("rock_single_A", ["rock"]);
N("rock_single_C", ["rock"]);
N("rock_single_E", ["rock"]);
N("waterlily_A", ["lily", "pond", "eyad"], { solid: false });
N("waterlily_B", ["lily", "pond", "eyad"], { solid: false });
N("waterplant_A", ["reeds", "pond"], { solid: false });
N("waterplant_C", ["reeds", "pond"], { solid: false, lazy: true });
N("hills_A_trees", ["hill", "forest", "hex"], {
  pack: "kaykit-hexagon-tile",
  lazy: true,
});
N("mountain_A_grass_trees", ["mountain", "hex"], {
  pack: "kaykit-hexagon-tile",
  lazy: true,
});
N("cloud_big", ["cloud", "sky"], {
  pack: "kaykit-hexagon-tile",
  solid: false,
  lazy: true,
});
N("cloud_small", ["cloud", "sky"], {
  pack: "kaykit-hexagon-tile",
  solid: false,
});

// ---- Kenney fantasy town (scale 1.2) ------------------------------------------------------------------------------
const FT = (file, kind, tags, opts = {}) =>
  kn("fantasy-town", file, kind, tags, opts);
FT("fountain-round", "prop", ["fountain", "plaza", "home", "civicmind"]);
FT("fountain-round-detail", "prop", ["fountain", "plaza"], { lazy: true });
FT("fountain-square-detail", "prop", ["fountain", "plaza", "civicmind"], {
  lazy: true,
});
FT("fountain-center", "prop", ["fountain", "plaza"]);
FT("lantern", "prop", ["lamp", "lantern", "street", "civicmind"]);
FT("cart", "prop", ["cart", "market"], {
  lazy: true,
  banned: "Spoked wheels: four spokes form a cross",
});
FT("cart-high", "prop", ["cart", "market"], {
  lazy: true,
  banned: "Spoked wheels: four spokes form a cross",
});
FT("stall", "prop", ["stall", "market", "khidmty"]);
FT("stall-red", "prop", ["stall", "awning", "market", "khidmty", "onyx"]);
FT("stall-green", "prop", ["stall", "awning", "market", "khidmty", "eyad"]);
FT("stall-bench", "prop", ["bench", "seat", "civicmind", "saleh"]);
FT("stall-stool", "prop", ["stool", "seat"], { lazy: true });
FT("hedge", "nature", ["hedge", "civicmind", "garden"]);
FT("hedge-large", "nature", ["hedge", "civicmind", "garden"]);
FT("hedge-curved", "nature", ["hedge", "civicmind", "garden"], { lazy: true });
FT("hedge-gate", "nature", ["hedge", "gate", "garden"], { lazy: true });
FT("banner-red", "prop", ["banner", "flag", "castle", "home"]);
FT("banner-green", "prop", ["banner", "flag", "castle", "home"]);
FT("fence", "prop", ["fence", "wood", "cottage"]);
FT("fence-gate", "prop", ["fence", "gate", "wood", "cottage"]);
FT("overhang", "prop", ["awning", "canopy", "market", "onyx"], { lazy: true });
FT("pillar-stone", "prop", ["pillar", "column", "plaza"], { lazy: true });
FT("rock-large", "nature", ["rock"], { name: "rock-town-large", lazy: true });
FT("tree", "nature", ["tree", "green", "round"], { name: "tree-town" });
FT("tree-high", "nature", ["tree", "green", "tall"], {
  name: "tree-town-high",
  lazy: true,
});
FT("tree-crooked", "nature", ["tree", "green"], {
  name: "tree-town-crooked",
  lazy: true,
});
FT("wheel", "prop", ["wheel", "cart"], {
  lazy: true,
  banned: "Wheel with four spokes forming a cross",
});
FT("windmill", "building", ["windmill"], {
  lazy: true,
  banned: "Windmill: its four blades form a cross",
});
FT("wall-wood-detail-cross", "building", ["wall"], {
  lazy: true,
  banned: "X-braced half-timber wall panel",
});

// ---- Kenney castle (scale 1.2) -------------------------------------------------------------------------------------
const CA = (file, kind, tags, opts = {}) =>
  kn("castle", file, kind, tags, opts);
CA("flag", "prop", ["flag", "castle"], { name: "flag-castle" });
CA("flag-pennant", "prop", ["flag", "pennant", "castle"]);
CA("flag-banner-long", "prop", ["banner", "castle", "home"]);
CA("flag-banner-short", "prop", ["banner", "castle"], { lazy: true });
CA("tower-square", "building", ["tower", "castle", "modular"], { lazy: true });
CA(
  "tower-square-top-roof-high-windows",
  "building",
  ["tower", "bell-tower", "roof", "modular", "civicmind"],
  {
    lazy: true,
  }
);
CA("tower-hexagon-base", "building", ["tower", "modular"], { lazy: true });
CA("tower-hexagon-roof", "building", ["tower", "roof", "modular"], {
  lazy: true,
});
CA("bridge-straight", "bridge", ["bridge", "stone", "castle"], {
  name: "bridge-castle-straight",
  lazy: true,
});

// ---- Kenney survival (scale 1.3) -----------------------------------------------------------------------------------
const SV = (file, kind, tags, opts = {}) =>
  kn("survival", file, kind, tags, opts);
SV("tree-autumn", "nature", ["tree", "autumn", "saleh"]);
SV("tree-autumn-tall", "nature", ["tree", "autumn", "saleh"]);
SV("tree-autumn-trunk", "nature", ["stump", "autumn"], { lazy: true });
SV("chest", "prop", ["chest", "treasure"], { lazy: true });
SV("workbench", "prop", ["workbench", "tools", "khidmty", "forge"]);
SV("workbench-anvil", "prop", ["anvil", "forge", "home", "khidmty"]);
SV("workbench-grind", "prop", ["grindstone", "tools", "khidmty"], {
  lazy: true,
});
SV("tool-hammer", "prop", ["tool", "hammer"], {
  lazy: true,
  banned: "T-shaped hammer head on a handle reads as a cross",
});
SV("tool-shovel", "prop", ["tool", "shovel", "khidmty"], { lazy: true });
SV("tool-pickaxe", "prop", ["tool", "pickaxe"], {
  lazy: true,
  banned: "Pickaxe head across the handle reads as a cross",
});
SV("tool-axe", "prop", ["tool", "axe", "khidmty"], { lazy: true });
SV("campfire-pit", "prop", ["campfire", "onyx"], { lazy: true });
SV("tent-canvas", "prop", ["tent", "canvas", "onyx"], { lazy: true });
SV("rock-sand-a", "nature", ["rock", "sand", "desert", "onyx"]);
SV("rock-sand-b", "nature", ["rock", "sand", "desert", "onyx"], { lazy: true });
SV("bucket", "prop", ["bucket"], { name: "bucket-wood", lazy: true });
SV("signpost-single", "prop", ["sign"], {
  lazy: true,
  banned: "Board across a post that sticks out above it: cross-shaped sign",
});

// ---- Kenney nature (scale 1.5) -------------------------------------------------------------------------------------
const NA = (file, kind, tags, opts = {}) =>
  kn("nature", file, kind, tags, opts);
const BLOSSOM = { leafsGreen: [1.0, 0.42, 0.6] }; // linear RGB: soft cherry-blossom pink
// Trees
NA("tree_oak", "nature", ["tree", "green", "oak"]);
NA("tree_default", "nature", ["tree", "green"]);
NA("tree_detailed", "nature", ["tree", "green"], { lazy: true });
NA("tree_fat", "nature", ["tree", "green"]);
NA("tree_oak_fall", "nature", ["tree", "autumn", "saleh"]);
NA("tree_default_fall", "nature", ["tree", "autumn", "saleh"]);
NA("tree_fat_fall", "nature", ["tree", "autumn", "saleh"]);
NA("tree_detailed_fall", "nature", ["tree", "autumn", "saleh"], { lazy: true });
NA("tree_oak", "nature", ["tree", "blossom", "spring", "pink", "eyad"], {
  name: "tree-oak-blossom",
  recolor: BLOSSOM,
});
NA("tree_default", "nature", ["tree", "blossom", "spring", "pink", "eyad"], {
  name: "tree-default-blossom",
  recolor: BLOSSOM,
});
NA("tree_fat", "nature", ["tree", "blossom", "spring", "pink", "eyad"], {
  name: "tree-fat-blossom",
  recolor: BLOSSOM,
});
NA("tree_pineRoundA", "nature", ["tree", "pine", "green"], { lazy: true });
NA("tree_palm", "nature", ["tree", "palm", "desert", "onyx"]);
NA("tree_palmTall", "nature", ["tree", "palm", "desert", "onyx"]);
NA("tree_palmBend", "nature", ["tree", "palm", "desert", "onyx"]);
NA("tree_palmShort", "nature", ["tree", "palm", "desert", "onyx"], {
  lazy: true,
});
// Bushes, flowers, grass
NA("plant_bush", "nature", ["bush"]);
NA("plant_bushLarge", "nature", ["bush"]);
NA("plant_bushDetailed", "nature", ["bush"], { lazy: true });
NA("plant_bushSmall", "nature", ["bush"], { solid: false });
for (const c of ["red", "yellow", "purple"]) {
  NA(`flower_${c}A`, "nature", ["flower", c, "garden", "eyad"], {
    solid: false,
  });
  NA(`flower_${c}B`, "nature", ["flower", c, "garden", "eyad"], {
    solid: false,
    lazy: c === "purple",
  });
}
NA("grass", "nature", ["grass", "tuft"], { name: "grass-tuft", solid: false });
NA("grass_large", "nature", ["grass", "tuft"], {
  name: "grass-tuft-large",
  solid: false,
});
NA("grass_leafs", "nature", ["grass", "tuft", "leaves"], {
  name: "grass-leafs",
  solid: false,
  lazy: true,
});
NA("crops_dirtRow", "nature", ["flower-bed", "garden", "crops"], {
  solid: false,
});
NA("crops_dirtDoubleRow", "nature", ["flower-bed", "garden", "crops"], {
  solid: false,
  lazy: true,
});
NA("crop_pumpkin", "nature", ["pumpkin", "autumn", "saleh"]);
NA("crop_melon", "nature", ["melon", "garden"], { lazy: true });
NA("cactus_short", "nature", ["cactus", "desert", "onyx"]);
NA("cactus_tall", "nature", ["cactus", "desert", "onyx"]);
NA("mushroom_redGroup", "nature", ["mushroom", "autumn"], { solid: false });
NA("lily_large", "nature", ["lily", "pond", "eyad"], { solid: false });
NA("hanging_moss", "nature", ["moss", "roots", "underside"], { solid: false });
// Rocks, logs
NA("rock_largeA", "nature", ["rock"]);
NA("rock_largeB", "nature", ["rock"], { lazy: true });
NA("rock_smallA", "nature", ["rock"]);
NA("rock_smallC", "nature", ["rock"]);
NA("rock_tallA", "nature", ["rock", "tall"], { lazy: true });
NA("stump_round", "nature", ["stump", "log"]);
NA("log_stack", "nature", ["log", "firewood", "home"]);
// Props: statues, pots, bridges, paths, tents
NA("statue_column", "prop", ["statue", "column", "plaza", "saleh"]);
NA("statue_obelisk", "prop", ["statue", "obelisk", "plaza", "home"]);
NA("statue_head", "prop", ["statue", "bust", "saleh", "gallery"]);
NA("statue_ring", "prop", ["statue", "sculpture", "saleh", "gallery"]);
NA("statue_block", "prop", ["statue", "plinth"], { lazy: true });
NA("pot_large", "prop", ["pot", "clay", "onyx"]);
NA("pot_small", "prop", ["pot", "clay", "onyx"]);
NA("sign", "prop", ["sign"], {
  lazy: true,
  banned: "Board across a post that sticks out above it: cross-shaped sign",
});
NA("bridge_wood", "bridge", ["bridge", "wood", "small", "eyad"]);
NA("bridge_woodRound", "bridge", ["bridge", "wood", "arched", "small", "eyad"]);
NA("bridge_stoneRound", "bridge", ["bridge", "stone", "arched", "small"]);
NA("path_stone", "terrain", ["path", "stepping-stones"], {
  solid: false,
  extra: { walkable: true, overlay: true },
});
NA("path_stoneCircle", "terrain", ["path", "plaza", "stone"], {
  solid: false,
  extra: { walkable: true, overlay: true },
});
NA("tent_detailedOpen", "prop", ["tent", "awning", "bazaar", "onyx"]);
NA("tent_smallOpen", "prop", ["tent", "awning", "bazaar", "onyx"], {
  lazy: true,
});
NA("cliff_waterfall_rock", "nature", ["waterfall", "cliff"], { lazy: true });
NA("campfire_stones", "prop", ["campfire"], { lazy: true });
NA("fence_simple", "prop", ["fence", "wood"], {
  name: "fence-simple",
  lazy: true,
});
NA("fence_planks", "prop", ["fence", "wood"], {
  name: "fence-planks",
  lazy: true,
  banned: "Rails run past the posts, so every post/rail joint is a small cross",
});

// ---- Characters ----------------------------------------------------------------------------------------------------
const ADVENTURERS = [
  { file: "Knight", name: "character-knight", tags: ["knight", "armour"] },
  { file: "Barbarian", name: "character-barbarian", tags: ["barbarian"] },
  { file: "Mage", name: "character-mage", tags: ["mage", "wizard"] },
  { file: "Rogue", name: "character-rogue", tags: ["rogue"] },
  {
    file: "Rogue_Hooded",
    name: "character-rogue-hooded",
    tags: ["rogue", "hood"],
  },
  // bare-headed variants for more picker / mayor variety
  {
    file: "Knight",
    name: "character-knight-bare",
    tags: ["knight", "bare-head"],
    hat: "Knight_Helmet",
  },
  {
    file: "Barbarian",
    name: "character-barbarian-bare",
    tags: ["barbarian", "bare-head"],
    hat: "Barbarian_Hat",
  },
  {
    file: "Mage",
    name: "character-mage-bare",
    tags: ["mage", "bare-head"],
    hat: "Mage_Hat",
  },
];
for (const a of ADVENTURERS) {
  add({
    name: a.name,
    src: `${KA}/${a.file}.glb`,
    source: "kaykit-adventurers",
    pack: "character",
    kind: "character",
    tags: ["adventurer", "player", "mayor", ...a.tags],
    strip: a.hat
      ? new RegExp(`${KAYKIT_WEAPONS.source}|^${a.hat}$`)
      : KAYKIT_WEAPONS,
    stripNote: `All hand-held items removed (swords with crossguards, axes, shields, crossbows, knives, wands, books, mug)${
      a.hat ? `; ${a.hat} removed` : ""
    }`,
    clips: KAYKIT_CLIPS,
  });
}
for (const g of ["male", "female"]) {
  for (const l of "abcdef") {
    add({
      name: `character-mini-${g}-${l}`,
      src: `${KN}/mini-characters/character-${g}-${l}.glb`,
      source: "kenney-mini-characters",
      pack: "character",
      kind: "character",
      tags: ["mini", "villager", "mayor", g],
      lazy: true,
      clips: KENNEY_MINI_CLIPS,
    });
  }
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Pipeline                                                                                                            */
/* ------------------------------------------------------------------------------------------------------------------ */

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;

function stripNodes(doc, re) {
  const removed = [];
  for (const node of doc.getRoot().listNodes()) {
    if (re.test(node.getName()) && node.getMesh() && !node.getSkin()) {
      removed.push(node.getName());
      for (const child of node.listChildren()) child.dispose();
      node.dispose();
    }
  }
  return removed;
}

function filterAnimations(doc, keep) {
  const root = doc.getRoot();
  const kept = [];
  for (const anim of root.listAnimations()) {
    if (!keep.includes(anim.getName())) {
      disposeAnimation(anim);
      continue;
    }
    for (const ch of anim.listChannels()) {
      if (!ch.getTargetNode()) {
        ch.getSampler()?.dispose();
        ch.dispose();
      }
    }
    kept.push(anim.getName());
  }
  // Keep the order given in `keep`.
  return keep.filter((k) => kept.includes(k));
}

/**
 * Drops animation channels that hold a bone at its rest value for the whole clip (most scale tracks, many translation
 * tracks). three's AnimationMixer blends un-animated bindings back to the rest pose, so this is lossless, and it
 * shrinks the glTF JSON (two accessors per channel) a lot.
 */
function dropRestChannels(doc) {
  const EPS = 1e-4;
  let dropped = 0;
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode();
      const sampler = ch.getSampler();
      const out = sampler?.getOutput()?.getArray();
      if (!node || !out) continue;
      const pathName = ch.getTargetPath();
      const rest =
        pathName === "translation"
          ? node.getTranslation()
          : pathName === "rotation"
            ? node.getRotation()
            : pathName === "scale"
              ? node.getScale()
              : null;
      if (!rest) continue;
      const n = rest.length;
      let same = true;
      for (let i = 0; i < out.length && same; i++) {
        if (Math.abs(out[i] - rest[i % n]) > EPS) same = false;
      }
      if (same) {
        sampler.dispose();
        ch.dispose();
        dropped++;
      }
    }
  }
  return dropped;
}

/**
 * Drops channels on helper joints (IK targets, foot-roll controls, hand slots) that no vertex is weighted to and that
 * are not an ancestor of a weighted joint: the baked clips already carry their effect on the deform bones.
 */
function dropHelperJointChannels(doc) {
  const deform = new Set();
  for (const node of doc.getRoot().listNodes()) {
    const skin = node.getSkin();
    const mesh = node.getMesh();
    if (!skin || !mesh) continue;
    const joints = skin.listJoints();
    for (const prim of mesh.listPrimitives()) {
      const J = prim.getAttribute("JOINTS_0");
      const W = prim.getAttribute("WEIGHTS_0");
      if (!J || !W) continue;
      const j = [];
      const w = [];
      for (let i = 0; i < J.getCount(); i++) {
        J.getElement(i, j);
        W.getElement(i, w);
        for (let k = 0; k < j.length; k++)
          if ((w[k] ?? 0) > 1e-3) deform.add(joints[j[k] ?? 0]);
      }
    }
  }
  // Keep every ancestor of a deform joint too.
  const keep = new Set();
  for (const joint of deform) {
    for (let n = joint; n; n = n.getParentNode()) keep.add(n);
  }
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode();
      if (node && !keep.has(node)) {
        ch.getSampler()?.dispose();
        ch.dispose();
      }
    }
  }
}

/**
 * Stores rotation keyframes as normalized int16 quaternions (core glTF 2.0 allows it; three's GLTFLoader decodes
 * normalized sampler outputs), halving the largest part of the animation data.
 */
function quantizeRotations(doc) {
  const done = new Set();
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      if (ch.getTargetPath() !== "rotation") continue;
      const acc = ch.getSampler()?.getOutput();
      const src = acc?.getArray();
      if (!acc || !(src instanceof Float32Array) || done.has(acc)) continue;
      const dst = new Int16Array(src.length);
      for (let i = 0; i < src.length; i++)
        dst[i] = Math.round(Math.max(-1, Math.min(1, src[i] ?? 0)) * 32767);
      acc.setArray(dst).setNormalized(true);
      done.add(acc);
    }
  }
}

/** Disposing an Animation leaves its samplers alive (and their accessors look referenced to prune()). */
function disposeAnimation(anim) {
  for (const sampler of anim.listSamplers()) sampler.dispose();
  for (const channel of anim.listChannels()) channel.dispose();
  anim.dispose();
}

/**
 * Downsizes textures to MAX_TEXTURE px with nearest-neighbour sampling (the packs use flat colour-swatch atlases, so
 * nearest keeps every swatch crisp) and re-encodes them as palette PNGs, which keeps a 512 px atlas around 10 KB.
 * Textures already within the limit are left byte-for-byte untouched.
 */
async function resizeTextures(doc) {
  for (const tex of doc.getRoot().listTextures()) {
    const image = tex.getImage();
    if (!image) continue;
    const meta = await sharp(image).metadata();
    if ((meta.width ?? 0) <= MAX_TEXTURE && (meta.height ?? 0) <= MAX_TEXTURE)
      continue;
    const out = await sharp(image)
      .resize(MAX_TEXTURE, MAX_TEXTURE, { fit: "inside", kernel: "nearest" })
      .png({ palette: true, compressionLevel: 9, effort: 10 })
      .toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType("image/png");
  }
}

/**
 * Matte, non-metallic materials everywhere: Kenney Nature leaves metallicFactor at the glTF default (1), which renders
 * black without an environment map, and the packs mix roughness 0.5 and 1. One look for every pack.
 */
function normaliseMaterials(doc) {
  for (const mat of doc.getRoot().listMaterials()) {
    if (!mat.getMetallicRoughnessTexture()) mat.setMetallicFactor(0);
    mat.setRoughnessFactor(Math.max(mat.getRoughnessFactor(), 0.85));
  }
}

function recolor(doc, map) {
  for (const mat of doc.getRoot().listMaterials()) {
    const rgb = map[mat.getName()];
    if (rgb) mat.setBaseColorFactor([rgb[0], rgb[1], rgb[2], 1]);
  }
}

function footprint(entry, size) {
  const metres = {
    footprint: [round(size[0], 2), round(size[2], 2)],
    footprintUnit: "m",
  };
  const hexAuthored =
    entry.pack === "kaykit-hexagon-tile" || entry.pack === "kaykit-hexagon";
  if (entry.kind === "terrain") {
    return entry.pack === "kaykit-hexagon-tile"
      ? { footprint: [1, 1], footprintUnit: "hex" }
      : metres;
  }
  if ((entry.kind === "building" || entry.kind === "bridge") && hexAuthored) {
    // Whole hex cells covered (rounded): a KayKit cottage is 1x1, the castle 2x2.
    const cells = (d) => Math.max(1, Math.round(d / HEX_SIZE));
    return {
      footprint: [cells(size[0]), cells(size[2])],
      footprintUnit: "hex",
    };
  }
  return metres;
}

async function main() {
  const args = process.argv.slice(2);
  const sourceDir = path.resolve(
    args.find((a) => !a.startsWith("--")) ?? DEFAULT_SOURCE
  );
  const only = args
    .find((a) => a.startsWith("--only="))
    ?.slice(7)
    .split(",");
  const manifestOnly = args.includes("--manifest-only");

  const names = new Set();
  for (const e of SELECTION) {
    if (names.has(e.name)) throw new Error(`duplicate model name ${e.name}`);
    names.add(e.name);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const manifestPath = path.join(OUT_DIR, "manifest.json");
  /** @type {Record<string, any>} */
  let previous = {};
  try {
    previous = JSON.parse(await fs.readFile(manifestPath, "utf8")).models ?? {};
  } catch {
    previous = {};
  }

  const models = {};
  let hexSize = HEX_SIZE;
  for (const e of SELECTION) {
    const file = `${e.name}.glb`;
    const out = path.join(OUT_DIR, file);
    const skip = manifestOnly || (only && !only.includes(e.name));
    if (skip && previous[e.name]) {
      models[e.name] = previous[e.name];
      continue;
    }
    const doc = await io.read(path.join(sourceDir, e.src));
    const stripped = e.strip ? stripNodes(doc, e.strip) : [];
    const clips = e.clips ? filterAnimations(doc, e.clips) : undefined;
    if (!e.clips)
      for (const a of doc.getRoot().listAnimations()) disposeAnimation(a);
    normaliseMaterials(doc);
    if (e.recolor) recolor(doc, e.recolor);

    const scene =
      doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    const b = getBounds(scene);
    const native = [0, 1, 2].map((i) => b.max[i] - b.min[i]);

    let scale = e.scale ?? PACK_SCALE[e.pack];
    if (e.kind === "character") scale = CHARACTER_HEIGHT / native[1];
    if (scale === undefined) throw new Error(`no scale for ${e.name}`);
    if (e.name === "hex-grass") hexSize = round(native[0], 3);

    await doc.transform(
      dedup(),
      prune({ keepLeaves: false }),
      weld(),
      ...(clips ? [resample({ tolerance: 5e-4 })] : []),
      quantize(),
      prune()
    );
    if (clips) {
      dropRestChannels(doc);
      dropHelperJointChannels(doc);
      quantizeRotations(doc);
      await doc.transform(prune());
    }
    await resizeTextures(doc);
    await io.write(out, doc);
    const bytes = (await fs.stat(out)).size;

    const size = native.map((v) => round(v * scale));
    const solidDefault = !["terrain"].includes(e.kind);
    const entry = {
      file,
      source: e.source,
      license: LICENSES[e.source],
      kind: e.kind,
      ...footprint(e, size),
      height: round(native[1] * scale),
      scale: round(scale, 4),
      size,
      minY: round(b.min[1] * scale),
      tags: e.tags,
      ...(clips ? { animations: clips } : {}),
      solid: e.solid ?? solidDefault,
      lazy: Boolean(e.lazy || e.banned),
      bytes,
      ...(e.extra ?? {}),
      ...(stripped.length ? { stripped, notes: e.stripNote } : {}),
      ...(e.recolor
        ? {
            notes: `Recoloured from ${path.basename(e.src)} (${Object.keys(e.recolor).join(", ")})`,
          }
        : {}),
      banned: Boolean(e.banned),
      reason: e.banned ?? "",
    };
    models[e.name] = entry;
    console.log(
      `${e.banned ? "BANNED " : ""}${e.name.padEnd(36)} ${(bytes / 1024).toFixed(1).padStart(7)} KB  scale ${entry.scale}  size ${size.join(" x ")}${stripped.length ? `  stripped ${stripped.length}` : ""}`
    );
  }

  const firstLoad = Object.values(models)
    .filter((m) => !m.lazy && !m.banned)
    .reduce((s, m) => s + m.bytes, 0);
  const total = Object.values(models).reduce((s, m) => s + m.bytes, 0);
  const manifest = {
    version: 1,
    unit: "metre",
    worldUnit:
      "1 unit = 1 KayKit Medieval Hexagon native unit. Hex tiles are pointy-top (corners on +-Z), hexSize across the flats (X), tile top at y=0. Characters are 0.9 tall (0.45 x hexSize); a 1-hex KayKit cottage is about 2x a person.",
    hexSize,
    hexCornerToCorner: round((hexSize * 2) / Math.sqrt(3)),
    hexEdge: round(hexSize / Math.sqrt(3)),
    tileThickness: 1,
    levelHeight: 0.5,
    characterHeight: CHARACTER_HEIGHT,
    licenses: {
      "kaykit-adventurers":
        "CC0 1.0 (KayKit : Adventurers Character Pack 1.0, Kay Lousberg, LICENSE.txt)",
      "kaykit-hexagon":
        "CC0 1.0 (KayKit : Medieval Hexagon Pack 1.0, Kay Lousberg, LICENSE.txt)",
      kenney:
        "CC0 1.0 (Kenney castle, fantasy-town, nature, survival, mini-characters; www.kenney.nl, LICENSE.txt)",
    },
    firstLoadBytes: firstLoad,
    totalBytes: total,
    models,
  };
  // Format with the repo's prettier so `prettier --check` stays green after a re-run.
  const prettier = await import("prettier");
  const json = await prettier.format(JSON.stringify(manifest), {
    ...(await prettier.resolveConfig(manifestPath)),
    filepath: manifestPath,
  });
  await fs.writeFile(manifestPath, json);
  console.log(
    `\n${Object.keys(models).length} models, first load ${(firstLoad / 1048576).toFixed(2)} MB, total ${(total / 1048576).toFixed(2)} MB, hexSize ${hexSize}`
  );
}

await main();
