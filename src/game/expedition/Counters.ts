import type { OrganId } from "../config";
import type { OrganLoadout } from "../OrganLoadout";
import type { Role } from "./EcologyTypes";

/**
 * Two nested rock-paper-scissors cycles.
 *
 * Organ archetypes decide a single fight: what a body carries determines what it beats.
 * Creature roles decide the ecosystem: who eats whom, regardless of raw size.
 *
 * The point of both is the same — the weakest participant must have a way to win. A pure
 * "bigger biomass wins" rule is a one-way slope, so it always converges into a single
 * uncontested bully and then goes static. A cycle keeps the world moving.
 */

export type Archetype = "charge" | "chain" | "suppress";

export const ARCHETYPES: Record<Archetype, { name: string; color: string; blurb: string }> = {
  charge: { name: "蓄势", color: "#91d5f1", blurb: "靠积累、护盾与回复越打越强，怕被连续打断" },
  chain: { name: "连锁", color: "#b7a4ed", blurb: "靠速度与标记叠加快速滚雪球，怕控制和冻结" },
  suppress: { name: "压制", color: "#edb76c", blurb: "靠眩晕、冻结与范围爆发一波打死，怕护盾硬吃" },
};

/** Every organ belongs to exactly one archetype. Adding organ #29 means adding it here too. */
export const organArchetype: Record<OrganId, Archetype> = {
  vitality: "charge",
  armor: "charge",
  // 蓄势：积累、护盾、回复
  battery: "charge",
  discharge: "charge",
  leech: "charge",
  shieldBurst: "charge",
  stunRegen: "charge",
  hot: "charge",
  fullRange: "charge",
  coolShield: "charge",
  rage: "charge",
  vent: "charge",
  overflow: "charge",
  // 连锁：速度、标记、传导
  mark: "chain",
  conduit: "chain",
  spread: "chain",
  speed: "chain",
  glass: "chain",
  perfect: "chain",
  airJump: "chain",
  airPower: "chain",
  multi: "chain",
  // 压制：控制、范围、爆发
  ram: "suppress",
  knock: "suppress",
  heavyArea: "suppress",
  freeze: "suppress",
  stunKnock: "suppress",
  vulnerable: "suppress",
  shatter: "suppress",
  slam: "suppress",
};

/** charge → suppress → chain → charge */
export const beats: Record<Archetype, Archetype> = {
  chain: "charge",
  charge: "suppress",
  suppress: "chain",
};
export const counteredBy: Record<Archetype, Archetype> = {
  charge: "chain",
  suppress: "charge",
  chain: "suppress",
};
export const ARCHETYPE_CYCLE: Archetype[] = ["chain", "charge", "suppress"];

/** Damage multiplier when `attacker` strikes `defender`. */
export const ADVANTAGE = 1.5;
export const DISADVANTAGE = 0.7;

export function matchup(attacker: Archetype, defender: Archetype): number {
  if (attacker === defender) return 1;
  return beats[attacker] === defender ? ADVANTAGE : DISADVANTAGE;
}

/** A loadout's archetype is its most-invested one, so stacking really changes what you counter. */
export function dominantArchetype(stacks: Partial<Record<OrganId, number>>): Archetype | null {
  const totals: Record<Archetype, number> = { charge: 0, chain: 0, suppress: 0 };
  for (const [id, n] of Object.entries(stacks) as [OrganId, number][])
    if (organArchetype[id]) totals[organArchetype[id]] += n;
  const best = ARCHETYPE_CYCLE.slice().sort((a, b) => totals[b] - totals[a])[0];
  return totals[best] > 0 ? best : null;
}

// ── ecosystem cycle: who can eat whom ─────────────────────────────────────────
/**
 * scavenger → hunter → floater → scavenger
 * A scavenger out-breeds a hunter by stripping the kills it leaves behind.
 * A hunter out-fights a floater at close range.
 * A floater out-ranges a scavenger, which has no way to close the gap.
 */
export const roleBeats: Record<Role, Role> = {
  scavenger: "hunter",
  hunter: "floater",
  floater: "scavenger",
};
export const roleCounteredBy: Record<Role, Role> = {
  hunter: "scavenger",
  floater: "hunter",
  scavenger: "floater",
};

export const ROLE_INFO: Record<Role, { name: string; color: string; blurb: string }> = {
  scavenger: { name: "腐食者", color: "#9cd8cb", blurb: "吃尸骸最快，克猎人；打不过漂浮者" },
  hunter: { name: "猎人", color: "#f08e91", blurb: "近身追猎最强，克漂浮者；被腐食者拖垮" },
  floater: { name: "漂浮者", color: "#b7a4ed", blurb: "远程悬空压制，克腐食者；被猎人近身" },
};

export function roleAdvantage(attacker: Role, defender: Role): number {
  if (attacker === defender) return 1;
  return roleBeats[attacker] === defender ? ADVANTAGE : DISADVANTAGE;
}

/**
 * Can `attacker` hunt `prey`? Being bigger always helps, but a favourable role matchup lets a
 * smaller body win — that is what stops the biggest creature on the map from going unchallenged.
 */
export function canHunt(attacker: { role: Role; biomass: number }, prey: { role: Role; biomass: number }) {
  if (roleBeats[attacker.role] === prey.role) return true;
  if (roleCounteredBy[attacker.role] === prey.role) return attacker.biomass > prey.biomass * 2.2;
  return attacker.biomass > prey.biomass * 0.8;
}
