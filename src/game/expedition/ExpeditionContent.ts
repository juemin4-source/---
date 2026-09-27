import { lootDefs, nextUid, type LootItem, type LootPile } from "./LootSystem";
import { districts, nestDefs, type DistrictId } from "./ExpeditionMap";

/**
 * Search points, extractors and shortcuts are authored: a repeat run can be learned rather than
 * memorised randomly. Positions are fractions of a district, so bounds can be tweaked safely.
 */
/** A standing player's centre sits this far above the floor surface; props must match it or the
 *  player can never reach them. Kept in sync with the player body (48 tall, 12px into the floor). */
const STAND_Y = 36;
export const STAND_HEIGHT = STAND_Y;
const fr = (d: DistrictId, fx: number) => {
  const dd = districts.find((x) => x.id === d)!;
  return { x: dd.x + dd.w * fx, y: dd.floor - STAND_Y };
};

interface SearchDef {
  id: string;
  district: DistrictId;
  fx: number;
  difficulty: number;
  loot: string[];
  note: string;
}

/** 14 search points: enough that a route has real opportunity cost, few enough to learn. */
export const searchDefs: SearchDef[] = [
  {
    id: "airlock-locker",
    district: "airlock",
    fx: 0.72,
    difficulty: 1.2,
    loot: ["sludgeSample"],
    note: "气闸储物柜",
  },
  {
    id: "lower-silt",
    district: "lower",
    fx: 0.3,
    difficulty: 1.6,
    loot: ["sludgeSample", "bioPart"],
    note: "淤积堆",
  },
  { id: "lower-duct", district: "lower", fx: 0.78, difficulty: 2.4, loot: ["coolantCell"], note: "排污管口" },
  {
    id: "cargo-manifest",
    district: "cargo",
    fx: 0.24,
    difficulty: 1.8,
    loot: ["sludgeSample"],
    note: "货运清单柜",
  },
  {
    id: "cargo-crate",
    district: "cargo",
    fx: 0.66,
    difficulty: 3.0,
    loot: ["bioPart", "coolantCell"],
    note: "货运板条箱",
  },
  {
    id: "bed-membrane",
    district: "bed",
    fx: 0.34,
    difficulty: 3.4,
    loot: ["bioPart", "neuralSample"],
    note: "温床膜",
  },
  { id: "bed-pod", district: "bed", fx: 0.8, difficulty: 3.8, loot: ["neuralSample"], note: "孵化舱" },
  {
    id: "heatx-coil",
    district: "heatx",
    fx: 0.28,
    difficulty: 3.0,
    loot: ["coolantCell", "sensorSpine"],
    note: "换热盘管",
  },
  {
    id: "heatx-log",
    district: "heatx",
    fx: 0.74,
    difficulty: 2.6,
    loot: ["coolantCell"],
    note: "值班记录器",
  },
  {
    id: "cool-condenser",
    district: "cool",
    fx: 0.36,
    difficulty: 1.5,
    loot: ["maintenanceBook", "coolantCell"],
    note: "值班桌与维修手册",
  },
  {
    id: "spine-locker",
    district: "spine",
    fx: 0.5,
    difficulty: 2.2,
    loot: ["regenTank"],
    note: "可搬运机组",
  },
  {
    id: "deep-sample",
    district: "deep",
    fx: 0.3,
    difficulty: 4.2,
    loot: ["neuralSample", "forgeBlueprint"],
    note: "深区样本舱",
  },
  {
    id: "deep-rig",
    district: "spine",
    fx: 0.72,
    difficulty: 5.0,
    loot: ["reactorCore", "sensorSpine"],
    note: "大型设备",
  },
  {
    id: "control-core",
    district: "control",
    fx: 0.8,
    difficulty: 5.5,
    loot: ["forgeBlueprint", "neuralSample"],
    note: "控制核心",
  },
];

/**
 * Build the run's loot piles. `roll` decides only whether a pile's bonus item is present; the
 * primary item and every position are fixed, so a route is never a guaranteed jackpot but is
 * always worth planning.
 */
export function buildLootPiles(roll: (chance: number) => boolean): LootPile[] {
  return searchDefs.map((s) => {
    const p = fr(s.district, s.fx);
    const items: LootItem[] = [];
    s.loot.forEach((id, i) => {
      if (i > 0 && !roll(0.55)) return;
      items.push({ uid: nextUid(), def: lootDefs[id], source: s.id, district: s.district });
    });
    return {
      uid: nextUid(),
      x: p.x,
      y: p.y,
      district: s.district,
      source: s.note,
      taken: false,
      difficulty: s.difficulty,
      items,
    };
  });
}

export interface Extractor {
  id: string;
  name: string;
  district: DistrictId;
  fx: number;
  /** Requires power before it can be used. */
  needsPower: boolean;
  /** Accepts heavy cargo. */
  cargo: boolean;
  note: string;
}
/** Two extractors: the airlock is always open and takes only what you can carry; the freight
 *  station must be powered and is the only way to get heavy cargo out. */
export const extractors: Extractor[] = [
  {
    id: "airlock",
    name: "安全气闸",
    district: "airlock",
    fx: 0.22,
    needsPower: false,
    cargo: false,
    note: "起始撤离点 · 永远可用",
  },
  {
    id: "freight",
    name: "货运撤离站",
    district: "heatx",
    fx: 0.92,
    needsPower: true,
    cargo: true,
    note: "需先恢复供电 · 唯一能吊走重型货物",
  },
];
export const extractorPos = (e: Extractor) => fr(e.district, e.fx);

/** Shortcuts the player opens during a run along with the freight power switch. */
export const shortcutDefs = [
  {
    id: "sewer-valve",
    name: "排污阀",
    district: "control" as DistrictId,
    fx: 0.02,
    note: "开启泵厅西侧检修井 · 直回排水观察廊",
  },
  {
    id: "freight-power",
    name: "货运供电闸",
    district: "deep" as DistrictId,
    fx: 0.91,
    note: "为货运撤离站供电",
  },
];

export const nestPositions = nestDefs.map((n) => {
  const d = districts.find((x) => x.id === n.district)!;
  return { ...n, y: d.floor - STAND_Y };
});
