# Living world — material maps + effects (contract)

User direction (2026-10-17): "like the ones I see in games, where the grass moves, there are moving birds,
the roads are real, the player can't go beyond the edge, the water moves, the clouds move also."
We keep the user's painted islands and make them alive via a per-pixel MATERIAL MAP.

## Files per island (added to ISLAND_ART_SPEC.md layout)

```
public/game/islands/<id>/island.webp      # painted art (pipeline output)
public/game/islands/<id>/material.png     # 8-bit, SAME size as island.webp, one class per pixel (palette below)
public/game/islands/<id>/island.json      # doors, spawns, anchors (+ optional overrides); polygons now OPTIONAL
```

## Material classes (exact RGB in material.png → class)

| class                                                                                                             | RGB         | walk | notes                                                                               |
| ----------------------------------------------------------------------------------------------------------------- | ----------- | ---- | ----------------------------------------------------------------------------------- |
| void                                                                                                              | 255,0,255   | no   | outside the island (transparent in art)                                             |
| road                                                                                                              | 255,255,255 | yes  | dirt/cobble paths, plazas, stairs, bridge decks                                     |
| grass                                                                                                             | 0,200,0     | yes  | walkable ground; grass tufts spawn here                                             |
| solid                                                                                                             | 255,0,0     | no   | building walls, fences, stone walls, statues, rocks, trunks                         |
| roof                                                                                                              | 255,128,0   | no*  | roofs/upper building parts: not walkable, drawn ABOVE player when behind (occluder) |
| canopy                                                                                                            | 0,80,0      | yes† | tree crowns/bushes tops: sway shader; drawn above player when behind                |
| water                                                                                                             | 0,0,255     | no   | waterfalls, streams, pools: flow/ripple shader                                      |
| cliff                                                                                                             | 128,64,0    | no   | island edge/underside: hard boundary                                                |
| cloth                                                                                                             | 255,255,0   | no   | banners/flags/awnings: flutter shader                                               |
| fire                                                                                                              | 255,0,128   | no   | forge fire, lamps: flicker + glow                                                   |
| \* roof/canopy pixels are overhead; collision uses the ground beneath: a footprint is `solid` if the column below |
| contains solid before reaching walkable ground. † canopy is walkable _under_ (player passes behind/below it).     |

Tolerance: map each pixel to the nearest palette colour (AI maps are noisy); then morphological open/close
(1–2 px) per class; remove specks < 6 px.

## Collision

- Player feet = 10x4 px box at sprite bottom. Move allowed if every sample point in the box is road|grass|canopy.
- Axis-separated movement with sliding; never let the player leave walkable pixels (edge = cliff/void → blocked).
- Precompute a walk grid at 2 px resolution (Uint8Array) at load; ~ (801/2)*(1133/2) ≈ 227k cells, fine.

## Depth / occlusion (automatic)

- Connected components of roof ∪ solid ∪ canopy above the ground → "objects". Each object's baseY = lowest
  solid/trunk pixel row of the component (or its bottom row). At load, cut each object into its own texture
  (from island.webp using the component mask) and draw it as a sprite at depth = baseY.
- Player depth = feet Y. So the player is behind a building when feet Y < baseY, in front otherwise — correct
  y-sorting without hand-made occluders.

## Effects (all respect prefers-reduced-motion → static)

- water: UV-scroll shader masked to water pixels (waterfalls flow down, pools ripple), plus spray particles at
  waterfall bottoms.
- canopy: wind sway — sine displacement shader masked to canopy, amplitude 0–1 px, phase by x, gusts.
- grass: small animated 2–3 frame pixel tufts (procedurally generated texture) scattered on grass at low density,
  swaying; parted when the player walks through (optional).
- cloth: flutter shader masked to cloth.
- fire: flicker (brightness + 1px jitter) + additive glow; chimney smoke particles from roof tops near chimneys
  (positions from island.json `emitters`).
- birds: procedural 2-frame pixel birds, flocks of 3–7 crossing the sky with gentle sine paths, some perch on roofs.
- clouds: sky.webp (wide backdrop, slow parallax) + 2–3 generated cloud layers (front ones pass IN FRONT of
  islands at low opacity).
- performance: one combined shader pass per island if possible; budget 60 fps on mid phones; disable heavy FX
  on low-end (devicePixelRatio/FPS sampler).

## How material maps are made

1. Preferred: AI segmentation via Gemini image edit of the user's own island image (prompt in docs), then
   `npm run art:material -- <id> <seg.jpeg>` → resized with nearest to island.webp size, snapped to palette, cleaned.
2. Fallback: `npm run art:material -- <id> --auto` → colour/texture heuristics from island.webp (blue→water,
   green high-sat→grass, dark green blobs→canopy, light tan+low texture→road, alpha edge band→cliff, rest→solid).
3. Editor (`?edit=1`) gets a BRUSH: paint classes onto the material map (sizes 1–16 px), fill, undo, export png.
