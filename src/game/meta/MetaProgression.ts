import { lootDefs, type LootItem } from "../expedition/LootSystem";
import { weapons, secondaries, type WeaponId, type SecondaryId } from "../config";

export const drills = {
  health: { name: "体能训练", description: "每级最大生命 +10，上限 3 级", cost: 30 },
  cooling: { name: "散热训练", description: "每级散热速度 +8%，上限 3 级", cost: 35 },
  recovery: { name: "耐力训练", description: "每级体力恢复 +8%，上限 3 级", cost: 30 },
};
export type Drill = keyof typeof drills;
export const projects = {
  precision: { name: "重载机匣", description: "主武器基础伤害 +15%，攻击速度 -10%", cost: 40, needs: { bioPart: 1 }, workshop: 0 },
  vented: { name: "散热套件", description: "散热速度 +25%，主武器基础伤害 -5%", cost: 45, needs: { coolantCell: 1 }, workshop: 0 },
  rapid: { name: "轻量传动", description: "主武器攻击速度 +15%，基础伤害 -10%", cost: 65, needs: { forgeBlueprint: 1 }, workshop: 1 },
} as const;
export type Modification = keyof typeof projects;
export const facilities = {
  workshop: { name: "工坊技术升级", description: "消耗维修手册，开放轻量传动研究", cost: 40, needs: { maintenanceBook: 1 } },
  infirmary: { name: "回生治疗站", description: "安装回生罐：每趟出发多携带 1 个医疗包", cost: 60, needs: { regenTank: 1 } },
  freight: { name: "货运整理站", description: "安装感应脊柱：探索货物容量由 6 提升至 8", cost: 70, needs: { sensorSpine: 1 } },
  generator: { name: "备用能源站", description: "安装反应堆芯：每趟出发获得 1 点初始充能", cost: 80, needs: { reactorCore: 1 } },
} as const;
export type Facility = keyof typeof facilities;
export interface MetaProgress {
  warehouse: Record<string, number>;
  training: Record<Drill, number>;
  unlocked: Modification[];
  installed: Modification | null;
  facilities: Facility[];
  primary: WeaponId;
  secondary: SecondaryId;
  lastSettledRun: number;
}
export interface MetaAccount { bank: number; meta: MetaProgress }
export const freshMeta = (): MetaProgress => ({ warehouse: {}, training: { health: 0, cooling: 0, recovery: 0 }, unlocked: [], installed: null, facilities: [], primary: "handgun", secondary: "grenade", lastSettledRun: 0 });
const owns = (o: object, key: unknown): key is string => typeof key === "string" && Object.hasOwn(o, key);
const integer = (n: unknown, cap: number) => typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(cap, Math.floor(n))) : 0;
export function parseMeta(raw: unknown): MetaProgress {
  const m = freshMeta();
  if (!raw || typeof raw !== "object") return m;
  const r = raw as Record<string, unknown>;
  if (r.warehouse && typeof r.warehouse === "object") for (const [id, n] of Object.entries(r.warehouse)) if (owns(lootDefs, id)) m.warehouse[id] = integer(n, 9999);
  if (r.training && typeof r.training === "object") for (const id of Object.keys(drills) as Drill[]) m.training[id] = integer((r.training as Record<string, unknown>)[id], 3);
  if (Array.isArray(r.unlocked)) m.unlocked = [...new Set(r.unlocked.filter((id): id is Modification => owns(projects, id)))];
  if (Array.isArray(r.facilities)) m.facilities = [...new Set(r.facilities.filter((id): id is Facility => owns(facilities, id)))];
  if (owns(projects, r.installed) && m.unlocked.includes(r.installed as Modification)) m.installed = r.installed as Modification;
  if (owns(weapons, r.primary)) m.primary = r.primary as WeaponId;
  if (owns(secondaries, r.secondary)) m.secondary = r.secondary as SecondaryId;
  m.lastSettledRun = integer(r.lastSettledRun, Number.MAX_SAFE_INTEGER);
  return m;
}
/** Concrete cargo goes into storage; only the legacy non-item reward becomes currency. */
export function settleMeta(a: MetaAccount, run: number, extracted: boolean, cargo: number, items: readonly LootItem[]) {
  if (run <= a.meta.lastSettledRun) return { stored: 0, coins: 0 };
  a.meta.lastSettledRun = run;
  if (!extracted) return { stored: 0, coins: 0 };
  let value = 0, stored = 0;
  for (const item of items) {
    const def = lootDefs[item.def.id];
    if (!def) continue;
    a.meta.warehouse[def.id] = (a.meta.warehouse[def.id] ?? 0) + 1;
    value += def.value;
    stored++;
  }
  const coins = Math.max(0, Math.floor(cargo - value));
  a.bank += coins;
  return { stored, coins };
}
export function missing(a: MetaAccount, cost: number, needs: Readonly<Record<string, number>>) {
  const reasons: string[] = [];
  if (a.bank < cost) reasons.push(`还需 ${cost - a.bank} 金币`);
  for (const [id, n] of Object.entries(needs)) if ((a.meta.warehouse[id] ?? 0) < n) reasons.push(`缺少 ${lootDefs[id].name} ×${n - (a.meta.warehouse[id] ?? 0)}`);
  return reasons.join(" · ");
}
function spend(a: MetaAccount, cost: number, needs: Readonly<Record<string, number>>) {
  if (missing(a, cost, needs)) return false;
  a.bank -= cost;
  for (const [id, n] of Object.entries(needs)) a.meta.warehouse[id] -= n;
  return true;
}
export function metaAction(a: MetaAccount, action: string, id: string): string {
  const m = a.meta;
  if (action === "sell" && owns(lootDefs, id)) {
    if (!(m.warehouse[id] > 0)) return "仓库中没有这件物品";
    m.warehouse[id]--;
    a.bank += lootDefs[id].value;
    return `已出售 ${lootDefs[id].name}，获得 ${lootDefs[id].value} 金币`;
  }
  if (action === "train" && owns(drills, id)) {
    const key = id as Drill, level = m.training[key], cost = drills[key].cost * (level + 1);
    if (level >= 3) return "训练已达上限";
    if (!spend(a, cost, {})) return missing(a, cost, {});
    m.training[key]++;
    return `${drills[key].name}已提升至 ${level + 1} 级，下次出发生效`;
  }
  if (action === "research" && owns(projects, id)) {
    const key = id as Modification, p = projects[key];
    if (m.unlocked.includes(key)) return "已经研究完成";
    if (p.workshop && !m.facilities.includes("workshop")) return "先升级工坊：需要泵站维修手册";
    if (!spend(a, p.cost, p.needs)) return missing(a, p.cost, p.needs);
    m.unlocked.push(key);
    return `${p.name}研究完成，可免费安装或切换`;
  }
  if (action === "install") {
    if (id === "none") { m.installed = null; return "已恢复标准武器结构"; }
    if (m.unlocked.includes(id as Modification)) { m.installed = id as Modification; return "改造已安装，下次出发生效"; }
    return "尚未研究此改造";
  }
  if (action === "facility" && owns(facilities, id)) {
    const key = id as Facility, f = facilities[key];
    if (m.facilities.includes(key)) return "设施已经建成";
    if (!spend(a, f.cost, f.needs)) return missing(a, f.cost, f.needs);
    m.facilities.push(key);
    return `${f.name}已启用`;
  }
  if (action === "primary" && owns(weapons, id)) { m.primary = id as WeaponId; return "出发主武器已更新"; }
  if (action === "secondary" && owns(secondaries, id)) { m.secondary = id as SecondaryId; return "出发副武器已更新"; }
  return "无法执行这项操作";
}
export interface RunBenefits { health: number; cooling: number; recovery: number; attackSpeed: number; weaponDamage: number; medkits: number; capacity: number; energy: number }
export const neutralBenefits = (): RunBenefits => ({ health: 0, cooling: 1, recovery: 1, attackSpeed: 1, weaponDamage: 1, medkits: 0, capacity: 6, energy: 0 });
export function benefits(m: MetaProgress): RunBenefits {
  const b = neutralBenefits();
  b.health = m.training.health * 10;
  b.cooling += m.training.cooling * .08;
  b.recovery += m.training.recovery * .08;
  if (m.installed === "precision") { b.weaponDamage = 1.15; b.attackSpeed = .9; }
  if (m.installed === "vented") { b.weaponDamage = .95; b.cooling += .25; }
  if (m.installed === "rapid") { b.weaponDamage = .9; b.attackSpeed = 1.15; }
  if (m.facilities.includes("infirmary")) b.medkits = 1;
  if (m.facilities.includes("freight")) b.capacity = 8;
  if (m.facilities.includes("generator")) b.energy = 1;
  return b;
}
