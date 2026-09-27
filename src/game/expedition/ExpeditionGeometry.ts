import { enclosure } from "./ExpeditionInteriors";
import { stationRoutes, stationLedges, stationBlocks } from "./PumpStationLayout";
import type { Rect } from "../../engine/PhysicsHelpers";
import { districts, mapSize, type DistrictId } from "./ExpeditionMap";

export interface Geometry {
  platforms: Rect[];
  ladders: { x: number; top: number; bottom: number; lock?: string }[];
  gates: { index: number; lock: string }[];
  lifts: { index: number; top: number; bottom: number }[];
  size: { width: number; height: number };
  /** Where the player starts: the airlock. */
  start: { x: number; y: number };
  /** Passages only wide enough to squeeze through without heavy cargo. */
  narrow: Rect[];
  /** The actual column each link was built at, so traversal can be verified rather than assumed. */
  connectors: {
    a: DistrictId;
    b: DistrictId;
    kind: string;
    x: number;
    /** Floor SURFACES, not platform centres. */
    topSurface: number;
    bottomSurface: number;
    sameFloor: boolean;
  }[];
}

/** Collision comes from the explicit PumpStationLayout room drawing, never district interpolation. */
export function buildGeometry(): Geometry {
  const platforms: Rect[] = enclosure(mapSize.width, mapSize.height, []);
  const ladders: Geometry["ladders"] = [];
  const lifts: Geometry["lifts"] = [];
  const narrow: Rect[] = [];
  for (const r of stationRoutes) {
    if (r.kind === "walk" || r.kind === "jump") continue;
    if (r.kind === "shaft") {
      for (const side of [-1, 1])
        platforms.push({
          x: r.x + side * 74,
          y: (r.top + r.bottom) / 2 - 10,
          w: 12,
          h: r.bottom - r.top - 160,
        });
      narrow.push({ x: r.x, y: (r.top + r.bottom) / 2, w: 160, h: r.bottom - r.top });
      continue;
    }
    if (r.kind === "freightLift") {
      lifts.push({ index: platforms.length, top: r.top, bottom: r.bottom });
      platforms.push({ x: r.x, y: r.bottom + 9, w: 120, h: 18, oneWay: true });
    }
    // The freight shaft also has an emergency ladder for an unladen first visit.
    ladders.push({ x: r.x, top: r.top, bottom: r.bottom, lock: r.kind === "shortcut" ? r.lock : undefined });
    platforms.push({ x: r.x, y: r.top + 9, w: r.kind === "freightLift" ? 120 : 100, h: 18, oneWay: true });
  }
  for (const [x, surface, w] of stationLedges) platforms.push({ x, y: surface + 9, w, h: 18, oneWay: true });
  platforms.push(...stationBlocks);
  // The optional maintenance shortcut is too narrow for bulky equipment.
  narrow.push({ x: 3195, y: 1940, w: 130, h: 520 });
  const gates = [{ index: platforms.length, lock: "sewer-valve" }];
  platforms.push({ x: 3195, y: 1920, w: 130, h: 28 });
  return {
    gates,
    platforms,
    ladders,
    lifts,
    narrow,
    size: mapSize,
    start: { x: 320, y: 2176 },
    connectors: stationRoutes.map((r) => ({
      a: r.a,
      b: r.b,
      kind: r.kind,
      x: r.x,
      topSurface: r.top,
      bottomSurface: r.bottom,
      sameFloor: r.top === r.bottom,
    })),
  };
}

export function districtOf(x: number, y: number): DistrictId | null {
  return districts.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h)?.id ?? null;
}

/** The nearest platform surface at or below (x, y), so drops and props rest on real ground. */
export function surfaceUnder(platforms: Rect[], x: number, y: number): number | null {
  const hits = platforms
    .filter((p) => Math.abs(p.x - x) <= p.w / 2 && p.y - p.h / 2 >= y - 24)
    .map((p) => p.y - p.h / 2);
  return hits.length ? Math.min(...hits) : null;
}
