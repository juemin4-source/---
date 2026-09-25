import { SeededRandom } from "./SeededRandom";
import { canHunt, matchup, roleAdvantage, roleCounteredBy } from "./Counters";
import { OrganLoadout } from "../OrganLoadout";
import type { OrganId, WeaponId, SecondaryId } from "../config";
import type { EnemyKind } from "../../engine/Enemy";
import { districtById, districts, links, nestDefs, route, type DistrictId } from "./ExpeditionMap";
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
/** Apex count is limited by the role cycle, not by a constant. This ceiling only stops biomass
 *  (and therefore HP) inflating without bound in an extremely long run. */
const BIOMASS_CEILING = 90;
/**
 * Biomass reachable by grazing alone. A juvenile that never wins a fight stalls just short of
 * mature; a body must eat corpses (or prey) to grow up. This is what makes ecology growth a
 * consequence of events in the world rather than of elapsed time.
 */
const GRAZE_CAP: Record<Stage, number> = {
  juvenile: STAGE_BIOMASS.mature - 1.5,
  mature: STAGE_BIOMASS.apex - 2,
  apex: BIOMASS_CEILING,
};

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
    deaths: 0,
    spawnedByNest: {},
    creatureConsumes: 0,
    creatureVsCreatureKills: 0,
    starvationDeaths: 0,
    matureCreated: 0,
    apexCreated: 0,
    apexKilled: 0,
    maxEnemyUniqueOrgans: 0,
    maxEnemyOrganLayers: 0,
    stackedBodies: 0,
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
    // Every nest starts with a couple of resident bodies so the map is never empty on arrival.
    for (const n of this.nests) {
      this.spawn(n, "scavenger");
      this.spawn(n);
    }
    // Roamers: bodies not bound to any nest. Nests only exist in five districts, so without these
    // the starting airlock and several other districts are permanently empty and the world reads as
    // dead exactly where the player first looks. Their roles are dealt round-robin rather than
    // rolled, so seeding them cannot tip the role cycle toward whichever role is rolled luckiest.
    let seedRole = 0;
    const seededRoles: Role[] = ["scavenger", "hunter", "floater"];
    for (const d of districts) {
      const here = this.creatures.filter((c) => c.alive && c.district === d.id).length;
      for (let i = here; i < 2; i++) this.spawnRoamer(d.id, seededRoles[seedRole++ % seededRoles.length]);
    }
  }

  /** A nestless body: it wanders its district and can drift to neighbours. */
  spawnRoamer(district: DistrictId, role?: Role, stage: Stage = "juvenile") {
    if (this.creatures.filter((c) => c.alive).length >= GLOBAL_POP_CAP) return null;
    const def = this.rng.pick(nestDefs);
    const chosen = role ?? this.rng.weighted(def.lean);
    const body = ROLE_BODY[chosen];
    const d = districtById[district];
    const c: EcoCreature = {
      id: this.nextCreature,
      name: "",
      role: chosen,
      kind: body.kind,
      weapon: body.weapon,
      secondary: body.secondary,
      stage,
      biomass: STAGE_BIOMASS[stage],
      x: d.x + this.rng.range(60, Math.max(80, d.w - 60)),
      y: d.floor - 24,
      district,
      home: `roam-${district}`,
      homeDistrict: district,
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
    c.organs.add(this.rng.pick(def.organPool), 1);
    if (stage !== "juvenile") c.organs.add(this.rng.pick(def.organPool), 1);
    this.creatures.push(c);
    this.nextCreature++;
    this.refreshStats(c);
    this.metrics.creaturesSpawned++;
    return c;
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
    // Only nest-born bodies grow up. Roamers exist so the map is never empty where the player
    // starts, but an apex must be a real individual with a lineage — letting a wanderer top the
    // food chain would break that, and the apex record says where it came from.
    const stage: Stage = c.home.startsWith("nest-") ? stageOf(c.biomass) : "juvenile";
    if (stage !== c.stage) this.evolve(c, stage);
    c.maxHp = Math.round(BASE_HP[c.kind] * STAGE_HP[c.stage] * (1 + 0.04 * layers));
    c.hp = Math.min(c.maxHp, Math.max(1, c.hp));
    if (c.hp <= 1) c.hp = c.maxHp;
    this.metrics.maxEnemyUniqueOrgans = Math.max(this.metrics.maxEnemyUniqueOrgans, c.organs.uniqueCount);
    this.metrics.maxEnemyOrganLayers = Math.max(this.metrics.maxEnemyOrganLayers, c.organs.totalLayers);
    // Bodies that ever stacked the same organ, counted over the whole run: reading it off the
    // live list is unreliable because deeply stacked bodies are also the ones most likely to die.
    if (c.organs.entries().some(([, n]) => n > 1)) this.metrics.stackedBodies++;
    this.metrics.maxEnemyBiomass = Math.max(this.metrics.maxEnemyBiomass, c.biomass);
  }

  private evolve(c: EcoCreature, stage: Stage) {
    const from = c.stage;
    // No apex cap: the role cycle keeps the top of the food chain contested on its own. A hard
    // limit would be a patch over a rule that was wrong, not a rule.
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
    this.metrics.deaths++;
    if (cause === "starve") {
      this.metrics.starvationDeaths++;
      this.record("enemy_starve", `${c.name} (${killer})`);
    } else {
      this.record("enemy_killed", `${c.name} by ${killer} (${cause})`);
      if (cause === "creature") {
        this.metrics.creatureVsCreatureKills++;
        // Record the role pairing at kill time. Reading it back off the corpses later does not
        // work, because dead bodies are pruned from the list.
        const killerCreature = this.creatures.find((o) => o.name === killer);
        if (killerCreature) {
          const key = `${killerCreature.role}→${c.role}`;
          this.roleKills[key] = (this.roleKills[key] ?? 0) + 1;
          // Organ archetype of the winner, also recorded at kill time. Reconstructing this from
          // the kill log later fails, because a winner that dies afterwards is pruned.
          const arche = killerCreature.organs.dominant() ?? "none";
          this.archetypeKills[arche] = (this.archetypeKills[arche] ?? 0) + 1;
        }
      }
      if (c.isApex) this.metrics.apexKilled++;
    }
    return this.createRemains(c);
  }

  /** Predation tallies by role pairing, e.g. "hunter→floater". Proof the cycle circulates. */
  roleKills: Record<string, number> = {};
  /** Creature kills won by each organ archetype — proof the organ cycle matters in the world. */
  archetypeKills: Record<string, number> = {};

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
    // Dead bodies are removed rather than retained: keeping every corpse forever made a long run
    // grow its creature list without bound, and nothing needs a dead body once its remains exist.
    if (this.creatures.some((c) => !c.alive)) this.creatures = this.creatures.filter((c) => c.alive);
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
    // 2. A creature fight. This is a resolution, not an attrition race: whoever is favoured by the
    //    role cycle wins, and size only decides the upsets. Two properties matter.
    //    First, the loser fights back — previously the target stood still, so whoever attacked
    //    first always won and nothing could ever kill a grown body.
    //    Second, the loser is often driven off rather than killed, so a district keeps a mix of
    //    roles instead of one colony erasing another.
    if (c.intent === "fightCreature" && c.target !== null) {
      const t = live.find((o) => o.id === c.target);
      // `intentTime` is this hunt's remaining patience. A flat per-tick chance of giving up was
      // wrong: nests in one district sit hundreds of pixels apart, so crossing that gap takes many
      // ticks and almost every hunt aborted before contact — which stalled entire seeds.
      if (!t || c.intentTime <= 0) {
        c.intent = "roam";
        c.target = null;
      } else {
        // Cross-district hunts are real journeys: the predator walks the link toward the prey's
        // district and adopts it on arrival, so the food web spans the whole map.
        if (t.district !== c.district) {
          const d = districtById[t.district];
          this.approach(c, d.x + d.w / 2, d.floor - 24, 80, dt);
          if (Math.abs(c.x - (d.x + d.w / 2)) < 90) c.district = t.district;
          return;
        }
        this.approach(c, t.x, t.y, 80, dt);
        if (Math.hypot(t.x - c.x, t.y - c.y) < 46) {
          // Two cycles decide the exchange, and they answer different questions.
          // Role decides whether this hunt was a sensible idea at all (who eats whom).
          // Organ archetype decides how the actual fight goes (whose build beats whose), which is
          // what makes each creature's organs matter to the world and not just to the player.
          const adv = roleAdvantage(c.role, t.role),
            size = c.biomass / Math.max(1, t.biomass);
          const mine = c.organs.dominant(),
            theirs = t.organs.dominant();
          const organ = mine && theirs ? matchup(mine, theirs) : 1;
          // A predator that has picked this fight at all is usually favoured; the matchups decide
          // how lopsided it is. Making the neutral case a coin-flip-or-worse stalled whole seeds,
          // because a healthy colony would stop hunting and the district froze.
          const base = adv > 1 ? 0.8 : adv < 1 ? 0.12 * Math.min(1, size / 2.2) : size > 1.15 ? 0.7 : 0.45;
          const winChance = Math.max(0.04, Math.min(0.95, base * organ));
          if (this.rng.chance(winChance)) {
            // Killing a creature feeds the killer immediately. A corpse on the ground is not
            // enough on its own: predators would win fight after fight and still never grow,
            // because the meal is a separate journey the winner often never completes.
            c.biomass = Math.min(BIOMASS_CEILING, c.biomass + 2.5 + t.biomass * 0.22);
            c.hunger = Math.max(0, c.hunger - 1.2);
            this.refreshStats(c);
            this.kill(t, c.name, "creature");
            // A predator also eats what it killed, so the kill is worth following up.
            c.intent = "seekRemains";
            c.remainsTarget = null;
            c.intentTime = 0;
          } else {
            // Losing costs a FRACTION of max health, not a flat amount. A flat cost meant that
            // charge builds (which stack +max HP organs) survived every lost exchange and came to
            // dominate creature kills, while fragile chain builds died to the first mistake.
            c.hp -= c.maxHp * 0.24 * (adv < 1 ? 1.6 : 1);
            if (c.hp <= 0) this.kill(c, t.name, "creature");
            else {
              c.intent = "roam";
              c.target = null;
              c.intentTime = PREDATE_COOLDOWN;
            }
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
    // 5. Predation along the role cycle (腐食者→猎人→漂浮者→腐食者). A favourable role matchup
    //    lets a smaller body take a bigger one, so no single creature dominates unchallenged.
    //    This replaces a pure "bigger biomass wins" rule, which was a one-way slope: it always
    //    converged on one uncontested bully and then the district went static forever.
    if (c.intentTime <= 0) {
      const prey = live
        .filter((o) => {
          if (!o.alive || o === c || !canHunt(c, o)) return false;
          // An apex is never immune, but only a grown body can bring one down. This is what keeps
          // the top of the food chain contested without a hard apex cap.
          if (o.stage === "apex" && c.stage === "juvenile") return false;
          const sameNest = o.home === c.home;
          // Kin are eaten only by a much larger, hungry relative — otherwise a colony eats itself.
          if (sameNest && !(c.biomass > o.biomass * 2.5 && c.hunger > 0.5 && isAtLeast(c.stage, "mature")))
            return false;
          if (!sameNest && c.stage === "juvenile" && o.stage !== "juvenile") return false;
          // Hunting is possible in your own district and in directly linked ones. Restricting it
          // to a single district meant that only "lower" (the one district holding two nests) ever
          // saw a fight, so two thirds of the map could never grow anything — the food web has to
          // follow the map's own links to cover the whole map.
          return (
            o.district === c.district ||
            this.adjacent(c.district).includes(o.district) ||
            Math.hypot(o.x - c.x, o.y - c.y) < 420
          );
        })
        // The strongest legal meal it can actually beat, not simply the largest body nearby.
        .sort((a, b) => b.biomass - a.biomass)[0];
      if (prey && (c.hunger > 0.7 || c.stage !== "juvenile" || this.rng.chance(0.4))) {
        c.intent = "fightCreature";
        c.target = prey.id;
        // Patience must cover the distance to the prey, or a cross-district hunt expires en route.
        c.intentTime = PREDATE_COOLDOWN + Math.hypot(prey.x - c.x, prey.y - c.y) / 60;
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
    // Grazing alone must never be enough to grow up. A creature's ceiling is set by what it has
    // eaten: a body that only grazes tops out as a big juvenile, and only real kills (corpses and
    // predation) push it past that. Otherwise Apex would appear purely because time passed, which
    // is exactly the "danger comes from a clock" rule this design forbids.
    const nest = this.nests.find((n) => n.id === c.home);
    const grazeCap = GRAZE_CAP[c.stage];
    if (c.district === c.homeDistrict && c.hunger < 1.6 && c.biomass < grazeCap) {
      c.biomass = Math.min(grazeCap, c.biomass + dt * (0.012 + 0.0008 * Math.max(0, nest?.biomass ?? 0)));
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

  private nestX(homeId: string) {
    return this.nests.find((n) => n.id === homeId)?.x ?? 0;
  }

  /** Districts directly reachable from this one, cached — this defines the food web's edges. */
  private adjacentCache = new Map<DistrictId, DistrictId[]>();
  adjacent(id: DistrictId): DistrictId[] {
    const hit = this.adjacentCache.get(id);
    if (hit) return hit;
    const out = links
      .filter((l) => !l.lock && (l.a === id || l.b === id))
      .map((l) => (l.a === id ? l.b : l.a));
    this.adjacentCache.set(id, out);
    return out;
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
      // A body preferentially deepens organs it already has. Without this bias, absorption spread
      // thinly across every organ on the corpse and stacking the SAME organ was rare — but
      // "same organ stacks into a stronger one" is a core promise of the design.
      const deepening = c.organs.has(id) ? Math.min(0.95, gain * 1.8) : gain;
      if (this.rng.chance(deepening))
        for (let i = 0; i < (n ?? 1); i++)
          if (this.rng.chance(deepening)) {
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
      // What a nest breeds responds to what is eating it. If this colony is being hunted by its
      // counter, it leans toward the role that counters that hunter — this feedback is what keeps
      // the cycle circulating instead of letting one role take the district permanently.
      const home = this.alive.filter((c) => c.home === n.id);
      const threat = home.length
        ? (Object.keys(roleCounteredBy) as (keyof typeof roleCounteredBy)[]).reduce(
            (worst, r) => (home.some((c) => c.role === r) ? r : worst),
            "scavenger" as keyof typeof roleCounteredBy,
          )
        : null;
      const answer = threat ? roleCounteredBy[threat] : null;
      const weights: Partial<Record<Role, number>> =
        n.state === "swollen"
          ? {
              scavenger: answer === "scavenger" ? 6 : 2,
              hunter: answer === "hunter" ? 6 : 4,
              floater: answer === "floater" ? 6 : 2,
            }
          : {
              scavenger: answer === "scavenger" ? 7 : 5,
              hunter: answer === "hunter" ? 7 : 3,
              floater: answer === "floater" ? 7 : 1,
            };
      const role = this.rng.weighted(weights);
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
