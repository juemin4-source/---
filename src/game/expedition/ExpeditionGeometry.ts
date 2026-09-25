import type { Rect } from "../../engine/PhysicsHelpers";
import { districtById, districts, links, mapSize, type DistrictId } from "./ExpeditionMap";

/**
 * Builds real collision geometry from the authored district topology. Districts are laid out in
 * rows, so one floor per district plus one connector per link makes the whole map walkable.
 * Nothing here is random, so the same map comes back every run.
 */
export interface Geometry {
  platforms: Rect[];
  size: { width: number; height: number };
  /** Where the player starts: the airlock. */
  start: { x: number; y: number };
  /** Passages only wide enough to squeeze through without heavy cargo. */
  narrow: Rect[];
}

/** Player is 48 tall, so standing on a floor means centre = surface - 24. */
const PLAYER_HALF = 24;

/** A stepped climb/descent between two heights. */
function stair(x: number, y1: number, y2: number, width: number): Rect[] {
  const out: Rect[] = [];
  const steps = Math.max(1, Math.round(Math.abs(y2 - y1) / 78));
  for (let i = 0; i <= steps; i++)
    out.push({ x, y: y1 + ((y2 - y1) * i) / steps, w: width, h: 18, oneWay: true });
  return out;
}

/**
 * A vertical passage: alternating ledges to climb, plus a logical "narrow" box. The box is what
 * stops heavy cargo; no solid walls are added, because a full-height wall at a district seam would
 * also block ordinary walking along the floor it lands on.
 */
function shaft(x: number, yTop: number, yBottom: number, gap = 96): { platforms: Rect[]; narrow: Rect } {
  const platforms: Rect[] = [];
  const height = yBottom - yTop;
  const ledges = Math.max(2, Math.round(height / 130));
  for (let i = 0; i <= ledges; i++)
    platforms.push({
      x: x + (i % 2 ? gap / 2 : -gap / 2),
      y: yTop + (height * i) / ledges,
      w: 130,
      h: 18,
      oneWay: true,
    });
  return { platforms, narrow: { x, y: yTop + height / 2, w: gap * 2 - 40, h: height } };
}

export function buildGeometry(): Geometry {
  const platforms: Rect[] = [];
  const narrow: Rect[] = [];
  for (const d of districts) platforms.push({ x: d.x + d.w / 2, y: d.floor, w: d.w, h: 24, oneWay: false });
  for (const l of links) {
    const a = districtById[l.a],
      b = districtById[l.b];
    // Anchor the connector in the middle of the shared horizontal edge between the two districts.
    const x1 = Math.max(a.x, b.x),
      x2 = Math.min(a.x + a.w, b.x + b.w);
    const anchorX = x2 > x1 ? (x1 + x2) / 2 : (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2;
    const sameFloor = Math.abs(a.floor - b.floor) < 40;
    if (sameFloor) {
      // Bridge the seam so the two floors are genuinely continuous.
      platforms.push({ x: anchorX, y: a.floor, w: 200, h: 20, oneWay: true });
      continue;
    }
    const top = Math.min(a.floor, b.floor),
      bottom = Math.max(a.floor, b.floor);
    if (l.kind === "shaft") {
      const s = shaft(anchorX, top, bottom);
      platforms.push(...s.platforms);
      narrow.push(s.narrow);
    } else if (l.kind === "drop") {
      // A one-way chute: ledges catch a fall, but nothing lets you climb back up.
      for (let y = top + 150; y < bottom; y += 170)
        platforms.push({ x: anchorX, y, w: 150, h: 18, oneWay: true });
    } else if (l.kind === "freightLift") {
      // The cargo lift runs wide and slow; its extractor still needs power to be used.
      for (let y = top; y <= bottom; y += 150) platforms.push({ x: anchorX, y, w: 220, h: 20, oneWay: true });
    } else {
      platforms.push(...stair(anchorX, top, bottom, l.kind === "ramp" ? 200 : 130));
    }
  }
  // Outer boundary only: keeps the player inside the map without splitting any floor.
  const { width, height } = mapSize;
  platforms.push({ x: 8, y: height / 2, w: 16, h: height, oneWay: false });
  platforms.push({ x: width - 8, y: height / 2, w: 16, h: height, oneWay: false });
  platforms.push({ x: width / 2, y: height - 8, w: width, h: 16, oneWay: false });
  const airlock = districtById.airlock;
  return {
    platforms,
    size: { width, height },
    start: { x: airlock.x + 240, y: airlock.floor - 12 - PLAYER_HALF },
    narrow,
  };
}

export function districtOf(x: number, y: number): DistrictId | null {
  return districts.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h)?.id ?? null;
}
