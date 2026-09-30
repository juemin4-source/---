import { organIds, organs, type OrganId } from "../config";
import type { DistrictId } from "./ExpeditionMap";

export type LootCategory = "sample" | "part" | "supply" | "blueprint" | "heavy";
export interface LootDef {
  id: string;
  name: string;
  category: LootCategory;
  /** Extraction value. */
  value: number;
  /** Cargo units consumed while carried. */
  weight: number;
  /** Slots in the pack. */
  size: number;
  /** Heavy items slow you down and cannot pass narrow passages. */
  heavy?: boolean;
  organ?: OrganId;
  note: string;
}

/**
 * Loot is authored, not rolled: a player who learns the map learns what is worth the trip.
 * `weight`/`size` are what make the cargo decision real — everything valuable is also a burden.
 */
export const lootDefs: Record<string, LootDef> = {
  maintenanceBook: {
    id: "maintenanceBook",
    name: "泵站维修手册",
    category: "supply",
    value: 35,
    weight: 1,
    size: 1,
    note: "旧设施的具体技术资料；带出结算",
  },
  sludgeSample: {
    id: "sludgeSample",
    name: "淤积样本",
    category: "sample",
    value: 12,
    weight: 1,
    size: 1,
    note: "随处可得，回本用",
  },
  coolantCell: {
    id: "coolantCell",
    name: "冷凝剂罐",
    category: "supply",
    value: 20,
    weight: 2,
    size: 1,
    note: "也能当场用掉恢复",
  },
  bioPart: {
    id: "bioPart",
    name: "生物部件",
    category: "part",
    value: 28,
    weight: 2,
    size: 1,
    note: "研究材料",
  },
  forgeBlueprint: {
    id: "forgeBlueprint",
    name: "锻造蓝图",
    category: "blueprint",
    value: 85,
    weight: 1,
    size: 1,
    note: "带出后结算为研究价值",
  },
  neuralSample: {
    id: "neuralSample",
    name: "神经样本",
    category: "sample",
    value: 65,
    weight: 3,
    size: 2,
    note: "深区高价值",
  },
  /** Heavy cargo: the whole point of the cargo route and the cargo extract. */
  regenTank: {
    id: "regenTank",
    name: "回生罐",
    category: "heavy",
    value: 120,
    weight: 9,
    size: 3,
    heavy: true,
    note: "很重：明显拖慢移动，过不去维修井",
  },
  sensorSpine: {
    id: "sensorSpine",
    name: "感应脊柱",
    category: "heavy",
    value: 150,
    weight: 11,
    size: 3,
    heavy: true,
    note: "很重：最值钱，也最难带回去",
  },
  reactorCore: {
    id: "reactorCore",
    name: "反应堆芯",
    category: "heavy",
    value: 200,
    weight: 13,
    size: 4,
    heavy: true,
    note: "极重：只能走货运路线",
  },
};

const campaignLoot: [string, string, LootCategory, number, number, number, string][] = [
  ["batteryCell", "旧式锂电池", "part", 15, 1, 1, "提炼为锂，用于制造与强化"],
  ["fuelCell", "密封聚变燃料", "part", 80, 2, 1, "提炼为超重氢，用于永久供电"],
  ["lithium", "提炼锂", "part", 8, 1, 1, "制造材料"],
  ["deuterium", "超重氢", "part", 30, 1, 1, "永久工程材料"],
  ["medicalBook", "战地急救基础", "supply", 35, 1, 1, "居民学习医学"],
  ["pythonBook", "Python 入门", "supply", 40, 1, 1, "居民学习计算研究，也用于无人机制造"],
  ["fusionBook", "核聚变入门", "supply", 65, 1, 1, "进阶能源工程课程"],
  ["trainingTicket", "特训券", "supply", 15, 0, 1, "与金币一起兑换养成点"],
  ["machineTool", "精密机床", "heavy", 180, 12, 4, "工坊高级加工设备"],
];
for (const [id, name, category, value, weight, size, note] of campaignLoot)
  lootDefs[id] = { id, name, category, value, weight, size, note, heavy: category === "heavy" };
for (const organ of organIds)
  lootDefs[`sample-${organ}`] = {
    id: `sample-${organ}`,
    name: `${organs[organ].name}完整样本`,
    category: "sample",
    value: 45,
    weight: 1,
    size: 1,
    organ,
    note: "带回器官研究站，解锁结构接口",
  };

export interface LootItem {
  uid: number;
  def: LootDef;
  /** Where it came from, for the run record. */
  source: string;
  district: DistrictId;
}

export interface LootPile {
  uid: number;
  x: number;
  y: number;
  district: DistrictId;
  source: string;
  taken: boolean;
  /** Search progress needed before it can be taken (0 = lying in the open). */
  difficulty: number;
  items: LootItem[];
}

let uid = 1;
export const nextUid = () => uid++;

export interface CargoState {
  items: LootItem[];
  value: number;
  weight: number;
  size: number;
  capacity: number;
  bulk: number;
}
export const freshCargo = (capacity = 6): CargoState => ({
  items: [],
  value: 0,
  weight: 0,
  size: 0,
  capacity,
  bulk: 0,
});

export function cargoAdd(c: CargoState, item: LootItem): boolean {
  if (c.size + item.def.size > c.capacity) return false;
  c.items.push(item);
  c.size += item.def.size;
  c.weight += item.def.weight;
  c.value += item.def.value;
  return true;
}
export function cargoRemove(c: CargoState, uid: number): LootItem | null {
  const i = c.items.findIndex((x) => x.uid === uid);
  if (i < 0) return null;
  const [item] = c.items.splice(i, 1);
  c.size -= item.def.size;
  c.weight -= item.def.weight;
  c.value -= item.def.value;
  return item;
}
export const isBulky = (c: CargoState) => c.items.some((i) => i.def.heavy);

/**
 * Carrying heavy cargo costs mobility. Values are multiplicative so they compound with organs but
 * never zero out: a heavy run is slow and clumsy, not impossible.
 */
export function cargoPenalty(c: CargoState) {
  const heavyCount = c.items.filter((i) => i.def.heavy).length;
  return {
    speed: Math.max(0.55, 1 - 0.16 * Math.min(3, heavyCount) - Math.min(0.14, c.weight * 0.006)),
    jump: Math.max(0.6, 1 - 0.2 * Math.min(3, heavyCount)),
    dash: Math.max(0.5, 1 - 0.25 * Math.min(3, heavyCount)),
  };
}
