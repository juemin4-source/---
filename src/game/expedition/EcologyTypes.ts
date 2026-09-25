import type { EnemyKind } from "../../engine/Enemy";
import type { OrganId, WeaponId, SecondaryId } from "../config";
import type { OrganLoadout } from "../OrganLoadout";
import type { DistrictId } from "./ExpeditionMap";

export type Stage = "juvenile" | "mature" | "apex";
/** Ecology roles: they differ by what they eat and who they attack, not by new bodies. */
export type Role = "scavenger" | "hunter" | "floater";
export type Intent =
  | "idle"
  | "patrol"
  | "investigate"
  | "fightPlayer"
  | "fightCreature"
  | "seekRemains"
  | "consume"
  | "migrate"
  | "roam";
export type NestState = "dormant" | "active" | "swollen" | "collapsed";

export interface EcoCreature {
  id: number;
  name: string;
  role: Role;
  kind: EnemyKind;
  weapon: WeaponId;
  secondary: SecondaryId | null;
  stage: Stage;
  biomass: number;
  x: number;
  y: number;
  district: DistrictId;
  home: string;
  homeDistrict: DistrictId;
  organs: OrganLoadout;
  intent: Intent;
  /** Remaining seconds of the current intent action (consume/predate/migrate). */
  intentTime: number;
  hunger: number;
  target: number | null;
  remainsTarget: number | null;
  migratePath: DistrictId[] | null;
  migrateMotive: string;
  alive: boolean;
  isApex: boolean;
  bornAt: number;
  hp: number;
  maxHp: number;
  /** Set when a live body exists in the near field. */
  near: boolean;
}

export interface Remains {
  id: number;
  x: number;
  y: number;
  district: DistrictId;
  biomass: number;
  organs: Partial<Record<OrganId, number>>;
  age: number;
  ttl: number;
  sourceId: number;
  sourceStage: Stage;
  sourceName: string;
  /** Set while a body is walking over to eat it, so two bodies do not fight over one corpse. */
  claimed?: number;
}

export interface Nest {
  id: string;
  name: string;
  district: DistrictId;
  x: number;
  biomass: number;
  spawnTimer: number;
  state: NestState;
  /** Noise-based alert: nests investigate loud areas instead of waking the whole map. */
  alert: number;
  spawned: number;
}

export type EcoEvent =
  | "nest_spawn"
  | "nest_state"
  | "remains_created"
  | "consume_start"
  | "consume_complete"
  | "enemy_absorb"
  | "enemy_evolve"
  | "enemy_migrate"
  | "enemy_starve"
  | "enemy_killed"
  | "apex_created"
  | "apex_seen"
  | "noise"
  | "district_enter";

export interface EcoLogEntry {
  time: number;
  event: EcoEvent;
  detail: string;
}

export interface EcoMetrics {
  creaturesSpawned: number;
  spawnedByNest: Record<string, number>;
  creatureConsumes: number;
  creatureVsCreatureKills: number;
  starvationDeaths: number;
  matureCreated: number;
  apexCreated: number;
  apexKilled: number;
  maxEnemyUniqueOrgans: number;
  maxEnemyOrganLayers: number;
  maxEnemyBiomass: number;
  peakThreat: number;
  remainsCreated: number;
  absorbedOrgans: number;
}

export const STAGE_BIOMASS: Record<Stage, number> = { juvenile: 0, mature: 12, apex: 34 };
export const stageOf = (biomass: number): Stage =>
  biomass >= STAGE_BIOMASS.apex ? "apex" : biomass >= STAGE_BIOMASS.mature ? "mature" : "juvenile";
export const isAtLeast = (stage: Stage, floor: Stage) => STAGE_BIOMASS[stage] >= STAGE_BIOMASS[floor];
