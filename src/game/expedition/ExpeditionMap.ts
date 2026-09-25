import type { OrganId } from "../config";

/**
 * Authored, fixed topology of the 0.10 expedition map. Pure data: no Phaser, no randomness.
 * Geometry (platforms) is built from these districts in ExpeditionGeometry; ecology and route
 * logic only need districts + links.
 */
export const mapSize = { width: 4400, height: 3000 };

export type DistrictId =
  "airlock" | "lower" | "cargo" | "bed" | "deep" | "heatx" | "cool" | "spine" | "control";

export interface District {
  id: DistrictId;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Main walkable floor (top surface y). */
  floor: number;
  note: string;
  danger: number;
}

export const districts: District[] = [
  {
    id: "control",
    name: "深层控制区",
    x: 2300,
    y: 0,
    w: 1500,
    h: 600,
    floor: 560,
    note: "高价值：控制核心 / 蓝图",
    danger: 3,
  },
  {
    id: "cool",
    name: "冷却廊",
    x: 1300,
    y: 600,
    w: 1300,
    h: 600,
    floor: 1160,
    note: "霜管巢 · 冷凝剂",
    danger: 2,
  },
  {
    id: "spine",
    name: "维修脊柱",
    x: 2600,
    y: 600,
    w: 1500,
    h: 600,
    floor: 1160,
    note: "维修井只容空手通过",
    danger: 2,
  },
  {
    id: "airlock",
    name: "安全气闸",
    x: 0,
    y: 1200,
    w: 1100,
    h: 600,
    floor: 1760,
    note: "初始撤离点 · 永远可用",
    danger: 0,
  },
  {
    id: "cargo",
    name: "货运枢纽",
    x: 1100,
    y: 1200,
    w: 1500,
    h: 600,
    floor: 1760,
    note: "路线交汇 · 货运坡道",
    danger: 1,
  },
  {
    id: "heatx",
    name: "人工白昼换热区",
    x: 2600,
    y: 1200,
    w: 1800,
    h: 600,
    floor: 1760,
    note: "灼光巢 · 货运撤离站",
    danger: 2,
  },
  {
    id: "lower",
    name: "下层废区",
    x: 0,
    y: 1800,
    w: 1500,
    h: 600,
    floor: 2360,
    note: "腐渣巢 · 排污管近路",
    danger: 1,
  },
  {
    id: "bed",
    name: "生体温床",
    x: 1500,
    y: 1800,
    w: 1700,
    h: 600,
    floor: 2360,
    note: "温床母巢 · 捕食者多",
    danger: 2,
  },
  {
    id: "deep",
    name: "高价值深区",
    x: 1700,
    y: 2400,
    w: 2100,
    h: 600,
    floor: 2960,
    note: "大型设备 / 稀有样本",
    danger: 3,
  },
];
export const districtById = Object.fromEntries(districts.map((d) => [d.id, d])) as Record<
  DistrictId,
  District
>;

export type LinkKind = "walk" | "stairs" | "shaft" | "ramp" | "freightLift" | "drop" | "shortcut";
export interface Link {
  id: string;
  a: DistrictId;
  b: DistrictId;
  kind: LinkKind;
  /** Seconds a creature needs to cross; also a route-length proxy. */
  cost: number;
  /** Carrying heavy cargo is allowed through this link. */
  heavy: boolean;
  /** Only a → b. */
  oneWay?: boolean;
  /** Needs to be opened/powered during this run first. */
  lock?: string;
  note: string;
}

export const links: Link[] = [
  { id: "airlock-cargo", a: "airlock", b: "cargo", kind: "walk", cost: 8, heavy: true, note: "气闸闸门" },
  {
    id: "airlock-lower",
    a: "airlock",
    b: "lower",
    kind: "stairs",
    cost: 9,
    heavy: false,
    note: "气闸检修梯",
  },
  { id: "lower-bed", a: "lower", b: "bed", kind: "walk", cost: 10, heavy: true, note: "废区通道" },
  { id: "cargo-bed", a: "cargo", b: "bed", kind: "ramp", cost: 10, heavy: true, note: "货运斜坡" },
  { id: "cargo-heatx", a: "cargo", b: "heatx", kind: "walk", cost: 9, heavy: true, note: "货运主干道" },
  { id: "bed-heatx", a: "bed", b: "heatx", kind: "stairs", cost: 11, heavy: false, note: "温床东梯" },
  { id: "cargo-cool", a: "cargo", b: "cool", kind: "stairs", cost: 10, heavy: false, note: "枢纽北梯" },
  { id: "cool-spine", a: "cool", b: "spine", kind: "walk", cost: 9, heavy: false, note: "冷却管桥" },
  {
    id: "heatx-spine",
    a: "heatx",
    b: "spine",
    kind: "shaft",
    cost: 9,
    heavy: false,
    note: "维修井（只能空手）",
  },
  { id: "cool-control", a: "cool", b: "control", kind: "stairs", cost: 10, heavy: false, note: "控制区西梯" },
  {
    id: "spine-control",
    a: "spine",
    b: "control",
    kind: "stairs",
    cost: 10,
    heavy: false,
    note: "控制区东梯",
  },
  { id: "bed-deep", a: "bed", b: "deep", kind: "shaft", cost: 10, heavy: false, note: "温床竖井" },
  {
    id: "deep-heatx",
    a: "deep",
    b: "heatx",
    kind: "freightLift",
    cost: 14,
    heavy: true,
    lock: "freight-power",
    note: "货梯（需供电）",
  },
  {
    id: "control-bed",
    a: "control",
    b: "bed",
    kind: "drop",
    cost: 6,
    heavy: false,
    oneWay: true,
    note: "控制区破洞：单向落入温床",
  },
  {
    id: "spine-cargo",
    a: "spine",
    b: "cargo",
    kind: "shortcut",
    cost: 7,
    heavy: false,
    lock: "spine-door",
    note: "脊柱检修门（从脊柱侧打开）",
  },
  {
    id: "deep-lower",
    a: "deep",
    b: "lower",
    kind: "shortcut",
    cost: 8,
    heavy: false,
    lock: "sewer-valve",
    note: "排污管（从深区打开）· 危险快速回程",
  },
];

export interface NestDef {
  id: string;
  name: string;
  district: DistrictId;
  x: number;
  lean: { scavenger: number; hunter: number; floater: number };
  organPool: OrganId[];
}
/** Around four main nests. "lower" deliberately holds two competing colonies: without at least one
 *  shared district, creature-vs-creature predation can never happen at all. */
export const nestDefs: NestDef[] = [
  {
    id: "nest-rot",
    name: "腐渣巢",
    district: "lower",
    x: 430,
    lean: { scavenger: 5, hunter: 2, floater: 1 },
    organPool: ["ram", "battery", "knock", "leech", "stunKnock"],
  },
  {
    id: "nest-sludge",
    name: "淤积坑巢",
    district: "lower",
    x: 1130,
    lean: { scavenger: 2, hunter: 5, floater: 1 },
    organPool: ["rage", "vulnerable", "heavyArea", "multi", "ram"],
  },
  {
    id: "nest-bed",
    name: "温床母巢",
    district: "bed",
    x: 2350,
    lean: { scavenger: 2, hunter: 5, floater: 1 },
    organPool: ["mark", "spread", "conduit", "rage", "multi", "vulnerable"],
  },
  {
    id: "nest-glare",
    name: "灼光巢",
    district: "heatx",
    x: 3700,
    lean: { scavenger: 1, hunter: 2, floater: 5 },
    organPool: ["hot", "coolShield", "shieldBurst", "discharge", "heavyArea", "vent"],
  },
  {
    id: "nest-frost",
    name: "霜管巢",
    district: "cool",
    x: 1900,
    lean: { scavenger: 3, hunter: 3, floater: 2 },
    organPool: ["freeze", "shatter", "speed", "glass", "perfect", "airPower"],
  },
];

export interface Passage {
  from: DistrictId;
  to: DistrictId;
  link: Link;
}
/** Usable directed passages given the currently opened locks. */
export function passages(open: ReadonlySet<string>, heavy = false): Passage[] {
  const out: Passage[] = [];
  for (const l of links) {
    if (l.lock && !open.has(l.lock)) continue;
    if (heavy && !l.heavy) continue;
    out.push({ from: l.a, to: l.b, link: l });
    if (!l.oneWay) out.push({ from: l.b, to: l.a, link: l });
  }
  return out;
}
/** Cheapest route (Dijkstra over link cost). Returns district path including start, or null. */
export function route(from: DistrictId, to: DistrictId, open: ReadonlySet<string>, heavy = false) {
  const edges = passages(open, heavy);
  const dist = new Map<DistrictId, number>([[from, 0]]),
    prev = new Map<DistrictId, DistrictId>(),
    todo = new Set<DistrictId>(districts.map((d) => d.id));
  while (todo.size) {
    let best: DistrictId | null = null;
    for (const d of todo) if (dist.has(d) && (best === null || dist.get(d)! < dist.get(best)!)) best = d;
    if (best === null) break;
    todo.delete(best);
    if (best === to) break;
    for (const e of edges)
      if (e.from === best) {
        const nd = dist.get(best)! + e.link.cost;
        if (nd < (dist.get(e.to) ?? Infinity)) {
          dist.set(e.to, nd);
          prev.set(e.to, best);
        }
      }
  }
  if (!dist.has(to)) return null;
  const path: DistrictId[] = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return { path, cost: dist.get(to)! };
}
export function districtAt(x: number, y: number) {
  return districts.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h);
}
