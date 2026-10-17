/**
 * Registry of the 3D islands (content/islands3d/<id>.json). Add each new island here.
 * The world layout (centre, baseY) lives in the JSON files; the bridges come from
 * BRIDGES in lib/content/world.ts and attach to anchors named `to_<otherIslandId>`.
 */

import { parseIsland3D } from "@/components/game3d/logic/validate-island";
import type { Island3D } from "@/components/game3d/logic/types";
import home from "./home.json";
import khidmty from "./khidmty.json";
import saleh from "./saleh.json";
import eyad from "./eyad.json";
import civicmind from "./civicmind.json";
import onyx from "./onyx.json";

export const ISLANDS_3D: readonly Island3D[] = [
  parseIsland3D(home, "home.json"),
  parseIsland3D(khidmty, "khidmty.json"),
  parseIsland3D(saleh, "saleh.json"),
  parseIsland3D(eyad, "eyad.json"),
  parseIsland3D(civicmind, "civicmind.json"),
  parseIsland3D(onyx, "onyx.json"),
];
