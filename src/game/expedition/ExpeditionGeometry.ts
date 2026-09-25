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

/** Player is 48 tall, so standing on a surface means centre = surface - 24. */
const PLAYER_HALF = 24;
const FLOOR_H = 24;
/** Floor slab is this thick, and a player stands on its top face. */
const floorSurface = (floorY: number) => floorY - FLOOR_H / 2;
/**
 * Measured max jump height is ~136px with jump held (the air jump REPLACES vertical velocity
 * instead of adding to it, so chaining does not double the height). Every climbable gap must stay
 * well under that, or the map is impassable — an earlier 130–170px spacing made whole districts
 * unreachable.
 */
const MAX_STEP = 88;
/** Width of the opening cut in a floor where a passage arrives. Player is 25 wide. */
const HOLE_W = 100;
/** Rungs are thin one-way ledges; a rung's surface is 9px above its centre. */
const RUNG_H = 18;
const rungY = (surface: number) => surface + RUNG_H / 2;

/**
 * A climb of one-way rungs from just under an opening down to a lower floor. The top rung's surface
 * is level with the upper floor, so a player who emerges through the opening can walk straight onto
 * the floor. Rungs are never level with a SOLID floor above them without an opening: `integrate`
 * pushes overlapping bodies out from below, which would trap the player permanently.
 */
function stair(x: number, topSurface: number, bottomSurface: number, width: number): Rect[] {
  const out: Rect[] = [];
  const span = bottomSurface - topSurface;
  const steps = Math.max(1, Math.ceil(span / MAX_STEP));
  for (let i = 0; i <= steps; i++) {
    const surface = topSurface + (span * i) / steps;
    out.push({ x, y: rungY(surface), w: width, h: RUNG_H, oneWay: true });
  }
  return out;
}

/** A vertical shaft: alternating rungs, plus a logical "narrow" box that stops heavy cargo. */
function shaft(
  x: number,
  topSurface: number,
  bottomSurface: number,
  gap = 96,
): { platforms: Rect[]; narrow: Rect } {
  const platforms: Rect[] = [];
  const span = bottomSurface - topSurface;
  const ledges = Math.max(2, Math.ceil(span / MAX_STEP));
  for (let i = 0; i <= ledges; i++) {
    const surface = topSurface + (span * i) / ledges;
    platforms.push({
      x: x + (i % 2 ? gap / 2 : -gap / 2),
      y: rungY(surface),
      w: 130,
      h: RUNG_H,
      oneWay: true,
    });
  }
  return {
    platforms,
    narrow: { x, y: (topSurface + bottomSurface) / 2, w: gap * 2 - 40, h: bottomSurface - topSurface },
  };
}

export function buildGeometry(): Geometry {
  const platforms: Rect[] = [];
  const narrow: Rect[] = [];
  const connectors: Geometry["connectors"] = [];

  // ── pass 1: decide where every connector lands ───────────────────────────────
  interface Plan {
    link: (typeof links)[number];
    a: (typeof districts)[number];
    b: (typeof districts)[number];
    x: number;
    topSurface: number;
    bottomSurface: number;
    sameFloor: boolean;
  }
  const plans: Plan[] = [];
  for (const l of links) {
    const a = districtById[l.a],
      b = districtById[l.b];
    // Prefer the two districts' shared horizontal edge. They do not always overlap in x (some are
    // stacked diagonally), and the naive midpoint of the two edges then lands in the dead gap
    // between them, leaving a ladder floating over a hole the player can neither reach nor climb.
    const x1 = Math.max(a.x, b.x),
      x2 = Math.min(a.x + a.w, b.x + b.w);
    let x: number;
    if (x2 > x1) x = (x1 + x2) / 2;
    else {
      const aRight = a.x + a.w,
        bRight = b.x + b.w;
      x =
        aRight <= b.x
          ? aRight - 60
          : bRight <= a.x
            ? bRight - 60
            : (Math.min(aRight, bRight) + Math.max(a.x, b.x)) / 2;
    }
    const sameFloor = Math.abs(a.floor - b.floor) < 40;
    plans.push({
      link: l,
      a,
      b,
      x,
      topSurface: floorSurface(Math.min(a.floor, b.floor)),
      bottomSurface: floorSurface(Math.max(a.floor, b.floor)),
      sameFloor,
    });
    connectors.push({
      a: l.a,
      b: l.b,
      kind: l.kind,
      x,
      topSurface: floorSurface(Math.min(a.floor, b.floor)),
      bottomSurface: floorSurface(Math.max(a.floor, b.floor)),
      sameFloor,
    });
  }

  // ── pass 2: floors, with an opening wherever a passage arrives from below ────
  // Without these openings every district floor is a solid slab across the full district, and a
  // ladder under it is a dead end: the player climbs into the slab's underside forever.
  const holes = new Map<DistrictId, number[]>();
  for (const p of plans) {
    if (p.sameFloor) continue;
    const upper = p.a.floor < p.b.floor ? p.a : p.b;
    const list = holes.get(upper.id) ?? [];
    list.push(p.x);
    holes.set(upper.id, list);
  }
  for (const d of districts) {
    const cuts = (holes.get(d.id) ?? [])
      .map(
        (x) =>
          [Math.max(d.x + 10, x - HOLE_W / 2), Math.min(d.x + d.w - 10, x + HOLE_W / 2)] as [number, number],
      )
      .sort((m, n) => m[0] - n[0]);
    let cursor = d.x;
    for (const [from, to] of cuts) {
      if (from > cursor)
        platforms.push({ x: (cursor + from) / 2, y: d.floor, w: from - cursor, h: FLOOR_H, oneWay: false });
      cursor = Math.max(cursor, to);
    }
    if (cursor < d.x + d.w)
      platforms.push({
        x: (cursor + d.x + d.w) / 2,
        y: d.floor,
        w: d.x + d.w - cursor,
        h: FLOOR_H,
        oneWay: false,
      });
  }

  // ── pass 3: connector geometry ──────────────────────────────────────────────
  for (const p of plans) {
    if (p.sameFloor) {
      platforms.push({ x: p.x, y: p.a.floor, w: 200, h: 20, oneWay: true });
      continue;
    }
    if (p.link.kind === "shaft") {
      const s = shaft(p.x, p.topSurface, p.bottomSurface);
      platforms.push(...s.platforms);
      narrow.push(s.narrow);
    } else if (p.link.kind === "drop") {
      // A one-way chute through the opening. Descending is the point, so the ledges only break a
      // long fall into survivable drops — they are never climbed.
      for (let surface = p.topSurface + MAX_STEP * 1.6; surface < p.bottomSurface; surface += MAX_STEP * 1.6)
        platforms.push({ x: p.x, y: rungY(surface), w: 150, h: RUNG_H, oneWay: true });
    } else if (p.link.kind === "freightLift") {
      // The cargo lift runs wide and slow; its extractor still needs power to be used.
      for (let surface = p.topSurface; surface <= p.bottomSurface; surface += MAX_STEP)
        platforms.push({ x: p.x, y: rungY(surface), w: 220, h: 20, oneWay: true });
    } else {
      // A diagonal link's column may sit outside the lower district, so bridge the horizontal gap
      // with a landing apron at the lower floor's surface first.
      const lower = p.a.floor > p.b.floor ? p.a : p.b;
      const lowerCovers = p.x >= lower.x && p.x <= lower.x + lower.w;
      if (!lowerCovers) {
        const edge = p.x < lower.x ? lower.x : lower.x + lower.w;
        platforms.push({
          x: (edge + p.x) / 2,
          y: lower.floor,
          w: Math.abs(p.x - edge) + 240,
          h: 20,
          oneWay: true,
        });
      }
      platforms.push(...stair(p.x, p.topSurface, p.bottomSurface, p.link.kind === "ramp" ? 200 : 130));
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
    connectors,
    size: { width, height },
    start: { x: airlock.x + 240, y: floorSurface(airlock.floor) - PLAYER_HALF },
    narrow,
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
