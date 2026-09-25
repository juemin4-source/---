import { SeededRandom } from "./SeededRandom";
import { OrganLoadout } from "../OrganLoadout";
import type { OrganId, WeaponId, SecondaryId } from "../config";
import type { EnemyKind } from "../../engine/Enemy";
import { districtById, districts, nestDefs, route, type DistrictId } from "./ExpeditionMap";
import {
  STAGE_BIOMASS,
  isAtLeast,
  stageOf,
  type EcoCreature,
  type EcoEvent,
  type EcoLogEntry,
  type EcoMetrics,
  type Nest,
  type NestState,
  type Remains,
  type Role,
  type Stage,
} from "./EcologyTypes";

export interface EcoContext {
  player: { x: number; y: number; district: DistrictId } | null;
  /** Opened locks: shortcuts, freight power, valves. */
  open: ReadonlySet<string>;
}
export interface NoiseEvent {
  x: number;
  y: number;
  district: DistrictId;
  strength: number;
}

/** Role → body. Ecology reuses the three existing bodies instead of adding new monsters. */
const ROLE_BODY: Record<Role, { kind: EnemyKind; weapon: WeaponId; secondary: SecondaryId | null }> = {
  scavenger: { kind: "crawler", weapon: "dagger", secondary: null },
  hunter: { kind: "reclaimer", weapon: "hammer", secondary: "grenade" },
  floater: { kind: "floater", weapon: "handgun", secondary: null },
};
const BASE_HP: Record<EnemyKind, number> = { crawler: 95, reclaimer: 135, floater: 110, elite: 650 };
/** Stage growth is deliberately restrained: danger comes from organs and behaviour, not HP. */
const STAGE_HP = { juvenile: 1, mature: 1.55, apex: 2.3 };
const STAGE_POISE = { juvenile: 30, mature: 48, apex: 82 };
const STAGE_ORGAN_CAP = { juvenile: 3, mature: 5, apex: 8 };
const NEAR_RADIUS = 1400;
const DISTRICT_POP_CAP = 8;
const GLOBAL_POP_CAP = 48;
const PREDATE_COOLDOWN = 32;
/** Simultaneous apex bodies. Enough to make a return trip dangerous, few enough to stay special. */
const APEX_CAP = 2;
/** Hard ceiling so a long run cannot inflate one body's biomass (and thus HP) without limit. */
const BIOMASS_CEILING = 58;

export class Ecology {
  rng: SeededRandom;
  creatures: EcoCreature[] = [];
  remains: Remains[] = [];
  nests: Nest[] = [];
  time = 0;
  nextCreature = 1;
  nextRemains = 1;
  metrics: EcoMetrics = {
    creaturesSpawned: 0,
    spawnedByNest: {},
    creatureConsumes: 0,
    creatureVsCreatureKills: 0,
    starvationDeaths: 0,
    matureCreated: 0,
    apexCreated: 0,
    apexKilled: 0,
    maxEnemyUniqueOrgans: 0,
    maxEnemyOrganLayers: 0,
    maxEnemyBiomass: 0,
    peakThreat: 0,
    remainsCreated: 0,
    absorbedOrgans: 0,
  };
  log: EcoLogEntry[] = [];
  private acc = 0;
  private lastThreat = 0;

  constructor(public seed = 1) {
    this.rng = new SeededRandom(seed * 7919 + 13);
    this.nests = nestDefs.map((n) => ({
      id: n.id,
      name: n.name,
      district: n.district,
      x: n.x,
      biomass: 4 + Math.floor(this.rng.range(0, 4)),
      spawnTimer: this.rng.range(2, 6),
      state: "dormant" as NestState,
      alert: 0,
      spawned: 0,
    }));
    // Every nest starts with one resident body so the map is never empty on arrival.
    for (const n of this.nests) this.spawn(n, "scavenger");
  }

  // ── creation ────────────────────────────────────────────────────────────────
  spawn(nest: Nest, role?: Role, stage: Stage = "juvenile") {
    if (this.creatures.filter((c) => c.alive).length >= GLOBAL_POP_CAP) return null;
    const def = nestDefs.find((d) => d.id === nest.id)!;
    const chosen = role ?? this.rng.weighted(def.lean);
    const body = ROLE_BODY[chosen];
    const district = districtById[nest.district];
    const c: EcoCreature = {
      id: this.nextCreature,
      name: "",
      role: chosen,
      kind: body.kind,
      weapon: body.weapon,
      secondary: body.secondary,
      stage,
      biomass: STAGE_BIOMASS[stage],
      x: nest.x + this.rng.range(-140, 140),
      y: district.floor - 24,
      district: nest.district,
      home: nest.id,
      homeDistrict: nest.district,
      organs: new OrganLoadout(),
      intent: "patrol",
      intentTime: 0,
      hunger: 0.3,
      target: null,
      remainsTarget: null,
      migratePath: null,
      migrateMotive: "",
      alive: true,
      isApex: stage === "apex",
      bornAt: this.time,
      hp: 0,
      maxHp: 0,
      near: false,
    };
    c.name = `${c.kind}-${String(c.id).padStart(2, "0")}`;
    // Juveniles are weak but never empty-handed: one organ from the nest's pool.
    c.organs.add(this.rng.pick(def.organPool), 1);
    if (stage !== "juvenile") c.organs.add(this.rng.pick(def.organPool), 1);
    this.creatures.push(c);
    this.nextCreature++;
    this.refreshStats(c);
    this.metrics.creaturesSpawned++;
    this.metrics.spawnedByNest[nest.id] = (this.metrics.spawnedByNest[nest.id] ?? 0) + 1;
    this.record("nest_spawn", `${nest.id} → ${c.name} (${c.role})`);
    if (stage === "apex") this.record("apex_created", c.name);
    return c;
  }

  /** Derived combat stats. Recomputed whenever stage or organs change; never scaled by elapsed time. */
  refreshStats(c: EcoCreature) {
    const layers = c.organs.totalLayers;
    const stage: Stage = stageOf(c.biomass);
    if (stage !== c.stage) this.evolve(c, stage);
    c.maxHp = Math.round(BASE_HP[c.kind] * STAGE_HP[c.stage] * (1 + 0.04 * layers));
    c.hp = Math.min(c.maxHp, Math.max(1, c.hp));
    if (c.hp <= 1) c.hp = c.maxHp;
    this.metrics.maxEnemyUniqueOrgans = Math.max(this.metrics.maxEnemyUniqueOrgans, c.organs.uniqueCount);
    this.metrics.maxEnemyOrganLayers = Math.max(this.metrics.maxEnemyOrganLayers, c.organs.totalLayers);
    this.metrics.maxEnemyBiomass = Math.max(this.metrics.maxEnemyBiomass, c.biomass);
  }

  private evolve(c: EcoCreature, stage: Stage) {
    const from = c.stage;
    // The map only supports a couple of true apex bodies at once; extra growth is held back
    // rather than deleted, so it can still mature later if an apex dies.
    if (stage === "apex" && this.alive.filter((o) => o.isApex).length >= APEX_CAP) {
      c.stage = "mature";
      c.biomass = Math.min(c.biomass, STAGE_BIOMASS.apex - 0.5);
      return;
    }
    c.stage = stage;
    if (stage === "mature") this.metrics.matureCreated++;
    if (stage === "apex") {
      c.isApex = true;
      this.metrics.apexCreated++;
      // An apex is a body that grew up here, so it keeps its identity and history.
      this.record("apex_created", `${c.name} · 源自 ${c.home} · ${c.organs.ids().join("+")}`);
    }
    this.record("enemy_evolve", `${c.name} ${from} → ${stage} (biomass ${Math.round(c.biomass)})`);
    c.intentTime = 0;
  }

  kill(c: EcoCreature, killer: string, cause: "player" | "creature" | "starve" = "player") {
    if (!c.alive) return null;
    c.alive = false;
    c.hp = 0;
    if (cause === "starve") {
      this.metrics.starvationDeaths++;
      this.record("enemy_starve", `${c.name} (${killer})`);
    } else {
      this.record("enemy_killed", `${c.name} by ${killer} (${cause})`);
      if (cause === "creature") this.metrics.creatureVsCreatureKills++;
      if (c.isApex) this.metrics.apexKilled++;
    }
    return this.createRemains(c);
  }

  createRemains(c: EcoCreature) {
    const r: Remains = {
      id: this.nextRemains++,
      x: c.x,
      y: c.y + 16,
      district: c.district,
      biomass: Math.max(3, Math.round(3 + c.biomass * 0.3 + c.organs.totalLayers * 1.1)),
      organs: c.organs.toJSON(),
      age: 0,
      ttl: 130 + this.rng.range(0, 50),
      sourceId: c.id,
      sourceStage: c.stage,
      sourceName: c.name,
    };
    this.remains.push(r);
    this.metrics.remainsCreated++;
    this.record("remains_created", `${r.id} ← ${c.name} biomass=${r.biomass}`);
    if (this.remains.length > 90) this.remains.shift();
    return r;
  }

  // ── simulation ──────────────────────────────────────────────────────────────
  update(dt: number, ctx: EcoContext) {
    this.acc += dt;
    this.time += dt;
    const step = 0.5;
    let guard = 0;
    while (this.acc >= step && guard++ < 4000) {
      this.acc -= step;
      this.step(step, ctx);
    }
  }

  /** One low-frequency ecology tick. Identical whether the player is nearby or far away. */
  step(dt: number, ctx: EcoContext) {
    const live = this.creatures.filter((c) => c.alive);
    for (const c of live) {
      const player = ctx.player;
      c.near =
        !!player &&
        Math.hypot(c.x - player.x, c.y - player.y) < NEAR_RADIUS &&
        c.district === player.district;
      c.hunger = Math.min(2.5, c.hunger + dt * 0.012);
      if (c.intentTime > 0) c.intentTime -= dt;
      this.think(c, dt, ctx, live);
    }
    this.rotRemains(dt, ctx);
    this.runNests(dt, ctx);
    // Growth bodies relocate on their own schedule; this is what puts a grown creature on the
    // player's return route instead of leaving every threat parked at its nest.
    this.migrationTimer -= dt;
    if (this.migrationTimer <= 0) {
      this.migrationTimer = 18;
      this.maybeMigrate(ctx);
    }
  }
  private migrationTimer = 12;

  private think(c: EcoCreature, dt: number, ctx: EcoContext, live: EcoCreature[]) {
    const player = ctx.player;
    // 1. Being shot at outranks everything.
    if (c.intent === "fightPlayer" && player && c.district === player.district) {
      this.approach(c, player.x, player.y + 24, 90, dt);
      return;
    }
    // 2. A nearby hostile creature, but never same-nest (that is what stops cannibal wipeouts).
    if (c.intent === "fightCreature" && c.target !== null) {
      const t = live.find((o) => o.id === c.target);
      if (!t || this.rng.chance(0.06)) {
        c.intent = "roam";
        c.target = null;
      } else {
        this.approach(c, t.x, t.y, 80, dt);
        if (Math.hypot(t.x - c.x, t.y - c.y) < 46) {
          t.hp -= 30;
          if (t.hp <= 0) {
            this.kill(t, c.name, "creature");
            // A predator eats what it just killed: this is how biomass climbs the food chain.
            c.intent = "seekRemains";
            c.remainsTarget = null;
            c.intentTime = 0;
          }
        }
        return;
      }
    }
    // 3. Eating: finish what we started.
    if (c.intent === "consume" && c.remainsTarget !== null) {
      const r = this.remains.find((o) => o.id === c.remainsTarget);
      if (!r || (r.claimed !== undefined && r.claimed !== c.id)) {
        c.intent = "seekRemains";
        c.remainsTarget = null;
        return;
      }
      if (Math.hypot(r.x - c.x, r.y - c.y) > 80) {
        this.approach(c, r.x, r.y, c.role === "scavenger" ? 70 : 58, dt);
        return;
      }
      if (c.intentTime > 0) return;
      this.finishConsume(c, r);
      return;
    }
    // 4. Hungry → look for remains. Scavengers do this first and most eagerly.
    if (c.hunger > 0.55 || c.role === "scavenger") {
      const r = this.nearestRemains(c);
      if (r) {
        c.intent = "consume";
        c.remainsTarget = r.id;
        r.claimed = c.id;
        c.intentTime = 1.6 + Math.min(4, r.biomass * 0.12);
        this.record("consume_start", `${c.name} → remains ${r.id}`);
        this.approach(c, r.x, r.y, c.role === "scavenger" ? 70 : 60, dt);
        return;
      }
    }
    // 5. Predation. Each district holds exactly one nest, so requiring a different nest AND the
    //    same district would mean nobody ever hunts anything. Instead: same district (or close by),
    //    and same-nest cannibalism only when the predator is a full stage above and genuinely hungry.
    if (this.canPredate(c) && c.intentTime <= 0) {
      const prey = live
        .filter((o) => {
          if (!o.alive || o === c || o.stage === "apex") return false;
          const sameNest = o.home === c.home;
          // Same-nest cannibalism is allowed only when one body clearly outclasses another and is
          // genuinely hungry. Without this, a district whose colony has wiped out its rival goes
          // permanently static and nothing ever grows up.
          if (sameNest && !(c.biomass > o.biomass * 2.5 && c.hunger > 0.5 && isAtLeast(c.stage, "mature")))
            return false;
          if (!sameNest && c.stage === "juvenile" && o.stage !== "juvenile") return false;
          if (!(o.district === c.district || Math.hypot(o.x - c.x, o.y - c.y) < 420)) return false;
          return o.biomass < c.biomass * 0.8 || o.stage === "juvenile";
        })
        .sort((a, b) => a.biomass - b.biomass)[0];
      if (prey && (c.hunger > 0.7 || c.stage !== "juvenile" || this.rng.chance(0.4))) {
        c.intent = "fightCreature";
        c.target = prey.id;
        c.intentTime = PREDATE_COOLDOWN;
        return;
      }
      if (prey) c.intentTime = 3;
    }
    // 6. Investigate a noise, then go home.
    if (c.intent === "investigate" && c.target !== null) {
      if (Math.hypot(c.x - (c.target as unknown as number), c.y - c.y) < 60) c.intent = "patrol";
      return;
    }
    if (c.intent === "migrate" && c.migratePath && c.migratePath.length > 1) {
      this.stepMigration(c, dt, ctx);
      return;
    }
    // 7. Idle bodies drift back toward their nest, or wander off when grown.
    const home = districtById[c.homeDistrict];
    const leash = c.stage === "juvenile" ? 260 : c.stage === "mature" ? 900 : 2600;
    // Passive feeding: every body grazes its home district. Growth must not depend on finding a
    // corpse, or a district where predation has stopped goes permanently static and nothing matures.
    const nest = this.nests.find((n) => n.id === c.home);
    if (c.district === c.homeDistrict && c.hunger < 1.6) {
      c.biomass = Math.min(
        BIOMASS_CEILING,
        c.biomass + dt * (0.012 + 0.0008 * Math.max(0, nest?.biomass ?? 0)),
      );
      c.hunger = Math.max(0, c.hunger - dt * 0.006);
      if (stageOf(c.biomass) !== c.stage) this.refreshStats(c);
    }
    const anchorX = c.role === "floater" ? c.x : c.homeDistrict === home.id ? c.x : c.x;
    void anchorX;
    if (Math.abs(c.x - this.nestX(c.home)) > leash) this.approach(c, this.nestX(c.home), c.y, 46, dt);
    else if (this.rng.chance(0.5)) {
      c.intent = "roam";
      c.x += this.rng.range(-40, 40);
      c.x = Math.max(home.x + 40, Math.min(home.x + home.w - 40, c.x));
    }
    if (c.role === "floater") c.y = home.floor - 90 - 40 * Math.sin(this.time * 0.4 + c.id);
    else c.y = home.floor - 24;
    // Starvation is a brake on runaway growth, not the main cause of death: it only removes
    // bodies that never found a single meal, and the district population cap does the real work.
    if (c.hunger > 2.0) {
      c.biomass -= 0.004;
      if (c.stage === "juvenile" && c.biomass <= -5) this.kill(c, "hunger", "starve");
    }
  }

  private canPredate(c: EcoCreature) {
    if (c.stage === "juvenile" && c.role !== "hunter") return false;
    return c.role === "hunter" || c.stage !== "juvenile";
  }

  private nestX(homeId: string) {
    return this.nests.find((n) => n.id === homeId)?.x ?? 0;
  }

  private approach(c: EcoCreature, x: number, y: number, speed: number, dt: number) {
    const dx = x - c.x,
      dy = y - c.y,
      d = Math.hypot(dx, dy);
    if (d < 2) return;
    const step = Math.min(d, speed * dt);
    c.x += (dx / d) * step;
    c.y += (dy / d) * step * 0.6;
  }

  private nearestRemains(c: EcoCreature) {
    return this.remains
      .filter(
        (r) =>
          r.district === c.district &&
          // A stale claim from a body that died or moved on must not lock a corpse forever.
          (r.claimed === undefined ||
            r.claimed === c.id ||
            !this.creatures.some((o) => o.id === r.claimed && o.alive && o.remainsTarget === r.id)),
      )
      .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
  }

  private finishConsume(c: EcoCreature, r: Remains) {
    // Growth efficiency falls as a body matures, so biomass does not run away exponentially,
    // but a body that keeps winning fights reliably reaches mature within one expedition.
    const efficiency = c.stage === "juvenile" ? 0.8 : c.stage === "mature" ? 0.5 : 0.3;
    c.biomass = Math.min(BIOMASS_CEILING, c.biomass + r.biomass * efficiency);
    c.hunger = Math.max(0, c.hunger - 1.6);
    this.metrics.creatureConsumes++;
    // A share of every meal stays in the district: this is what makes a busy map grow hostile.
    const nest = this.nests.find((n) => n.district === c.district);
    if (nest) nest.biomass += r.biomass * 0.35;
    const absorbed: OrganId[] = [];
    const gain = c.stage === "juvenile" ? 0.35 : c.stage === "mature" ? 0.5 : 0.6;
    for (const [id, n] of Object.entries(r.organs) as [OrganId, number][]) {
      if (c.organs.uniqueCount >= STAGE_ORGAN_CAP[c.stage] && !c.organs.has(id)) continue;
      if (this.rng.chance(gain))
        for (let i = 0; i < (n ?? 1); i++)
          if (this.rng.chance(gain)) {
            c.organs.add(id);
            absorbed.push(id);
          }
    }
    this.remains = this.remains.filter((o) => o !== r);
    this.record(
      "consume_complete",
      `${c.name} 吞噬 ${r.sourceName} · biomass +${r.biomass}` +
        (absorbed.length ? ` · 吸收 ${absorbed.join("+")}` : " · 未吸收器官"),
    );
    if (absorbed.length) {
      this.metrics.absorbedOrgans += absorbed.length;
      this.record("enemy_absorb", `${c.name} ← ${absorbed.join("+")} (共 ${c.organs.totalLayers} 层)`);
    }
    const before = c.stage;
    this.refreshStats(c);
    if (c.stage !== before) void 0;
    c.intent = "patrol";
    c.remainsTarget = null;
    c.intentTime = 0;
  }

  private rotRemains(dt: number, ctx: EcoContext) {
    for (const r of this.remains) {
      r.age += dt;
      // Unattended remains feed the local nest, which is how a quiet corner gets dangerous.
      if (r.age > r.ttl * 0.5) {
        const nest = this.nests.find((n) => n.district === r.district);
        if (nest) nest.biomass += dt * 0.05;
      }
    }
    const gone = this.remains.filter((r) => r.age >= r.ttl);
    this.remains = this.remains.filter((r) => r.age < r.ttl);
    for (const r of gone) {
      const nest = this.nests.find((n) => n.district === r.district);
      if (nest) nest.biomass += r.biomass * 0.5;
    }
    void ctx;
  }

  private runNests(dt: number, ctx: EcoContext) {
    for (const n of this.nests) {
      const local = this.creatures.filter((c) => c.alive && c.home === n.id).length;
      const next: NestState =
        n.biomass >= 30 ? "swollen" : n.biomass >= 10 ? "active" : n.biomass > -2 ? "dormant" : "collapsed";
      if (next !== n.state) {
        this.record("nest_state", `${n.id} ${n.state} → ${next} (biomass ${n.biomass.toFixed(1)})`);
        n.state = next;
      }
      n.alert = Math.max(0, n.alert - dt * 0.1);
      // Nests accumulate on their own, so a run always drifts toward danger without a timer buff.
      n.biomass += dt * (0.012 + n.alert * 0.004);
      if (n.state === "collapsed") continue;
      n.spawnTimer -= dt;
      if (n.spawnTimer > 0) continue;
      const districtPop = this.creatures.filter((c) => c.alive && c.district === n.district).length;
      const cap = DISTRICT_POP_CAP + (n.state === "swollen" ? 2 : 0);
      const base = n.state === "dormant" ? 14 : 9;
      // A nearby player suppresses breeding: nests do not respawn into an active fight.
      const suppressed = ctx.player && ctx.player.district === n.district ? 1.6 : 1;
      n.spawnTimer = base * suppressed * this.rng.range(0.85, 1.2);
      if (districtPop >= cap) continue;
      const role =
        n.state === "swollen"
          ? this.rng.weighted({ scavenger: 2, hunter: 4, floater: 2 })
          : this.rng.weighted({ scavenger: 5, hunter: 3, floater: 1 });
      const c = this.spawn(n, role);
      if (c) n.spawned++;
    }
  }

  // ── noise ───────────────────────────────────────────────────────────────────
  /** Sound is a world event: nearby bodies investigate, nests get alerted. Returns how many heard. */
  hearNoise(noise: NoiseEvent) {
    this.record("noise", `${noise.district} str=${noise.strength.toFixed(1)}`);
    let heard = 0;
    const radius = 320 + noise.strength * 260;
    for (const c of this.creatures) {
      if (!c.alive || c.district !== noise.district) continue;
      if (Math.hypot(c.x - noise.x, c.y - noise.y) > radius) continue;
      if (c.intent === "fightPlayer" || c.intent === "consume") continue;
      c.intent = "investigate";
      c.target = noise.x as unknown as number;
      heard++;
    }
    const nest = this.nests.find((n) => n.district === noise.district);
    if (nest) nest.alert = Math.min(10, nest.alert + noise.strength * 2);
    return heard;
  }

  // ── migration ───────────────────────────────────────────────────────────────
  /** Mature/Apex bodies relocate along legal links, with a stated motive. Never a teleport onto the player. */
  startMigration(c: EcoCreature, to: DistrictId, motive: string, ctx: EcoContext) {
    if (c.stage === "juvenile") return false;
    const r = route(c.district, to, ctx.open);
    if (!r) return false;
    c.intent = "migrate";
    c.migratePath = r.path;
    c.migrateMotive = motive;
    c.intentTime = r.cost;
    this.record("enemy_migrate", `${c.name} ${c.district} → ${to} · ${motive}`);
    return true;
  }

  private stepMigration(c: EcoCreature, dt: number, ctx: EcoContext) {
    const path = c.migratePath!;
    const nextDistrict = path[1];
    const d = districtById[nextDistrict];
    const tx = d.x + d.w / 2,
      ty = d.floor - 24;
    this.approach(c, tx, ty, c.stage === "apex" ? 62 : 52, dt);
    if (Math.hypot(c.x - tx, c.y - ty) < 70) {
      c.district = nextDistrict;
      path.shift();
      if (path.length <= 1 || c.stage !== "apex") {
        c.migratePath = null;
        c.intent = "patrol";
        this.record("enemy_migrate", `${c.name} 抵达 ${nextDistrict} · ${c.migrateMotive}`);
      }
    }
    void ctx;
  }

  /** Mature and apex bodies occasionally wander toward noise or a weaker district. */
  maybeMigrate(ctx: EcoContext) {
    let moved = 0;
    for (const c of this.creatures) {
      if (!c.alive || c.stage === "juvenile" || c.intent === "migrate") continue;
      if (!this.rng.chance(0.08)) continue;
      const target = this.rng.pick(districts.filter((d) => d.id !== c.district));
      if (this.startMigration(c, target.id, c.stage === "apex" ? "扩张领地" : "追踪食物", ctx)) moved++;
    }
    return moved;
  }

  // ── queries ─────────────────────────────────────────────────────────────────
  get alive() {
    return this.creatures.filter((c) => c.alive);
  }
  get apexes() {
    return this.alive.filter((c) => c.isApex);
  }
  get matured() {
    return this.alive.filter((c) => c.stage === "mature");
  }
  threat() {
    const live = this.alive;
    if (!live.length) return 0;
    const biomass = live.reduce((s, c) => s + c.biomass, 0);
    const layers = live.reduce((s, c) => s + c.organs.totalLayers, 0);
    // Diminishing returns, then a soft saturation: Threat must keep rising through a run but never
    // sit pinned at the maximum, or it stops telling the player anything about the world.
    const raw =
      Math.sqrt(Math.max(0, biomass)) / 6 +
      this.matured.length * 0.4 +
      this.apexes.length * 1.2 +
      Math.sqrt(layers) / 5 +
      this.activeNests * 0.2;
    return Math.max(0, Math.min(5, 5 * (1 - Math.exp(-raw / 3))));
  }
  get activeNests() {
    return this.nests.filter((n) => n.state === "active" || n.state === "swollen").length;
  }
  threatLabel() {
    const t = this.threat();
    return t < 0.5 ? "平静" : t < 1.2 ? "活跃" : t < 2.2 ? "危险" : t < 3.5 ? "失控" : "灾变";
  }
  districtStats() {
    return districts.map((d) => {
      const live = this.alive.filter((c) => c.district === d.id);
      const nests = this.nests.filter((n) => n.district === d.id);
      return {
        id: d.id,
        name: d.name,
        alive: live.length,
        biomass: +live.reduce((s, c) => s + c.biomass, 0).toFixed(1),
        remains: this.remains.filter((r) => r.district === d.id).length,
        mature: live.filter((c) => c.stage === "mature").length,
        apex: live.filter((c) => c.isApex).length,
        layers: live.reduce((s, c) => s + c.organs.totalLayers, 0),
        nests: nests.map((n) => ({ id: n.id, state: n.state, biomass: +n.biomass.toFixed(1) })).length
          ? nests.map((n) => `${n.id}:${n.state}(${n.biomass.toFixed(0)})`).join(" ")
          : "—",
      };
    });
  }
  snapshot() {
    const t = this.threat();
    if (t > this.metrics.peakThreat) this.metrics.peakThreat = t;
    this.lastThreat = t;
    return {
      time: +this.time.toFixed(1),
      threat: +t.toFixed(2),
      threatLabel: this.threatLabel(),
      alive: this.alive.length,
      mature: this.matured.length,
      apex: this.apexes.length,
      remains: this.remains.length,
      activeNests: this.activeNests,
      biomass: +this.alive.reduce((s, c) => s + c.biomass, 0).toFixed(1),
      layers: this.alive.reduce((s, c) => s + c.organs.totalLayers, 0),
      maxUniqueOrgans: this.metrics.maxEnemyUniqueOrgans,
      maxOrganLayers: this.metrics.maxEnemyOrganLayers,
      maxBiomass: +this.metrics.maxEnemyBiomass.toFixed(1),
      districts: this.districtStats(),
      metrics: this.metrics,
      lastThreat: this.lastThreat,
    };
  }
  private record(event: EcoEvent, detail: string) {
    this.log.push({ time: Math.round(this.time * 10) / 10, event, detail });
    if (this.log.length > 4000) this.log.shift();
  }
}
