# Illustrated islands — art spec (contract for engine + pipeline)

Direction (user decision 2026-10-17): every island is ONE AI-painted pixel-art image in the style of the
reference (detailed 3/4 top-down: front walls + roofs visible, cliff underside, vines, waterfalls,
sunset sky). Free/CC0 only; the user generates the art with Gemini. Characters stay MetroCity 16x32.

## Files per island

```
public/game/islands/<islandId>/island.webp     # processed art, transparent background, native pixel size
public/game/islands/<islandId>/island.json     # metadata below (authored with the in-game editor)
public/game/bridges/{rope,stone}.webp          # tileable bridge strip, 16px tall segment, repeats along length
public/game/sky/{far,mid,near}.webp            # parallax sky layers (far = gradient+sun, mid/near = clouds)
```

## island.json (all coordinates in the processed image's native pixels, origin top-left)

```ts
type IslandArt = {
  version: 1;
  size: { w: number; h: number }; // native image size
  walkable: Array<Array<[number, number]>>; // polygons the player's FEET may be inside (top surface + streets)
  blockers: Array<Array<[number, number]>>; // polygons inside walkable that block (building bodies, trees, fountain)
  occluders: Array<{ id: string; rect: [x, y, w, h]; baseY: number }>; // regions drawn ABOVE the player when player.y < baseY (roofs, tree crowns) — gives depth
  doors: Array<{ buildingId: string; at: [number, number]; radius: number }>; // ids match lib/content/world.ts buildings
  spawns: { player?: [number, number]; mayor?: [number, number] };
  anchors: Array<{ id: string; at: [number, number] }>; // bridge attach points on the island edge, e.g. "to_khidmty"
};
```

- Player depth: sprites sorted by feet Y; occluders re-draw roof/canopy slices over the player when behind.
- World placement: island centre at `ISLANDS[].at` (tiles) → world px; bridges connect matching anchors of two islands.

## Pipeline (`npm run art:island -- <islandId> <source.jpg|png>`)

1. Chroma key: source is painted on flat **magenta #FF00FF**; remove it (tolerance + 1px despill), keep alpha binary (pixel art: alpha 0 or 255).
2. Detect the pixel scale (2–8): find the largest N where the image is (near-)constant in N×N blocks; downscale by N with nearest-neighbour.
3. Quantize to ≤ 64 colours (shared palette across islands optional: `art/palette.png`).
4. Trim transparent margins, write `island.webp` (lossless) and, if missing, a starter `island.json` with `size` and a walkable polygon auto-traced from the alpha mask's top region (user refines in the editor).
5. Report: native size, scale found, colours, file size. Budget: ≤ 300 KB per island.

## In-game editor (`/[lang]/play?edit=1`, dev builds only — tree-shaken out of production)

Click to add polygon points (walkable / blocker), drag points, place doors (pick buildingId), spawns, anchors,
occluder rects; toggle overlays; "Export" copies/downloads island.json. Shows the player for live testing.

## Gemini prompts (user runs these; keep the STYLE block identical every time)

STYLE: "Detailed 16-bit pixel art, 3/4 top-down view like a classic JRPG, crisp hard pixel edges, no anti-aliasing,
no blur, limited warm palette, sunset lighting from the left. A single floating sky island seen slightly from above:
grassy top surface with paths, rocky cliff underside tapering down with hanging roots and vines.
Centered, the whole island fully visible with margin, on a perfectly flat solid magenta (#FF00FF) background,
no sky, no clouds, no other islands, no text, no characters."

Per island (append to STYLE):

- home: "A grand stone castle with towers, colourful banners and a town square; around it small labelled-sign-ready
  buildings: a school/academy (education), a guild hall (experience), a workshop/forge (tech stack), a garden
  pavilion (hobbies), a family cottage, and a notice board near the plaza. Two waterfalls pour off the edge."
- khidmty (services marketplace): "A busy market town with stalls, awnings and a large guild-style service hall."
- civicmind (municipal AI): "A clean civic district with a town hall with a clock tower and glowing crystal lamps."
- onyx (e-commerce fashion): "An elegant desert bazaar island with a black-and-gold boutique palace."
- saleh / eyad (designer portfolios): "An artist's island with a gallery building, easels and a windmill" (vary: autumn trees vs. spring blossoms).
- bridges: "A straight horizontal wooden rope bridge segment, side view slightly from above, seamless tileable
  left-right, on flat magenta background" (and a stone-arch variant).
  Characters are 16x32 px: ask for doors roughly 3x the height of a small person so scale matches after downscale.

## Making an island (step-by-step)

1. **Generate the raw image**:
   Use Gemini (or another generator) with the `STYLE` prompt + island prompt on a solid `#FF00FF` magenta background.
   Doors and people in the prompt should be roughly 3x the height of a small person. Save the result (e.g. `~/Downloads/islands/home.jpeg`).

2. **Process the island through the pipeline**:
   The primary/recommended flow uses an explicit `--width <px>` (box downscale, binary alpha, despill, 64-color median-cut quantization, and trim). Choose `--width` so doors/characters land around 30 px tall (matching our 16x32 player sprite). For the 1792x2400 home island, `--width 896` yields ~801x1134 trimmed:

   ```bash
   npm run art:island -- home ~/Downloads/islands/home.jpeg --width 896 --report-scale
   ```

   Additional options:
   - `--report-scale`: Displays source vs. final size, scale factor, and doorway percentage sanity check.
   - `--scale <N>`: Forces an integer nearest-neighbour downscale (e.g. `--scale 2` or `--scale 4`).
   - `--fuzz <percent>`: Adjusts chroma-key tolerance (default: 18%).
   - Auto-detection (omit `--width` and `--scale`): attempts 2x-8x integer grid scale detection (best for true pixel-art grids).

   Outputs:
   - `public/game/islands/<islandId>/island.webp` (lossless, <= 64 colors, <= 300 KB)
   - `public/game/islands/<islandId>/island.json` (starter metadata if not already present)

3. **Author metadata in the in-game editor**:
   Launch the dev server and open `http://localhost:3000/en/play?edit=1` to trace walkable areas, blockers, door interaction zones, spawns, anchors, and occluders, then export the updated `island.json`.
