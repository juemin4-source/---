import type { MetaAccount } from "./MetaProgression";
import {
  people,
  courses,
  constructions,
  weaponRecipes,
  heroes,
  partners,
  branches,
  type PersonId,
  type Profession,
  type HeroId,
  type PartnerId,
} from "./CampaignContent";
import { organIds, organs } from "../config";
export interface Resident {
  id: PersonId;
  profession: Profession;
  knowledge: string[];
  studying: keyof typeof courses | null;
}
export interface CampaignProgress {
  residents: Resident[];
  built: string[];
  stars: string[];
  samples: string[];
  ownedWeapons: string[];
  reinforcement: Record<string, number>;
  hero: HeroId;
  partner: PartnerId;
  points: number;
  trees: Record<HeroId, keyof typeof branches | null>;
  skillUses: Record<HeroId, number>;
  skillLevel: Record<HeroId, number>;
  interface: string | null;
  supplies: number;
}
export const freshCampaign = (): CampaignProgress => ({
  residents: [],
  built: [],
  stars: [],
  samples: [],
  ownedWeapons: ["handgun", "dagger", "shield", "grenade"],
  reinforcement: {},
  hero: "meng",
  partner: "none",
  points: 0,
  trees: { meng: null, rabbit: null },
  skillUses: { meng: 0, rabbit: 0 },
  skillLevel: { meng: 0, rabbit: 0 },
  interface: null,
  supplies: 0,
});
const own = (o: object, k: unknown): k is string => typeof k === "string" && Object.hasOwn(o, k);
const n = (v: unknown, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;
export function parseCampaign(raw: unknown): CampaignProgress {
  const p = freshCampaign();
  if (!raw || typeof raw !== "object") return p;
  const r = raw as Record<string, unknown>;
  for (const k of ["built", "stars", "samples", "ownedWeapons"] as const)
    if (Array.isArray(r[k]))
      p[k] = [...new Set((r[k] as unknown[]).filter((v): v is string => typeof v === "string"))].filter(
        (id) =>
          k === "built"
            ? own(constructions, id)
            : k === "samples"
              ? organIds.includes(id as (typeof organIds)[number])
              : k === "stars"
                ? /^star-[1-3]$/.test(id)
                : ["handgun", "dagger", "shield", "grenade", ...Object.keys(weaponRecipes)].includes(id),
      );
  p.ownedWeapons = [...new Set([...freshCampaign().ownedWeapons, ...p.ownedWeapons])];
  if (Array.isArray(r.residents))
    for (const row of r.residents.slice(0, 8)) {
      if (!row || !own(people, row.id) || p.residents.some((a) => a.id === row.id)) continue;
      const valid = ["resident", "mechanic", "scientist", "doctor", "engineer", "merchant", "instructor"];
      p.residents.push({
        id: row.id as PersonId,
        profession: valid.includes(row.profession) ? row.profession : people[row.id as PersonId].profession,
        knowledge: Array.isArray(row.knowledge) ? row.knowledge.filter((v: unknown) => own(courses, v)) : [],
        studying: own(courses, row.studying) ? (row.studying as keyof typeof courses) : null,
      });
    }
  if (own(heroes, r.hero)) p.hero = r.hero as HeroId;
  if (own(partners, r.partner)) p.partner = r.partner as PartnerId;
  for (const h of ["meng", "rabbit"] as const) {
    const trees = r.trees as Record<string, unknown> | undefined;
    if (trees && own(branches, trees[h])) p.trees[h] = trees[h] as keyof typeof branches;
    p.skillUses[h] = n((r.skillUses as Record<string, unknown> | undefined)?.[h], 100000);
    p.skillLevel[h] = n((r.skillLevel as Record<string, unknown> | undefined)?.[h], 2);
  }
  if (r.reinforcement && typeof r.reinforcement === "object")
    for (const id of p.ownedWeapons)
      p.reinforcement[id] = n((r.reinforcement as Record<string, unknown>)[id], 3);
  p.points = n(r.points, 99);
  p.supplies = n(r.supplies, 9);
  if (typeof r.interface === "string" && p.samples.includes(r.interface)) p.interface = r.interface;
  return p;
}
export function hasWorker(a: MetaAccount, role: string) {
  return a.meta.campaign.residents.some(
    (p) =>
      role === "resident" ||
      p.profession === role ||
      people[p.id].profession === role ||
      p.knowledge.some((k) => courses[k as keyof typeof courses]?.profession === role),
  );
}
function pay(a: MetaAccount, coins: number, needs: Record<string, number>) {
  if (a.bank < coins || Object.entries(needs).some(([id, c]) => (a.meta.warehouse[id] ?? 0) < c))
    return false;
  a.bank -= coins;
  for (const [id, c] of Object.entries(needs)) a.meta.warehouse[id] -= c;
  return true;
}
export function finishEducation(a: MetaAccount) {
  for (const p of a.meta.campaign.residents)
    if (p.studying) {
      p.knowledge.push(p.studying);
      p.profession = courses[p.studying].profession;
      p.studying = null;
    }
}
export function campaignAction(a: MetaAccount, action: string, id: string): string | null {
  const p = a.meta.campaign;
  if (action === "construct" && own(constructions, id)) {
    const c = constructions[id as keyof typeof constructions];
    if (p.built.includes(id)) return "工程已经完成";
    if (!hasWorker(a, c.worker)) return `需要救回或培养对应职业人员`;
    if (!pay(a, c.cost, c.needs)) return "金币或工程材料不足";
    p.built.push(id);
    return `${c.name}完成`;
  }
  if (action === "refine") {
    if (!p.built.includes("refinery")) return "先建材料提炼台";
    const recipe =
      id === "batteryCell"
        ? { from: "batteryCell", to: "lithium", amount: 2 }
        : id === "fuelCell"
          ? { from: "fuelCell", to: "deuterium", amount: 1 }
          : null;
    if (!recipe || !pay(a, 0, { [recipe.from]: 1 })) return "缺少待处理物品";
    a.meta.warehouse[recipe.to] = (a.meta.warehouse[recipe.to] ?? 0) + recipe.amount;
    return "材料提炼完成";
  }
  if (action === "learn") {
    const [person, course] = id.split(":");
    const resident = p.residents.find((r) => r.id === person);
    if (!resident || !own(courses, course) || !p.built.includes("academy")) return "需要居民和知识学习室";
    const c = courses[course as keyof typeof courses];
    if (resident.studying || resident.knowledge.includes(course)) return "正在学习或已经掌握";
    if (c.prerequisite && !resident.knowledge.includes(c.prerequisite)) return "先学习机械维修";
    if (!pay(a, 0, { [c.book]: 1 })) return "缺少对应书籍";
    resident.studying = course as keyof typeof courses;
    return "开始学习：下一次持续至少一分钟的出行结算后完成";
  }
  if (action === "manufacture" && own(weaponRecipes, id)) {
    if (p.ownedWeapons.includes(id)) return "武器已经制造";
    if (!hasWorker(a, "mechanic")) return "需要机械师";
    const r = weaponRecipes[id as keyof typeof weaponRecipes];
    if (!pay(a, r.cost, r.needs)) return "金币或制造材料不足";
    p.ownedWeapons.push(id);
    return "武器制造完成，永久可选";
  }
  if (action === "reinforce") {
    if (!p.ownedWeapons.includes(id) || !hasWorker(a, "mechanic")) return "需要已制造武器与机械师";
    const level = p.reinforcement[id] ?? 0;
    if (level >= 3) return "已经强化至上限";
    if (level === 2 && !p.built.includes("machining")) return "第三级强化需要精密加工工坊和大型机床";
    if (!pay(a, 25 * (level + 1), { lithium: level + 1 })) return "金币或锂不足";
    p.reinforcement[id] = level + 1;
    return "强化完成，每级基础威力 +5%";
  }
  if (action === "organ-research" && organIds.includes(id as (typeof organIds)[number])) {
    if (!p.built.includes("laboratory")) return "需要器官研究站";
    if (p.samples.includes(id)) return "已经研究此结构";
    if (!pay(a, 35, { [`sample-${id}`]: 1 })) return "需要封装样本和 35 金币";
    p.samples.push(id);
    return `${organs[id as (typeof organIds)[number]].name}结构已解析，可选择武器接口`;
  }
  if (action === "interface") {
    if (id === "none") p.interface = null;
    else if (p.samples.includes(id)) p.interface = id;
    else return "尚未研究";
    return "结构接口已选择；它提供有限武器参数收益，不继承器官层数";
  }
  if (action === "hero" && own(heroes, id)) {
    p.hero = id as HeroId;
    return "出发角色已选择";
  }
  if (action === "partner" && own(partners, id)) {
    if (id !== "none" && p.residents.length < 1) return "先完成一次人员救援，建立支援联络";
    p.partner = id as PartnerId;
    return "本趟支援已选择";
  }
  if (action === "special-training") {
    if (!pay(a, 30, { trainingTicket: 1 })) return "需要 30 金币与特训券";
    p.points++;
    return "获得 1 养成点，在技能分支中投入";
  }
  if (action === "branch" && own(branches, id)) {
    if (p.trees[p.hero]) return "已有分支，先重置再选择";
    if (p.points < 1) return "需要 1 养成点";
    p.points--;
    p.trees[p.hero] = id as keyof typeof branches;
    return "互斥分支已选择";
  }
  if (action === "reset-branch") {
    if (p.trees[p.hero]) {
      p.points++;
      p.trees[p.hero] = null;
    }
    return "已重置并返还养成点";
  }
  if (action === "skill-upgrade") {
    const level = p.skillLevel[p.hero];
    if (level >= 2) return "技能已达上限";
    if (p.skillUses[p.hero] < (level + 1) * 3)
      return "需要更多有效技能使用：孟章完成复演；房日兔在技能期间过热输出";
    p.skillLevel[p.hero]++;
    return "技能升级完成，冷却与持续时间改善";
  }
  if (action === "buy") {
    const price: Record<string, number> = {
      trainingTicket: 25,
      batteryCell: 20,
      medicalBook: 45,
      pythonBook: 55,
      maintenanceBook: 35,
    };
    if (id === "medkit") {
      if (p.supplies >= 9) return "医疗包储备已满（9 个）";
      if (!pay(a, 15, {})) return "金币不足";
      p.supplies++;
      return "购买医疗包，下次出发携带（最多额外 2 个）";
    }
    if (!(id in price) || !pay(a, price[id], {})) return "金币不足";
    a.meta.warehouse[id] = (a.meta.warehouse[id] ?? 0) + 1;
    return "物品已购入仓库";
  }
  return null;
}
