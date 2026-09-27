import type { OrganId } from "../config";

/**
 * Authored, fixed topology of the 0.10 expedition map. Pure data: no Phaser, no randomness.
 * Geometry (platforms) is built from these districts in ExpeditionGeometry; ecology and route
 * logic only need districts + links.
 */
export const mapSize = { width: 6800, height: 2500 };

export type DistrictId =
  "airlock" | "lower" | "cargo" | "bed" | "deep" | "heatx" | "cool" | "spine" | "control";

export interface District {
  id: DistrictId;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Main floor slab centre; walkable surface is floor - 12. */
  floor: number;
  note: string;
  danger: number;
}

export const districts: District[] = [
  {
    id: "airlock",
    name: "南侧气闸",
    x: 100,
    y: 2005,
    w: 550,
    h: 221,
    floor: 2212,
    danger: 0,
    note: "稳定撤离；沿工区向右出发",
  },
  {
    id: "cargo",
    name: "废弃维修工区",
    x: 650,
    y: 1966,
    w: 1250,
    h: 260,
    floor: 2212,
    danger: 1,
    note: "失控维修机与工作台；试验第一个器官",
  },
  {
    id: "lower",
    name: "排水观察廊",
    x: 1900,
    y: 1966,
    w: 1300,
    h: 351,
    floor: 2290,
    danger: 1,
    note: "上走观察廊，下到沟底争夺尸骸",
  },
  {
    id: "bed",
    name: "滤水维修环",
    x: 1800,
    y: 1582,
    w: 1500,
    h: 351,
    floor: 1835,
    danger: 2,
    note: "短跳上行，绕过温床进入泵厅西侧",
  },
  {
    id: "heatx",
    name: "仓储与货运站",
    x: 3200,
    y: 1901,
    w: 2050,
    h: 351,
    floor: 2212,
    danger: 2,
    note: "货架分隔怪群；右端货运撤离",
  },
  {
    id: "control",
    name: "九号泵机大厅",
    x: 3300,
    y: 1381,
    w: 1600,
    h: 351,
    floor: 1692,
    danger: 2,
    note: "地面绕泵，桥上远程；东侧可载货下行",
  },
  {
    id: "cool",
    name: "背泵值班室",
    x: 4900,
    y: 1452,
    w: 600,
    h: 260,
    floor: 1692,
    danger: 0,
    note: "暂歇、查阅记录，选择上行或回程",
  },
  {
    id: "deep",
    name: "上层控制与封存区",
    x: 3300,
    y: 874,
    w: 1400,
    h: 344,
    floor: 1172,
    danger: 3,
    note: "异质机械占据控制区；恢复货运供电",
  },
  {
    id: "spine",
    name: "东侧设备吊装间",
    x: 5500,
    y: 1095,
    w: 1050,
    h: 351,
    floor: 1406,
    danger: 2,
    note: "带走大型设备：经泵厅或外侧装卸道回程",
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
  { id: "airlock-cargo", a: "airlock", b: "cargo", kind: "walk", cost: 5, heavy: true, note: "平地出发" },
  { id: "cargo-lower", a: "cargo", b: "lower", kind: "walk", cost: 9, heavy: true, note: "观察走廊" },
  { id: "lower-bed", a: "lower", b: "bed", kind: "stairs", cost: 12, heavy: false, note: "滤水设备踏台" },
  { id: "lower-heatx", a: "lower", b: "heatx", kind: "walk", cost: 12, heavy: true, note: "排水东出口" },
  { id: "bed-control", a: "bed", b: "control", kind: "stairs", cost: 8, heavy: false, note: "泵厅西侧短跳" },
  {
    id: "heatx-control",
    a: "heatx",
    b: "control",
    kind: "stairs",
    cost: 15,
    heavy: false,
    note: "货架与维护踏台上行",
  },
  {
    id: "pump-cargo-return",
    a: "control",
    b: "heatx",
    kind: "drop",
    cost: 8,
    heavy: true,
    oneWay: true,
    note: "泵厅东侧分段落差；重物短路",
  },
  { id: "control-cool", a: "control", b: "cool", kind: "walk", cost: 5, heavy: true, note: "背泵休息处" },
  {
    id: "control-deep",
    a: "control",
    b: "deep",
    kind: "stairs",
    cost: 14,
    heavy: false,
    note: "控制区维修折返",
  },
  { id: "deep-spine", a: "deep", b: "spine", kind: "stairs", cost: 14, heavy: false, note: "封存区外侧联廊" },
  { id: "cool-spine", a: "cool", b: "spine", kind: "stairs", cost: 10, heavy: false, note: "吊装室西侧踏台" },
  {
    id: "rig-pump-return",
    a: "spine",
    b: "cool",
    kind: "drop",
    cost: 7,
    heavy: true,
    oneWay: true,
    note: "载货向西下行",
  },
  {
    id: "rig-freight-return",
    a: "spine",
    b: "heatx",
    kind: "drop",
    cost: 22,
    heavy: true,
    oneWay: true,
    note: "外侧装卸道；长回程",
  },
  {
    id: "pump-drain-shortcut",
    a: "control",
    b: "lower",
    kind: "shortcut",
    cost: 7,
    heavy: false,
    lock: "sewer-valve",
    note: "泵厅开启检修井，直回观察廊",
  },
  {
    id: "rig-freight-lift",
    a: "heatx",
    b: "spine",
    kind: "freightLift",
    cost: 16,
    heavy: true,
    lock: "freight-power",
    note: "供电后货梯往返",
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
    id: "nest-pump",
    name: "泵后寄生巢",
    district: "control",
    x: 4390,
    lean: { scavenger: 3, hunter: 4, floater: 2 },
    organPool: ["armor", "vitality", "ram", "battery"],
  },
  {
    id: "nest-rot",
    name: "腐渣巢",
    district: "lower",
    x: 2320,
    lean: { scavenger: 5, hunter: 2, floater: 1 },
    organPool: ["ram", "battery", "knock", "leech", "stunKnock"],
  },
  {
    id: "nest-sludge",
    name: "淤积坑巢",
    district: "lower",
    x: 2940,
    lean: { scavenger: 2, hunter: 5, floater: 1 },
    organPool: ["rage", "vulnerable", "heavyArea", "multi", "ram"],
  },
  {
    id: "nest-bed",
    name: "温床母巢",
    district: "bed",
    x: 2630,
    lean: { scavenger: 2, hunter: 5, floater: 1 },
    organPool: ["mark", "spread", "conduit", "rage", "multi", "vulnerable"],
  },
  {
    id: "nest-glare",
    name: "灼光巢",
    district: "heatx",
    x: 4010,
    lean: { scavenger: 1, hunter: 2, floater: 5 },
    organPool: ["hot", "coolShield", "shieldBurst", "discharge", "heavyArea", "vent"],
  },
  {
    id: "nest-frost",
    name: "霜管巢",
    district: "deep",
    x: 4180,
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
