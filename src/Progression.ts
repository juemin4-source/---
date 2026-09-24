export const resourceNames = {
  material: "星骸材料",
  core: "稳定核心",
  data: "数据碎片",
} as const;
export type Resource = keyof typeof resourceNames;
export type Cargo = Record<Resource, number>;
export const emptyCargo = (): Cargo => ({ material: 0, core: 0, data: 0 });
export type Upgrade = "health" | "weapon" | "phase";
export const upgrades: Record<
  Upgrade,
  { name: string; description: string; cost: Cargo }
> = {
  health: {
    name: "生命支撑",
    description: "基础生命 100 → 125",
    cost: { material: 18, core: 0, data: 0 },
  },
  weapon: {
    name: "昼光校准",
    description: "射击间隔 0.19 → 0.175 秒 · 单发伤害 8 → 9",
    cost: { material: 24, core: 1, data: 0 },
  },
  phase: {
    name: "第四条链路",
    description: "同时维持的定相模块 3 → 4",
    cost: { material: 30, core: 2, data: 3 },
  },
};
export interface RunRecord {
  outcome: "extracted" | "rescued" | "interrupted";
  cargo: Cargo;
  banked: Cargo;
  lost: Cargo;
  seconds: number;
  activity: number;
  route: string[];
  detached: number;
  phased: number;
  seed: number;
  build?: string[];
  findings?: string[];
  escort?: boolean;
}
export interface ActiveRecord {
  cargo: Cargo;
  seconds: number;
  activity: number;
  route: string[];
  detached: number;
  phased: number;
  seed: number;
  build?: string[];
  findings?: string[];
  escort?: boolean;
}
export interface Profile {
  version: 1;
  bank: Cargo;
  upgrades: Record<Upgrade, boolean>;
  sorties: number;
  history: RunRecord[];
  active: ActiveRecord | null;
  discoveries: string[];
  residents: string[];
  shortcuts: string[];
}
export const newProfile = (): Profile => ({
  version: 1,
  bank: emptyCargo(),
  upgrades: { health: false, weapon: false, phase: false },
  sorties: 0,
  history: [],
  active: null,
  discoveries: [],
  residents: [],
  shortcuts: [],
});
export const total = (cargo: Cargo) => cargo.material + cargo.core + cargo.data;
export function canUpgrade(p: Profile, key: Upgrade) {
  return (
    !p.upgrades[key] &&
    (Object.keys(resourceNames) as Resource[]).every(
      (k) => p.bank[k] >= upgrades[key].cost[k],
    )
  );
}
export function buyUpgrade(p: Profile, key: Upgrade) {
  if (!canUpgrade(p, key)) return false;
  for (const k of Object.keys(resourceNames) as Resource[])
    p.bank[k] -= upgrades[key].cost[k];
  p.upgrades[key] = true;
  return true;
}
// Small stacks get rounding protection: each nonempty resource retains at least one.
export function settle(
  p: Profile,
  run: ActiveRecord,
  outcome: RunRecord["outcome"],
): RunRecord {
  const banked = emptyCargo(),
    lost = emptyCargo();
  for (const k of Object.keys(resourceNames) as Resource[]) {
    banked[k] =
      outcome === "extracted" ? run.cargo[k] : Math.ceil(run.cargo[k] * 0.3);
    lost[k] = run.cargo[k] - banked[k];
    p.bank[k] += banked[k];
  }
  const record: RunRecord = {
    ...run,
    cargo: { ...run.cargo },
    route: [...run.route],
    outcome,
    banked,
    lost,
    build: cleanIds(run.build, ["thruster", "gun", "shield", "grapple"]),
    findings: cleanIds(run.findings, discoveryIds),
    escort: run.escort === true,
  };
  // A field sighting is not a city memory until it returns through extraction.
  if (outcome === "extracted") {
    p.discoveries = cleanIds(
      [...(p.discoveries ?? []), ...record.findings!],
      discoveryIds,
    );
    if (record.escort)
      p.residents = cleanIds([...(p.residents ?? []), "engineer"], residentIds);
  }
  p.history = [record, ...p.history].slice(0, 12);
  p.active = null;
  return record;
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const SAVE_KEY = "black-sun-expedition-v1";
export const discoveryIds = ["dawn-lens", "roots", "outward-scar"] as const;
export const residentIds = ["engineer"] as const;
function cleanIds(value: unknown, allowed: readonly string[]): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter((id) => typeof id === "string" && allowed.includes(id)),
    ),
  ];
}
function cleanCargo(value: unknown): Cargo {
  const obj = value as Partial<Cargo> | null,
    result = emptyCargo();
  for (const k of Object.keys(result) as Resource[])
    result[k] = Math.max(
      0,
      Math.min(999999, Math.floor(Number(obj?.[k]) || 0)),
    );
  return result;
}
function cleanActive(value: unknown): ActiveRecord | null {
  if (!value || typeof value !== "object") return null;
  const r = value as ActiveRecord;
  return {
    cargo: cleanCargo(r.cargo),
    seconds: Math.max(0, Number(r.seconds) || 0),
    activity: Math.max(0, Math.min(100, Number(r.activity) || 0)),
    route: Array.isArray(r.route)
      ? r.route.filter((x) => typeof x === "string").slice(0, 100)
      : [],
    detached: Math.max(0, Number(r.detached) || 0),
    phased: Math.max(0, Number(r.phased) || 0),
    seed: Number(r.seed) || 0,
    build: cleanIds(r.build, ["thruster", "gun", "shield", "grapple"]),
    findings: cleanIds(r.findings, discoveryIds),
    escort: r.escort === true,
  };
}
export class ProfileStore {
  available = true;
  constructor(private storage?: StorageLike) {}
  load(): Profile {
    if (!this.storage) return newProfile();
    try {
      const text = this.storage.getItem(SAVE_KEY);
      if (!text) return newProfile();
      const raw = JSON.parse(text);
      if (raw.version !== 1) return newProfile();
      const p = newProfile();
      p.bank = cleanCargo(raw.bank);
      p.sorties = Math.max(0, Math.floor(Number(raw.sorties) || 0));
      // Version 1 remains readable; absent fields are an empty, unrecovered city.
      p.discoveries = cleanIds(raw.discoveries, discoveryIds);
      p.residents = cleanIds(raw.residents, residentIds);
      p.shortcuts = cleanIds(raw.shortcuts, ["S1", "S2", "S3"]);
      for (const k of Object.keys(upgrades) as Upgrade[])
        p.upgrades[k] = raw.upgrades?.[k] === true;
      p.history = Array.isArray(raw.history)
        ? raw.history.slice(0, 12).flatMap((r: RunRecord) => {
            const active = cleanActive(r);
            return active &&
              ["extracted", "rescued", "interrupted"].includes(r.outcome)
              ? [
                  {
                    ...active,
                    outcome: r.outcome,
                    banked: cleanCargo(r.banked),
                    lost: cleanCargo(r.lost),
                  },
                ]
              : [];
          })
        : [];
      p.active = cleanActive(raw.active);
      // Reloading cannot duplicate banked loot or preserve temporary organs. One atomic save.
      if (p.active) {
        settle(p, p.active, "interrupted");
        this.save(p);
      }
      return p;
    } catch {
      this.available = false;
      return newProfile();
    }
  }
  save(profile: Profile) {
    if (!this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(profile));
    } catch {
      this.available = false;
    }
  }
}
