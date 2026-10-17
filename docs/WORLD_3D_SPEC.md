# 3D sky-islands world (contract)

User decisions (2026-10-17): rebuild /[lang]/play in **Three.js** as a **stylized low-poly 3D** world, like Townscaper
or Islanders: toy-like floating islands, soft light, real depth. The camera **follows the player with a limited orbit**,
and the player characters are **3D, animated and CC0**. The Phaser engine (components/game/engine) stays in the repo
until the 3D world fully replaces it (reachable with `?engine=2d` meanwhile), then it gets deleted.

HARD RULES

- CC0 assets only: KayKit Adventurers and Medieval Hexagon, Kenney 3D kits (castle, fantasy-town, nature, survival,
  mini-characters), and our own procedural meshes.
- **No cross symbols anywhere**: no church crosses, cross gravestones, crossed swords/beams, windmills (four blades form
  a cross), X-braced crates or doors, or crossguard swords visible on characters (hide or remove weapon meshes).
  Banned models are listed in the manifest, and the loaders refuse them.
- Performance: a mid-range phone at 60 fps (30 is acceptable) and a desktop at 60. Total models under ~8 MB
  compressed for the first load; lazy-load the rest. The route stays lazy (next/dynamic, ssr:false).
- Respect prefers-reduced-motion (static water and clouds, no camera sway). Keyboard, mouse and touch all work.

Stack: three 0.186.1, @react-three/fiber 9.8.1, @react-three/drei 10.7.9 (installed). No physics engine: walking uses
per-island walk grids (below). Dev tooling: @gltf-transform/cli 4.5.1.

## Folders

- components/game3d/ the R3F world (scene, systems, entities, ui bridge)
- public/game3d/models/ curated, optimised .glb files (flat folder, kebab-case names)
- public/game3d/models/manifest.json the asset catalogue (below)
- content/islands3d/<id>.json island definitions (below)
- scripts/3d/ asset pipeline scripts (curation, optimisation, previews)

## Asset manifest (public/game3d/models/manifest.json)

{
"version": 1,
"unit": "metre", // 1 hex = 1 unit across flats? see hex section; the characters are about 1.0-1.2 tall at scale 1
"models": {
"<name>": {
"file": "<name>.glb", "source": "kaykit-hexagon|kaykit-adventurers|kenney-castle|...", "license": "CC0",
"kind": "terrain|building|nature|prop|character|bridge",
"footprint": [w, d], // in hex-grid cells (or metres for props); used for collision
"height": h, "scale": s, // the scale to apply so it matches the world unit
"tags": ["medieval", "tree", ...],
"animations": ["Idle", "Walking_A", ...], // characters only
"banned": false, "reason": ""
}
}
}

## World units and the hex grid

- Islands are built on a **pointy-top hex grid** using the KayKit Medieval Hexagon terrain tiles. 1 hex = the tile's
  native size (measure it from the glb and write it into the manifest as "hexSize"). Characters are scaled so a
  person is about 0.45x the hex width (a building of 1 hex reads as a cottage).
- Axial coordinates (q, r); a world position comes from the standard pointy-top formula.

## Island definition (content/islands3d/<id>.json)

{
"id": "home",
"center": [x, z], // world placement (metres); the world layout lives here, not in lib/content/world.ts
"baseY": 0, // islands may float at different heights
"hexes": [ { "q": 0, "r": 0, "tile": "hex-grass", "h": 0, "rot": 0 }, ... ], // h = stacked height level (0..3)
"objects": [ { "model": "building-castle", "q": 1, "r": -2, "rot": 60, "scale": 1, "offset": [dx, dz] } ],
"doors": [ { "buildingId": "building_education", "q": .., "r": .., "radius": 0.9 } ], // ids from lib/content/world.ts
"spawns": { "player": { "q": .., "r": .. }, "mayor": { "q": .., "r": .. } },
"anchors": [ { "id": "to_khidmty", "q": .., "r": .. } ], // edge hexes where the bridges attach
"underside": { "depth": 6, "style": "rock" | "sand", "seed": 1, "waterfalls": [ { "q": .., "r": .. } ] }
}

## Walking

- Each island derives a walk grid from its hexes: walkable tiles (grass, path, sand, bridge, stone) minus object
  footprints (buildings, trees, rocks, props marked solid). Height steps of 1 level are walkable (ramps/stairs tiles);
  2+ are not. Water and void are not walkable.
- The player moves in continuous space with a circle collider (radius ~0.25 hex) against the walk grid
  (slide along edges). The player's Y follows the terrain height.
- Bridges are generated plank/rope or stone meshes between two anchors, with a walkable corridor.
- The pure walk logic (hex math, walk grid, collision, BFS reachability) lives in Phaser-free, Three-free TS modules
  with vitest tests, so a reachability test can check every island (player spawn to every door, mayor and anchor).

## Interactions (reuse the existing UI)

- Emit the SAME events on components/game/engine/events.ts `gameEvents`: "interact:building" { buildingId } and
  "interact:npc" {...}, and honour "game:freeze" / ui locks, so the existing React overlays (building panels,
  dialogue box, character picker, zoom controls) work unchanged.
- In range of a door or NPC: a world-space prompt (drei Html or a sprite) showing "E" + the localised sign text
  (dict.world.buildings[id].sign) or "Talk"; E, Space or a tap opens it. Nothing auto-opens.
- Mayors: animated KayKit characters standing at spawns.mayor, idling, turning to face the player in range.

## Look

- Sky: a gradient sky dome (sunset palette like the current site), a sun as the directional light with soft shadows
  (PCFSoft, a tight shadow camera that follows the player), hemisphere fill light, gentle fog for depth.
- Water: animated shader (vertex wave plus foam at the edges) for ponds; waterfalls as scrolling-texture ribbons with
  mist particles at the bottom.
- Islands: KayKit hex tiles on top; a generated low-poly flat-shaded rock underside (an inverted cone with noise,
  2-3 colour bands, and hanging roots), slow bobbing (respecting reduced motion).
- Life: low-poly clouds drifting (some below the islands), bird flocks, wind sway on tree crowns via a shader patch,
  chimney smoke.
- Post: subtle (SMAA or FXAA; optional bloom on lamps). Keep it cheap.

## Camera and controls

- Follow camera: behind and above the player (~45 degrees pitch), smooth damping. Orbit yaw is limited to about ±60
  degrees around the default heading and pitch to 30-65 degrees; wheel/pinch zoom within limits.
- Movement: WASD/arrows (camera-relative), a virtual joystick on touch, click/tap-to-move on walkable ground.
- The existing zoom +/- UI buttons drive the camera zoom through the same gameEvents ("camera:zoom-in/out/set-zoom").
