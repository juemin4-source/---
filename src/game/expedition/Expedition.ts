import { ExpeditionObjectives } from "./ExpeditionObjectives";
import { lootDefs } from "./LootSystem";
import { distance, rayRect, type Rect } from "../../engine/PhysicsHelpers";
import type { Controls } from "../../engine/Player";
import type { Renderer } from "../../engine/Renderer";
import type { Carrier, SliceWorld } from "../SliceWorld";
import type { OrganId } from "../config";
import { SeededRandom } from "./SeededRandom";
import { Ecology, type EcoContext } from "./Ecology";
import { buildGeometry, districtOf, type Geometry } from "./ExpeditionGeometry";
import { buildLootPiles, extractors, extractorPos, shortcutDefs, type Extractor } from "./ExpeditionContent";
import {
  cargoAdd,
  cargoPenalty,
  cargoRemove,
  nextUid,
  freshCargo,
  isBulky,
  type CargoState,
  type LootPile,
} from "./LootSystem";
import {
  freshSearch,
  SEARCH_RANGE,
  stepSearch,
  type SearchInterrupt,
  type SearchState,
} from "./SearchSystem";
import { districtById, type DistrictId } from "./ExpeditionMap";
import type { EcoCreature } from "./EcologyTypes";

export interface ExpeditionMetrics {
  searchesStarted: number;
  searchesCompleted: number;
  searchesInterrupted: number;
  searchSeconds: number;
  lootValueFound: number;
  lootValueExtracted: number;
  lootValueLost: number;
  heavyPicked: number;
  heavyExtracted: number;
  organsAbsorbed: number;
  organsDiscarded: number;
  organsBanned: number;
  organsPacked: number;
  shortcutsOpened: number;
  extractUnlocks: number;
  timeOfFirstMature: number | null;
  timeOfFirstApex: number | null;
  distanceTravelled: number;
  districtTransitions: number;
  maxEnemyUniqueOrgans: number;
  maxEnemyOrganLayers: number;
  peakThreat: number;
  threatAtExtract: number | null;
}

export interface ExtractRequest {
  extractor: Extractor;
  /** True once the player has held E long enough. */
  ready: boolean;
  blocked: string | null;
}

/**
 * One expedition: the map, the ecosystem living on it, and the player's loot/route decisions.
 * Everything time-based in a run lives here, so SliceWorld stays combat orchestration.
 */
export class Expedition {
  objectives: ExpeditionObjectives;
  geometry: Geometry;
  eco: Ecology;
  cargo: CargoState = freshCargo(6);
  piles: LootPile[];
  search: SearchState = freshSearch();
  /** Instant actions own E until released; holding cannot spill into a second action. */
  interactionConsumed = false;
  open = new Set<string>();
  power = false;
  district: DistrictId = "airlock";
  /** Districts the player has actually entered: the map must not scout the run for free. */
  knownDistricts = new Set<DistrictId>(["airlock"]);
  rng: SeededRandom;
  time = 0;
  /** Biomass the player has personally fed into the world (their kills become food). */
  fedBiomass = 0;
  metrics: ExpeditionMetrics = {
    searchesStarted: 0,
    searchesCompleted: 0,
    searchesInterrupted: 0,
    searchSeconds: 0,
    lootValueFound: 0,
    lootValueExtracted: 0,
    lootValueLost: 0,
    heavyPicked: 0,
    heavyExtracted: 0,
    organsAbsorbed: 0,
    organsDiscarded: 0,
    organsBanned: 0,
    organsPacked: 0,
    shortcutsOpened: 0,
    extractUnlocks: 0,
    timeOfFirstMature: null,
    timeOfFirstApex: null,
    distanceTravelled: 0,
    districtTransitions: 0,
    maxEnemyUniqueOrgans: 0,
    maxEnemyOrganLayers: 0,
    peakThreat: 0,
    threatAtExtract: null,
  };
  /** Organs the player refused this run. Only blocks auto-equip; the world is unaffected. */
  banned = new Set<OrganId>();
  /** Carriers currently materialized near the player, keyed by ecology creature id. */
  live = new Map<number, Carrier>();
  events: { time: number; event: string; detail: string }[] = [];
  private liftDirections = new Map<number, number>();
  private liftWaits = new Map<number, number>();
  private lastX: number;
  private lastY: number;
  private searchStartedAt = 0;

  constructor(
    public w: SliceWorld,
    public seed = 1,
    private makeEnemy: (c: EcoCreature, district: DistrictId) => Carrier,
  ) {
    this.objectives = new ExpeditionObjectives(w);
    this.rng = new SeededRandom(seed);
    this.geometry = buildGeometry();
    w.width = this.geometry.size.width;
    w.height = this.geometry.size.height;
    w.platforms = this.geometry.platforms.map((p) => ({ ...p }));
    w.enemies = [];
    // Authored experimental salvage, separate from creature ecology and ordinary loot.
    w.drops = (
      [
        [1090, 1586, "returnMembrane"],
        [1240, 1586, "mirrorEye"],
        [1650, 1586, "split"],
        [2260, 2254, "stitch"],
        [2760, 2254, "polarity"],
        [3000, 2254, "debt"],
        [3500, 1632, "vacuum"],
        [4540, 1656, "corpse"],
        [5100, 1656, "parasite"],
        [4050, 1136, "refract"],
        [6100, 1370, "shell"],
        [6510, 1370, "relocate"],
      ] as [number, number, OrganId][]
    ).map(([x, y, organ]) => ({ id: nextUid(), x, y, organ, stacks: 1 }));
    w.player.x = this.geometry.start.x;
    w.player.y = this.geometry.start.y;
    w.player.boundsWidth = w.width;
    w.player.ladders = this.geometry.ladders.filter((l) => !l.lock);
    this.lastX = w.player.x;
    this.lastY = w.player.y;
    this.eco = new Ecology(seed);
    this.piles = buildLootPiles((c) => this.rng.chance(c));
    const extra: [number, number, DistrictId, string, string[]][] = [
      [1070, 1586, "cargo", "资料架", ["maintenanceBook", "pythonBook"]],
      [1530, 1308, "cargo", "封存书库", ["fusionBook", "medicalBook", "trainingTicket"]],
      [1450, 1586, "cargo", "档案财物", ["batteryCell", "trainingTicket"]],
      [900, 2176, "cargo", "备用电池柜", ["batteryCell", "batteryCell"]],
      [5100, 1656, "cool", "应急医疗柜", ["medicalBook", "trainingTicket"]],
      [4160, 1136, "deep", "聚变燃料柜", ["fuelCell", "fuelCell"]],
      [6400, 1370, "spine", "工业机床", ["machineTool"]],
    ];
    for (const [x, y, district, source, ids] of extra)
      this.piles.push({
        uid: nextUid(),
        x,
        y,
        district,
        source,
        taken: false,
        difficulty: 2.8,
        items: ids.map((id) => ({ uid: nextUid(), def: lootDefs[id], source, district })),
      });
    w.say("九号泵站 · 向右穿过维修工区 · 空格跳跃 / 二段跳 · 器官靠近自动接入");
  }

  // ── queries ─────────────────────────────────────────────────────────────────
  get heavy() {
    return isBulky(this.cargo);
  }
  penalty() {
    return cargoPenalty(this.cargo);
  }
  extractorAt(x: number, y: number): Extractor | null {
    return (
      extractors.find((e) => {
        const p = extractorPos(e);
        return Math.abs(p.x - x) < 90 && Math.abs(p.y - y) < 90;
      }) ?? null
    );
  }
  /** Can this extractor be used right now? Heavy cargo needs the cargo station. */
  extractBlocked(e: Extractor): string | null {
    if (e.needsPower && !this.power) return `${e.name} · 尚未恢复供电`;
    if (this.heavy && !e.cargo) return `${e.name} · 带不走重型货物，需要货运撤离站`;
    return null;
  }
  canEnterNarrow(x: number, y: number) {
    if (!this.heavy) return true;
    return !this.geometry.narrow.some(
      (n: Rect) => Math.abs(n.x - x) < n.w / 2 && Math.abs(n.y - y) < n.h / 2,
    );
  }
  nearestPile(x: number, y: number): LootPile | null {
    return (
      this.piles
        .filter((p) => !p.taken && distance(p, { x, y }) < SEARCH_RANGE)
        .sort((a, b) => distance(a, { x, y }) - distance(b, { x, y }))[0] ?? null
    );
  }
  shortcutAt(x: number, y: number) {
    return (
      shortcutDefs.find((s) => {
        const pos = extractorPos({ ...s, needsPower: false, cargo: false } as unknown as Extractor);
        return Math.abs(pos.x - x) < 80 && Math.abs(pos.y - y) < 80;
      }) ?? null
    );
  }

  // ── player actions ──────────────────────────────────────────────────────────
  /** Loot a completed search into the pack. Returns what was taken, or why it failed. */
  takeLoot(pile: LootPile): { taken: number; blocked: string | null } {
    if (pile.taken) return { taken: 0, blocked: null };
    let taken = 0;
    for (const item of [...pile.items]) {
      if (!cargoAdd(this.cargo, item)) continue;
      pile.items = pile.items.filter((i) => i !== item);
      taken += item.def.value;
      if (item.def.heavy) this.metrics.heavyPicked++;
      this.event("loot_take", `${item.def.name} +${item.def.value}`);
    }
    if (!pile.items.length) pile.taken = true;
    this.metrics.lootValueFound += taken;
    if (this.heavy)
      this.event("heavy_pickup", `负重 ${this.cargo.weight} · 速度 ×${this.penalty().speed.toFixed(2)}`);
    return { taken, blocked: taken ? null : "背包已满：先丢掉一些货物" };
  }
  dropLoot(uid: number) {
    const item = cargoRemove(this.cargo, uid);
    if (!item) return null;
    this.piles.push({
      uid: nextUid(),
      x: this.w.player.x,
      y: this.w.player.y,
      district: this.district,
      source: item.def.name,
      taken: false,
      difficulty: 0,
      items: [item],
    });
    this.event("loot_drop", `${item.def.name} -${item.def.value}`);
    if (item.def.heavy) this.event("heavy_drop", `负重 ${this.cargo.weight}`);
    return item;
  }
  openShortcut(x: number, y: number): string | null {
    const s = this.shortcutAt(x, y);
    if (!s || this.open.has(s.id)) return null;
    this.open.add(s.id);
    for (const gate of this.geometry.gates) if (gate.lock === s.id) this.w.platforms[gate.index].y = -1000;
    this.metrics.shortcutsOpened++;
    if (s.id === "freight-power") {
      this.power = true;
      this.metrics.extractUnlocks++;
      this.event("extract_unlock", "货运撤离站已供电");
    }
    this.event("shortcut_open", `${s.name}`);
    return s.name;
  }
  /** The player dies or gives up: everything carried is lost into the world. */
  loseCargo() {
    this.metrics.lootValueLost += this.cargo.value;
    this.cargo = freshCargo(this.cargo.capacity);
  }

  private event(event: string, detail: string) {
    this.events.push({ time: +this.time.toFixed(1), event, detail });
    if (this.events.length > 3000) this.events.shift();
  }

  // ── per-frame ───────────────────────────────────────────────────────────────
  update(dt: number, c: Controls, interactHeld: boolean, damaged: boolean, attacked: boolean) {
    if (!interactHeld) this.interactionConsumed = false;
    this.time += dt;
    const p = this.w.player;
    p.traversalBlocked = this.heavy;
    p.ladders = this.geometry.ladders.filter((l) => !l.lock || this.open.has(l.lock));
    for (const lift of this.geometry.lifts) {
      const platform = this.w.platforms[lift.index];
      if (!this.power) continue;
      const wait = this.liftWaits.get(lift.index) ?? 0;
      if (wait > 0) {
        this.liftWaits.set(lift.index, wait - dt);
        continue;
      }
      const direction = this.liftDirections.get(lift.index) ?? -1;
      const oldTop = platform.y - platform.h / 2;
      const top = Math.max(lift.top, Math.min(lift.bottom, oldTop + direction * 95 * dt));
      const riding =
        Math.abs(p.x - platform.x) < platform.w / 2 && Math.abs(p.y + p.h / 2 - oldTop) < 4 && p.vy >= 0;
      platform.y = top + platform.h / 2;
      if (riding) {
        p.y += top - oldTop;
        p.vy = 0;
        p.grounded = true;
      }
      if (top === lift.top || top === lift.bottom) {
        this.liftDirections.set(lift.index, -direction);
        this.liftWaits.set(lift.index, 2);
      }
    }
    this.metrics.distanceTravelled += Math.abs(p.x - this.lastX);
    const here = districtOf(p.x, p.y);
    if (here && here !== this.district) {
      this.district = here;
      this.knownDistricts.add(here);
      this.metrics.districtTransitions++;
      this.event("district_enter", here);
      this.w.record("district_enter", here);
    }
    // Heavy cargo cannot squeeze through a narrow passage: this is what forces a route decision.
    if (!this.canEnterNarrow(p.x, p.y)) {
      p.x = this.lastX;
      p.y = this.lastY;
      p.vx = 0;
      p.vy = 0;
      p.dashTime = 0;
      if (this.time - (this.lastBlocked ?? -9) > 1.5) {
        this.lastBlocked = this.time;
        this.w.say("维修井太窄 · 重型货物过不去，绕货运路线");
      }
    }
    this.lastX = p.x;
    this.lastY = p.y;
    // Search.
    const wasSearching = !!this.search.pile;
    const step = stepSearch(
      this.search,
      dt,
      {
        holding: interactHeld && !this.interactionConsumed && this.w.expeditionNearby()?.type === "search",
        canSearch: p.grounded && p.dashTime <= 0 && !c.dash && !c.jump && !this.w.result,
        playerX: p.x,
        playerY: p.y,
        damaged,
        attacked,
      },
      (x, y) => this.nearestPile(x, y),
    );
    if (!wasSearching && this.search.pile) {
      this.metrics.searchesStarted++;
      this.searchStartedAt = this.time;
      this.event("search_start", this.search.pile.source);
    }
    if (step.noise > 0) {
      // Searching is loud, and the ecology hears it. This is the link between greed and danger.
      this.eco.hearNoise({ x: p.x, y: p.y, district: this.district, strength: step.noise });
    }
    if (step.interrupted) {
      this.metrics.searchesInterrupted++;
      this.metrics.searchSeconds += this.time - this.searchStartedAt;
      this.event("search_interrupt", step.interrupted);
    }
    if (step.completed) {
      this.metrics.searchesCompleted++;
      this.metrics.searchSeconds += this.time - this.searchStartedAt;
      this.event(
        "search_complete",
        `${step.completed.source} · ${step.completed.items.map((i) => i.def.name).join("/")}`,
      );
      const r = this.takeLoot(step.completed);
      if (r.blocked) this.w.say(r.blocked);
      else if (r.taken) this.w.say(`搜到 ${r.taken} 价值 · 背包 ${this.cargo.size}/${this.cargo.capacity}`);
    }
    // Organ ban: refuse one organ for the rest of the run (auto-equip only).
    this.syncEcology(dt);
    this.objectives.update(dt);
  }
  private lastBlocked: number | null = null;

  /** Run the offscreen ecology and materialize nearby creatures as real bodies. */
  private syncEcology(dt: number) {
    const w = this.w,
      p = w.player;
    // Combat is authoritative while a body exists. Publish BEFORE the abstract tick.
    for (const [id, body] of this.live) {
      const creature = this.eco.creatures.find((o) => o.id === id);
      if (creature?.alive) this.publishBody(creature, body);
    }
    const ctx: EcoContext = {
      player: { x: p.x, y: p.y, district: this.district },
      open: this.open,
      materialized: new Set(this.live.keys()),
    };
    this.eco.update(dt, ctx);
    // Spawn: a creature near the player becomes a real Carrier, so the same ecology runs whether or
    // not the player is looking at it. Neighbouring districts are included deliberately: the airlock
    // is a safe zone with no nest, so without this the player spawns into an apparently dead world.
    const visible = new Set<DistrictId>([this.district, ...this.eco.adjacent(this.district)]);
    for (const c of this.eco.alive) {
      if (this.live.has(c.id)) continue;
      if (!visible.has(c.district)) continue;
      if (distance(c, p) > 1800) continue;
      const e = this.makeEnemy(c, c.district);
      this.live.set(c.id, e);
      w.enemies.push(e);
    }
    // Despawn: leaving the neighbourhood hands the body back to the simulation, keeping its organs.
    for (const [id, carrier] of [...this.live]) {
      const c = this.eco.creatures.find((o) => o.id === id);
      if (!c || !c.alive) {
        carrier.dead = true;
        this.live.delete(id);
        w.enemies = w.enemies.filter((e) => e !== carrier);
        continue;
      }
      if (!visible.has(c.district) || distance(c, p) > 2200) {
        this.live.delete(id);
        if (!carrier.dead) {
          c.hp = Math.max(1, carrier.hp);
          w.enemies = w.enemies.filter((e) => e !== carrier);
        }
      }
    }
    const t = this.eco.threat();
    if (t > this.metrics.peakThreat) this.metrics.peakThreat = t;
    this.metrics.maxEnemyUniqueOrgans = Math.max(
      this.metrics.maxEnemyUniqueOrgans,
      this.eco.metrics.maxEnemyUniqueOrgans,
    );
    this.metrics.maxEnemyOrganLayers = Math.max(
      this.metrics.maxEnemyOrganLayers,
      this.eco.metrics.maxEnemyOrganLayers,
    );
    if (this.metrics.timeOfFirstMature === null && this.eco.metrics.matureCreated > 0)
      this.metrics.timeOfFirstMature = +this.time.toFixed(1);
    if (this.metrics.timeOfFirstApex === null && this.eco.metrics.apexCreated > 0)
      this.metrics.timeOfFirstApex = +this.time.toFixed(1);
  }

  private publishBody(c: EcoCreature, body: Carrier) {
    c.x = body.x;
    c.y = body.y;
    c.district = districtOf(body.x, body.y) ?? c.district;
    c.hp = body.hp;
    c.maxHp = body.maxHp;
    c.organs = body.organs;
  }

  /** Called before real enemy movement; ecology may steer, but never teleports the body. */
  steerBody(body: Carrier, dt: number, fighting: boolean): number | null {
    const id = this.w.ecoIds.get(body);
    const c = this.eco.creatures.find((o) => o.id === id);
    if (!c?.alive) return null;
    this.publishBody(c, body);
    const hunt =
      !fighting && body.stun <= 0 && body.frozen <= 0 && body.staggered <= 0
        ? this.creatureCombat(c, body, dt)
        : null;
    if (fighting) this.hunts.delete(c.id);
    const target =
      hunt ??
      this.eco.physicalIntent(c, dt, fighting, (r) => Math.abs(r.y - body.y) < 70 && this.clearLine(body, r));
    body.hp = c.hp;
    body.maxHp = c.maxHp;
    body.organs = c.organs;
    body.weapon = c.weapon;
    body.secondary = c.secondary;
    const poise = c.stage === "apex" ? 82 : c.stage === "mature" ? 48 : 30;
    if (body.maxPoise !== poise) {
      body.maxPoise = poise;
      body.poise = Math.min(poise, body.poise + 18);
    }
    return target;
  }

  private killsForSalvage = 0;
  salvage(body: Carrier, id?: number): [OrganId, number][] {
    const c = this.eco.creatures.find((c) => c.id === id);
    this.killsForSalvage++;
    const budget =
      c?.stage === "apex"
        ? 3
        : c?.stage === "mature"
          ? 2
          : this.killsForSalvage <= 3 || this.killsForSalvage % 3 === 0
            ? 1
            : 0;
    // Damaged layers remain ecological food; recover only a few intact organs, never an entire stack.
    const result = body.organs
      .entries()
      .slice(0, budget)
      .map(([organ]) => [organ, 1] as [OrganId, number]);
    this.event("organ_salvage", `${c?.name ?? body.id}: ${result.map(([o]) => o).join(",") || "无完整器官"}`);
    return result;
  }
  mayPursue(body: Carrier) {
    const c = this.eco.creatures.find((c) => c.id === this.w.ecoIds.get(body));
    if (!c) return true;
    if (this.district === "airlock" || this.district === "cool") return false;
    const leash = c.stage === "apex" ? 2200 : c.stage === "mature" ? 1600 : 1100;
    return Math.abs(body.x - (c.anchorX ?? body.x)) < leash;
  }
  private hunts = new Map<number, { prey: number; windup: number; recovery: number }>();
  private clearLine(a: { x: number; y: number }, b: { x: number; y: number }) {
    return !this.w.platforms.some((p) => !p.oneWay && rayRect(a.x, a.y, b.x - a.x, b.y - a.y, p, 2) !== null);
  }
  /** Nearby predators actually approach and strike a physical body. No player damage/proc credit. */
  private creatureCombat(c: EcoCreature, body: Carrier, dt: number): number | null {
    const fleeing = [...this.hunts.entries()].find(([id, h]) => h.prey === c.id && this.live.has(id));
    if (fleeing && c.role === "scavenger") {
      const attacker = this.live.get(fleeing[0])!;
      if (distance(attacker, body) < 180 && this.clearLine(attacker, body)) {
        c.intent = "roam";
        return body.x + Math.sign(body.x - attacker.x || 1) * 100;
      }
    }
    if (c.role !== "hunter" || c.intent === "consume") return null;
    let hunt = this.hunts.get(c.id);
    if (!hunt && c.hunger >= 0.65) {
      const prey = this.eco.alive.find(
        (o) =>
          o.id !== c.id &&
          o.home !== c.home &&
          o.role === "scavenger" &&
          o.stage !== "apex" &&
          this.live.has(o.id) &&
          !this.live.get(o.id)!.dead &&
          Math.abs(o.y - body.y) < 55 &&
          distance(o, body) < 340 &&
          this.clearLine(body, this.live.get(o.id)!),
      );
      if (prey) {
        hunt = { prey: prey.id, windup: 0.5, recovery: 0 };
        this.hunts.set(c.id, hunt);
      }
    }
    if (!hunt) return null;
    const prey = this.eco.alive.find((o) => o.id === hunt!.prey),
      target = this.live.get(hunt.prey);
    if (!prey || !target || target.dead || distance(target, body) > 550 || !this.clearLine(body, target)) {
      this.hunts.delete(c.id);
      c.intent = "patrol";
      return null;
    }
    c.intent = "fightCreature";
    c.target = prey.id;
    hunt.recovery = Math.max(0, hunt.recovery - dt);
    if (distance(body, target) > 100) {
      hunt.windup = 0.5;
      return target.x;
    }
    if (hunt.recovery > 0) return target.x;
    hunt.windup -= dt;
    if (hunt.windup <= 0) {
      const damage = (22 + Math.min(14, c.organs.totalLayers * 2)) / (1 + 0.12 * prey.organs.count("armor"));
      target.hp = Math.max(0, target.hp - damage);
      target.flash = 0.16;
      target.impulseX = Math.sign(target.x - body.x || 1) * 90;
      prey.hp = target.hp;
      prey.x = target.x;
      prey.y = target.y;
      this.w.juice.beat("wallSlam", target.x, target.y, 0xd1a86d);
      hunt.windup = 0.5;
      hunt.recovery = 0.7;
      if (target.hp <= 0) {
        c.biomass = Math.min(90, c.biomass + 2.5 + prey.biomass * 0.22);
        this.eco.refreshStats(c);
        this.eco.kill(prey, c.name, "creature");
        target.dead = true;
        this.hunts.delete(c.id);
        c.intent = "seekRemains";
        c.target = null;
        // Growth is earned by stopping to eat the resulting remains.
      }
    }
    return body.x;
  }

  /** A creature died at the player's hands: it becomes food, which is what feeds the world. */
  onEnemyKilled(carrier: Carrier, ecoId: number) {
    const c = this.eco.creatures.find((o) => o.id === ecoId);
    if (c && c.alive) {
      this.publishBody(c, carrier);
      this.fedBiomass += c.biomass;
      this.eco.kill(c, "player", "player");
    }
    this.live.delete(ecoId);
    this.w.enemies = this.w.enemies.filter((e) => e !== carrier);
  }

  summary() {
    const t = this.eco.snapshot();
    return {
      threatAtExtract: this.metrics.threatAtExtract,
      peakThreat: +this.metrics.peakThreat.toFixed(2),
      matured: this.eco.metrics.matureCreated,
      apexCreated: this.eco.metrics.apexCreated,
      apexKilled: this.eco.metrics.apexKilled,
      creatureKills: this.eco.metrics.creatureVsCreatureKills,
      threatLabel: t.threatLabel,
    };
  }
  render(art: Renderer) {
    this.objectives.render(art);
    const g = art.g;
    for (const l of this.geometry.ladders) {
      if (l.lock && !this.open.has(l.lock)) continue;
      g.lineStyle(4, 0x647989);
      g.lineBetween(l.x - 15, l.top - 35, l.x - 15, l.bottom);
      g.lineBetween(l.x + 15, l.top - 35, l.x + 15, l.bottom);
      g.lineStyle(3, 0xa2a9a4);
      for (let y = l.top - 24; y < l.bottom; y += 22) g.lineBetween(l.x - 15, y, l.x + 15, y);
    }
    for (const lift of this.geometry.lifts) {
      const r = this.w.platforms[lift.index];
      g.lineStyle(2, 0x687d88, 0.7);
      g.lineBetween(r.x - 40, lift.top, r.x - 40, lift.bottom);
      g.lineBetween(r.x + 40, lift.top, r.x + 40, lift.bottom);
      art.label(
        `lift-${lift.index}`,
        r.x - 46,
        r.y - 40,
        this.power ? "货梯 · 自动往返" : "货梯 · 等待供电",
        "#d3c59b",
        11,
      );
    }
    for (const nest of this.eco.nests) {
      const y = districtById[nest.district].floor - 16;
      g.fillStyle(0x4c5750, 0.9);
      g.fillEllipse(nest.x, y, 56, 20);
      g.lineStyle(2, 0xa9c69b, 0.65);
      g.strokeCircle(nest.x, y - 10, 12 + Math.sin(this.time * 2) * 2);
      art.label(`nest-${nest.id}`, nest.x - 30, y + 12, nest.name, "#a9c69b", 11);
    }
    // Food and intentions belong to the ordinary world view, not only F3.
    for (const r of this.eco.remains) {
      g.fillStyle(0xb6a588, 0.65);
      g.fillRect(r.x - 15, r.y + 4, 30, 8);
      g.lineStyle(2, 0xd5b47c, 0.7);
      g.lineBetween(r.x - 11, r.y, r.x + 8, r.y + 8);
    }
    for (const c of this.eco.alive) {
      const body = this.live.get(c.id);
      if (!body) continue;
      const word =
        c.intent === "consume"
          ? "吞噬中"
          : c.intent === "seekRemains"
            ? "寻找尸骸"
            : c.intent === "fightCreature"
              ? "捕猎"
              : "";
      if (c.stage !== "juvenile") {
        const color = c.stage === "apex" ? "#ff947c" : "#edcb88";
        art.label(
          `eco-stage-${c.id}`,
          body.x - 45,
          body.y - body.h / 2 - 85,
          `${c.stage === "apex" ? "APEX" : "成熟精英"} · ${c.name} · ${c.organs.totalLayers} 层`,
          color,
          12,
        );
        g.lineStyle(2, c.stage === "apex" ? 0xff947c : 0xedcb88, 0.8);
        g.strokeCircle(body.x, body.y, body.w / 2 + 10);
      }
      if (word) art.label(`eco-intent-${c.id}`, body.x - 24, body.y - body.h / 2 - 30, word, "#d5b47c", 11);
      if (c.intent === "consume") {
        const pulse = 15 + Math.sin(this.time * 8) * 3;
        g.lineStyle(2, 0xd5b47c, 0.6);
        g.strokeCircle(body.x, body.y, pulse);
      }
    }
    for (const gate of this.geometry.gates)
      if (!this.open.has(gate.lock)) {
        const r = this.w.platforms[gate.index];
        g.fillStyle(0xc39155, 1);
        g.fillRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h);
      }
    // Search piles: a small marker that changes colour with difficulty.
    for (const p of this.piles) {
      if (p.taken) continue;
      const col = p.difficulty > 4 ? 0xff8f9b : p.difficulty > 2.6 ? 0xffd27d : 0x9cd8cb;
      g.fillStyle(col, 0.75);
      g.fillRect(p.x - 9, p.y - 16, 18, 16);
      art.label(`pile-${p.uid}`, p.x - 20, p.y - 30, p.source, "#cfe8ff", 12);
    }
    // Extractors and shortcuts.
    for (const e of extractors) {
      const p = extractorPos(e);
      const ok = !this.extractBlocked(e);
      g.fillStyle(ok ? 0x8ef0c0 : 0x6b7280, 0.8);
      g.fillRect(p.x - 22, p.y - 46, 44, 46);
      art.label(
        `fx-${e.id}`,
        p.x - 30,
        p.y - 62,
        `${e.name}${ok ? "" : " ✕"}`,
        ok ? "#8ef0c0" : "#9aa4b2",
        12,
      );
    }
    for (const s of shortcutDefs) {
      const p = extractorPos({ ...s, needsPower: false, cargo: false } as unknown as Extractor);
      const done = this.open.has(s.id);
      g.fillStyle(done ? 0x8ef0c0 : 0xffd27d, 0.7);
      g.fillRect(p.x - 8, p.y - 20, 16, 20);
      art.label(
        `sc-${s.id}`,
        p.x - 40,
        p.y - 34,
        done ? `${s.name} 已开` : `E ${s.name}`,
        done ? "#8ef0c0" : "#ffd27d",
        12,
      );
    }
    // Search progress ring.
    if (this.search.pile) {
      const p = this.search.pile;
      g.lineStyle(3, 0xffd27d, 0.95);
      g.strokeCircle(p.x, p.y - 8, 26);
      g.lineStyle(3, 0xfff3d0, 1);
      g.beginPath();
      g.arc(p.x, p.y - 8, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.search.progress);
      g.strokePath();
    }
  }
  tick(interrupted: SearchInterrupt) {
    void interrupted;
  }
}
