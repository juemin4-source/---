import type { EcoCreature } from "./EcologyTypes";
import type { WeaponId, SecondaryId, OrganId } from "../config";

export const combatRoles = {
  pursuer: { name: "追猎", weapon: "dagger", secondary: null, organs: ["speed"], color: 0xee9966 },
  gunner: { name: "射手", weapon: "handgun", secondary: null, organs: ["mark"], color: 0xe3ca73 },
  charger: {
    name: "冲锋",
    weapon: "hammer",
    secondary: null,
    organs: ["ram", "battery", "discharge"],
    color: 0xff765c,
  },
  sentinel: {
    name: "盾卫",
    weapon: "hammer",
    secondary: "shield",
    organs: ["armor", "stunKnock", "heavyArea"],
    color: 0x78b9ec,
  },
  sniper: {
    name: "狙击",
    weapon: "sniper",
    secondary: null,
    organs: ["fullRange", "mark", "vulnerable"],
    color: 0xd69aef,
  },
  miner: {
    name: "布雷",
    weapon: "handgun",
    secondary: null,
    organs: ["knock", "heavyArea", "freeze"],
    color: 0xffbb55,
  },
  medic: {
    name: "维修",
    weapon: "rifle",
    secondary: null,
    organs: ["overflow", "coolShield", "speed"],
    color: 0x72dbb2,
  },
} satisfies Record<
  string,
  { name: string; weapon: WeaponId; secondary: SecondaryId | null; organs: OrganId[]; color: number }
>;
export type CombatRole = keyof typeof combatRoles;
export const reinforcementTier = (seconds: number) => Math.min(4, Math.floor(Math.max(0, seconds) / 120));

/** Assigned once at birth: existing creatures never receive a clock-based buff. */
export function equipReinforcement(c: EcoCreature) {
  const tier = reinforcementTier(c.bornAt);
  if (tier === 0) {
    c.combatRole = c.role === "floater" ? "gunner" : c.role === "hunter" ? "charger" : "pursuer";
    c.combatTier = 0;
    return;
  }
  const region = [...c.homeDistrict].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const pools: CombatRole[][] = [
    ["pursuer", "gunner", "charger"],
    ["pursuer", "gunner", "charger", "sentinel", "sniper"],
    ["charger", "sentinel", "sniper", "miner", "medic", "pursuer", "gunner"],
  ];
  const pool = pools[Math.min(2, tier)];
  const role = pool[(c.id + region) % pool.length];
  c.combatRole = role;
  c.combatTier = tier;
  const kit = combatRoles[role];
  c.weapon = kit.weapon;
  c.secondary = kit.secondary;
  // Flying bodies keep ranged kits; ground specialists retain readable locomotion.
  if (role === "charger" || role === "sentinel" || role === "pursuer") c.kind = "reclaimer";
  for (const organ of kit.organs.slice(0, Math.min(3, 1 + Math.floor(tier / 2))))
    if (!c.organs.has(organ)) c.organs.add(organ, 1);
  if (tier >= 2)
    for (const organ of ["vitality", "armor"] as const) {
      if (c.organs.uniqueCount >= 3) break;
      if (!c.organs.has(organ)) c.organs.add(organ, 1);
    }
}
