import { distance, type Rect } from "../../engine/PhysicsHelpers";
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
import { type DistrictId } from "./ExpeditionMap";
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
  geometry: Geometry;
  eco: Ecology;
  cargo: CargoState = freshCargo(6);
  piles: LootPile[];
  search: SearchState = freshSearch();
  open = new Set<string>();
  power = false;
  district: DistrictId = "airlock";
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
  private lastX: number;
  private searchStartedAt = 0;

  constructor(
    public w: SliceWorld,
    public seed = 1,
    private makeEnemy: (c: EcoCreature, district: DistrictId) => Carrier,
  ) {
    this.rng = new SeededRandom(seed);
    this.geometry = buildGeometry();
    w.width = this.geometry.size.width;
    w.height = this.geometry.size.height;
    w.platforms = this.geometry.platforms.map((p) => ({ ...p }));
    w.enemies = [];
    w.drops = [];
    w.player.x = this.geometry.start.x;
    w.player.y = this.geometry.start.y;
    w.player.boundsWidth = w.width;
    this.lastX = w.player.x;
    this.eco = new Ecology(seed);
    this.piles = buildLootPiles((c) => this.rng.chance(c));
    w.say("安全气闸 · 按住 E 搜索 · Tab 看地图 · 勿贪");
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
    this.event("loot_drop", `${item.def.name} -${item.def.value}`);
    if (item.def.heavy) this.event("heavy_drop", `负重 ${this.cargo.weight}`);
    return item;
  }
  openShortcut(x: number, y: number): string | null {
    const s = this.shortcutAt(x, y);
    if (!s || this.open.has(s.id)) return null;
    this.open.add(s.id);
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
    this.time += dt;
    const p = this.w.player;
    this.metrics.distanceTravelled += Math.abs(p.x - this.lastX);
    this.lastX = p.x;
    const here = districtOf(p.x, p.y);
    if (here && here !== this.district) {
      this.district = here;
      this.metrics.districtTransitions++;
      this.event("district_enter", here);
      this.w.record("district_enter", here);
    }
    // Heavy cargo cannot squeeze through a narrow passage: this is what forces a route decision.
    if (!this.canEnterNarrow(p.x, p.y)) {
      p.vx = -Math.sign(p.vx || 1) * 40;
      if (this.time - (this.lastBlocked ?? -9) > 1.5) {
        this.lastBlocked = this.time;
        this.w.say("维修井太窄 · 重型货物过不去，绕货运路线");
      }
    }
    // Search.
    const wasSearching = !!this.search.pile;
    const step = stepSearch(
      this.search,
      dt,
      {
        holding: interactHeld,
        canSearch: p.grounded && !this.w.result,
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
  }
  private lastBlocked: number | null = null;

  /** Run the offscreen ecology and materialize nearby creatures as real bodies. */
  private syncEcology(dt: number) {
    const w = this.w,
      p = w.player;
    const ctx: EcoContext = { player: { x: p.x, y: p.y, district: this.district }, open: this.open };
    this.eco.update(dt, ctx);
    // Spawn: a creature within the near radius becomes a real Carrier, so the same ecology runs
    // whether or not the player is looking at it.
    for (const c of this.eco.alive) {
      if (this.live.has(c.id)) continue;
      if (c.district !== this.district) continue;
      if (distance(c, p) > 1500) continue;
      const e = this.makeEnemy(c, c.district);
      this.live.set(c.id, e);
      w.enemies.push(e);
    }
    // Despawn: leaving the district hands the body back to the simulation, keeping its organs.
    for (const [id, carrier] of [...this.live]) {
      const c = this.eco.creatures.find((o) => o.id === id);
      if (!c || !c.alive) {
        carrier.dead = true;
        this.live.delete(id);
        w.enemies = w.enemies.filter((e) => e !== carrier);
        continue;
      }
      if (c.district !== this.district || distance(c, p) > 1900) {
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

  /** A creature died at the player's hands: it becomes food, which is what feeds the world. */
  onEnemyKilled(carrier: Carrier, ecoId: number) {
    const c = this.eco.creatures.find((o) => o.id === ecoId);
    if (c && c.alive) {
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
    const g = art.g;
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
