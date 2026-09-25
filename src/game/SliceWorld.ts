import { World } from "../engine/World";
import { Enemy } from "../engine/Enemy";
import { idleControls, type Controls } from "../engine/Player";
import { Projectile } from "../engine/Projectile";
import { clamp, distance, integrate, overlaps, rayRect } from "../engine/PhysicsHelpers";
import { organs, organIds, builds, zones, type OrganId } from "./config";
import { EnemyCombat } from "./EnemyCombat";
import type { WeaponId, SecondaryId } from "./config";
import { Ascent } from "./Ascent";
import { Expedition } from "./expedition/Expedition";
import { districts } from "./expedition/ExpeditionMap";
import { Armory } from "./Armory";
import { Juice, feel } from "./Juice";
import { OrganLoadout } from "./OrganLoadout";
import { matchup, organArchetype, type Archetype } from "./expedition/Counters";

const hex = (color: string) => parseInt(color.slice(1), 16);

export class Carrier extends Enemy {
  weapon: WeaponId;
  secondary: SecondaryId | null = null;
  aggro = 0;
  mark = 0;
  hits = 0;
  pushed = 0;
  wallLock = 0;
  dashHit = -1;
  aimX = 0;
  aimY = 0;
  attack = 0;
  freezeValue = 0;
  frozen = 0;
  vulnerable = 0;
  vulnerability = 0;
  damageFactor = 1;
  spawnGrace = 0;
  /** Poise: damage absorbed before the enemy is staggered out of its wind-up. */
  poise = 0;
  maxPoise = 0;
  staggerLock = 0;
  staggered = 0;
  ramNext = false;
  /** Multi-organ build. `organ` is a compat view: reading gives the primary, writing resets to one organ. */
  organs = new OrganLoadout();
  get organ(): OrganId {
    return this.organs.primary ?? "speed";
  }
  set organ(id: OrganId) {
    this.organs.clear();
    this.organs.add(id);
  }
  count(id: OrganId) {
    return this.organs.count(id);
  }
  constructor(
    kind: Enemy["kind"],
    x: number,
    y: number,
    organ: OrganId | OrganId[] | Partial<Record<OrganId, number>>,
    risk: number,
  ) {
    super(kind, x, y);
    this.organs = typeof organ === "string" ? new OrganLoadout([organ]) : new OrganLoadout(organ);
    this.weapon = kind === "crawler" ? "dagger" : kind === "floater" ? "handgun" : "hammer";
    // Elite bodies are twice as tall: spawning at the ordinary enemy centre put them inside the floor.
    this.y = Math.min(y, 610 - this.h / 2);
    this.hp = this.maxHp = kind === "elite" ? 650 : (kind === "reclaimer" ? 135 : 95) + risk * 12;
    this.maxPoise = this.poise = kind === "elite" ? feel.poiseElite : feel.poiseNormal;
    this.cooldown = 1.2;
  }
}
export interface Drop {
  id: number;
  x: number;
  y: number;
  organ: OrganId;
  stacks?: number;
  growth?: number;
}
interface Area {
  enemies: Carrier[];
  drops: Drop[];
  searched: boolean;
}
export interface RunLog {
  time: number;
  event: string;
  detail: string;
}
export interface Save {
  version: 1;
  bank: number;
  trips: number;
  shortcut: boolean;
  research: OrganId[];
  active: boolean;
}
export const freshSave = (): Save => ({
  version: 1,
  bank: 0,
  trips: 0,
  shortcut: false,
  research: [],
  active: false,
});
export const SAVE_KEY = "ever-eclipse-slice-v1";
export function parseSave(raw: string | null): Save {
  try {
    const s = JSON.parse(raw ?? "null");
    if (
      !s ||
      s.version !== 1 ||
      !Number.isFinite(s.bank) ||
      !Number.isInteger(s.trips) ||
      !Array.isArray(s.research)
    )
      return freshSave();
    return {
      version: 1,
      bank: Math.max(0, s.bank),
      trips: Math.max(0, s.trips),
      shortcut: s.shortcut === true,
      active: s.active === true,
      research: [
        ...new Set<OrganId>(
          s.research.filter((v: unknown): v is OrganId => typeof v === "string" && Object.hasOwn(organs, v)),
        ),
      ],
    };
  } catch {
    return freshSave();
  }
}
export class SliceWorld extends World {
  declare enemies: Carrier[];
  ascent: Ascent | null = null;
  /** 0.10 run: map + ecology + loot. Replaces the ascent tower for expedition runs. */
  expedition: Expedition | null = null;
  /** Eco creature id carried on each body, so a kill can be reported back to the ecology. */
  ecoIds = new WeakMap<Carrier, number>();
  zoneId = "hub";
  areas: Record<string, Area> = {};
  slots: OrganId[] = [];
  collectedLayers = 0;
  drops: Drop[] = [];
  nextDrop = 1;
  ammo = 0;
  energy = 0;
  dashSerial = 0;
  cargo = 0;
  relay = false;
  medkits = 2;
  grenadeCooldown = 0;
  extraction = 0;
  extracting = false;
  hurtAt = -10;
  /** Time of the last attack the player made, so searching can be cancelled by attacking. */
  attackedAt = -10;
  /** Set when the player took damage during this frame, for search interruption. */
  hurtThisFrame = false;
  attackedRecently() {
    return this.time - this.attackedAt < 0.12;
  }
  result: "extracted" | "dead" | null = null;
  shotHeavy = new WeakSet<Projectile>();
  pendingDrop: Drop | null = null;
  grenades: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  beams: { x: number; y: number; tx: number; ty: number; life: number }[] = [];
  log: RunLog[] = [];
  visited = new Set<string>();
  stackCounts: Partial<Record<OrganId, number>> = {};
  armory = new Armory(this);
  hostile = new EnemyCombat(this);
  juice = new Juice();
  trainingWeapon: WeaponId | "auto" = "auto";
  trainingSecondary: SecondaryId | "none" = "none";
  heat = 0;
  overheated = false;
  hotCycle = false;
  shield = 0;
  stamina = 100;
  airJumps = 0;
  slamming = false;
  slamY = 0;
  slamWindup = 0;
  dashBuffer = 0;
  perfectDash = -1;
  wave = 0;
  nextWaveAt = 0;
  clearDelay = 0;
  trainingAuto = true;
  trainingKind: Enemy["kind"] | "mixed" = "mixed";
  trainingHealth = 3;
  trainingCount = 5;
  trainingOrgan: OrganId | "cycle" = "cycle";
  spawnSerial = 0;
  recentDamage: { time: number; amount: number }[] = [];
  areaFlashes: { x: number; y: number; radius: number; life: number }[] = [];
  metrics = {
    shots: 0,
    hits: 0,
    wallCharges: 0,
    chargedHits: 0,
    transmissions: 0,
    spreads: 0,
    swaps: 0,
    damage: 0,
    decisions: 0,
    dealt: 0,
    freezes: 0,
    shatters: 0,
    perfectDodges: 0,
    staggers: 0,
  };
  constructor(
    public shortcut = false,
    public seed = 1,
    public training = false,
    ascending = false,
    public unlimited = false,
    /** Start the 0.10 ecosystem expedition rather than the legacy 0.9 ascent tower. */
    expeditionRun = false,
  ) {
    super(false);
    this.modules = [];
    this.enemies = [];
    this.messageTime = 0;
    this.enter(training ? "arena" : "hub");
    if (training) this.startWave();
    else if (ascending) this.startExpedition(seed, !expeditionRun);
  }

  /** Start a 0.10 expedition. `legacyTower` keeps the old ascent available for comparison runs. */
  startExpedition(seed: number, legacyTower = false) {
    if (legacyTower) {
      this.ascent = new Ascent(this, (h) => {
        const e = new Carrier(h.kind, h.x, h.floor, h.organ, 1);
        e.y = h.floor - e.h / 2;
        e.homeY = e.y;
        e.hp = e.maxHp = h.hp;
        e.boundsWidth = this.width;
        e.weapon = h.weapon ?? e.weapon;
        e.secondary = h.secondary ?? null;
        return e;
      });
      return;
    }
    // The 0.10 expedition: authored map, living ecosystem, loot and two extractors.
    this.expedition = new Expedition(this, seed, (c, district) => {
      const d = districts.find((x) => x.id === district)!;
      const e = new Carrier(c.kind, c.x, d.floor - 24, c.organs.toJSON(), 1);
      e.y = d.floor - e.h / 2;
      e.homeY = e.y;
      e.hp = e.maxHp = c.hp;
      e.boundsWidth = this.width;
      e.weapon = c.weapon;
      e.secondary = c.secondary;
      this.ecoIds.set(e, c.id);
      return e;
    });
  }
  get slotLimit() {
    return this.unlimited ? Infinity : 6;
  }
  get totalLayers() {
    return this.slots.reduce((sum, id) => sum + this.count(id), 0);
  }
  get zone() {
    return zones[this.zoneId];
  }
  has(id: OrganId) {
    return this.slots.includes(id);
  }
  count(id: OrganId) {
    return this.has(id) ? (this.stackCounts[id] ?? 1) : 0;
  }
  /** The player's dominant organ archetype, or null when carrying nothing. */
  playerArchetype(): Archetype | null {
    const totals: Record<Archetype, number> = { charge: 0, chain: 0, suppress: 0 };
    for (const id of this.slots) totals[organArchetype[id]] += this.count(id);
    const best = (["chain", "charge", "suppress"] as Archetype[]).sort((a, b) => totals[b] - totals[a])[0];
    return totals[best] > 0 ? best : null;
  }
  speedFactor() {
    return (1 + 0.25 * this.count("speed") + 0.4 * this.count("glass")) * this.juice.speed;
  }
  get energyMax() {
    return 3 + Math.max(0, this.count("battery") - 1) * 2;
  }
  get dps() {
    return this.recentDamage.reduce((sum, d) => sum + d.amount, 0) / 5;
  }
  attackRange(base: number) {
    return (
      base *
      (1 +
        (this.stamina >= 95 ? 0.3 * this.count("fullRange") : 0) +
        (!this.player.grounded ? 0.2 * this.count("airPower") : 0))
    );
  }
  power() {
    return (
      (1 +
        (this.heat >= 60 ? 0.35 * this.count("hot") : 0) +
        (this.shield > 0 ? 0.5 * this.count("shieldBurst") : 0) +
        (1 - this.player.hp / this.player.maxHp) * 0.8 * this.count("rage") +
        (!this.player.grounded ? 0.3 * this.count("airPower") : 0)) *
      this.juice.power
    );
  }
  get vitalityLevel() {
    return Math.floor(this.collectedLayers / 6);
  }
  get naturalMaxHp() {
    return 100 + 20 * this.vitalityLevel + 10 * this.count("leech");
  }
  syncStats(growth = 0) {
    const oldMax = this.player.maxHp;
    this.player.maxHp = Math.max(10, Math.round(this.naturalMaxHp * 0.7 ** this.count("glass")));
    const added = Math.min(
      Math.max(0, this.player.maxHp - oldMax),
      Math.max(0, Math.round(growth * 0.7 ** this.count("glass"))),
    );
    this.player.hp = Math.min(this.player.hp + added, this.player.maxHp);
    this.energy = Math.min(this.energy, this.energyMax);
  }
  record(event: string, detail: string) {
    this.log.push({ time: Math.round(this.time * 10) / 10, event, detail });
    if (this.log.length > 2000) this.log.shift();
  }
  canSee(a: { x: number; y: number }, b: { x: number; y: number }) {
    return !this.platforms.some((r) => rayRect(a.x, a.y, b.x - a.x, b.y - a.y, r) !== null);
  }
  gainShield(amount: number) {
    this.shield = Math.min(1000, this.shield + amount);
  }
  recover(amount: number) {
    const over = Math.max(0, this.player.hp + amount - this.player.maxHp);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + amount);
    if (over && this.count("overflow")) this.gainShield(over * this.count("overflow"));
  }
  stunEnemy(e: Carrier, duration: number) {
    if (e.stun <= 0) this.stamina = Math.min(100, this.stamina + 12 * this.count("stunRegen"));
    e.stun = Math.max(e.stun, duration);
    e.windup = 0;
    e.charge = 0;
  }
  grant(id: OrganId, amount = 1) {
    if (!Object.hasOwn(organs, id)) return false;
    const d = {
      id: this.nextDrop++,
      x: this.player.x,
      y: this.player.y,
      organ: id,
      stacks: clamp(Math.floor(amount), 1, 100),
    };
    this.drops.push(d);
    // Debug/training grant: queue the panel so a refused grant can still be resolved by hand.
    this.pendingDrop = d;
    const ok = this.has(id) || this.slots.length < this.slotLimit ? this.equip() : false;
    return ok;
  }
  useBuild(id: string, amount = 1) {
    const build = builds[id];
    if (!build) return;
    this.slots = [...build.ids];
    this.stackCounts = Object.fromEntries(build.ids.map((o) => [o, clamp(Math.floor(amount), 1, 100)]));
    if (this.training) this.collectedLayers = this.totalLayers;
    this.armory.switchPrimary(build.weapon);
    this.armory.switchSecondary(build.secondary);
    this.syncStats();
    if (this.training) this.resupply();
    this.record("preset", `${id} x${amount}`);
  }
  resupply() {
    this.syncStats();
    this.player.hp = this.player.maxHp;
    this.stamina = 100;
    this.heat = 0;
    this.overheated = false;
    this.medkits = 8;
    this.armory.droneStock = 8;
    this.energy = this.energyMax;
  }
  reviveTraining() {
    if (!this.training) return;
    this.dead = false;
    this.complete = false;
    this.result = null;
    this.pendingDrop = null;
    this.enemies.length = 0;
    this.projectiles = [];
    this.grenades = [];
    this.slamming = false;
    this.slamWindup = 0;
    this.dashBuffer = 0;
    this.player.dashTime = 0;
    this.player.externalX = 0;
    this.player.vx = 0;
    this.player.x = 640;
    this.player.y = 480;
    this.player.vy = 0;
    this.player.invulnerable = 3;
    this.resupply();
    this.nextWaveAt = this.time + 2;
    this.clearDelay = 0;
  }
  startWave() {
    if (!this.training) return;
    this.wave++;
    this.spawnTraining(this.trainingCount + Math.floor(this.wave / 3));
    this.nextWaveAt = this.time + 22;
    this.clearDelay = 0;
    this.say(`第 ${this.wave} 波 · 生命 ×${this.enemyHealthScale().toFixed(1)} · B 调整训练`);
    this.record("wave", String(this.wave));
  }
  enemyHealthScale() {
    return Math.min(1e8, this.trainingHealth * 1.22 ** Math.max(0, this.wave - 1));
  }
  spawnTraining(amount = this.trainingCount, kind = this.trainingKind) {
    if (!this.training) return;
    const limit = Math.min(amount, 28 - this.enemies.filter((e) => !e.dead).length);
    for (let i = 0; i < limit; i++) {
      const index = this.spawnSerial++,
        selected =
          kind === "mixed"
            ? this.wave % 5 === 0 && i === 0
              ? "elite"
              : (["crawler", "reclaimer", "floater"] as const)[index % 3]
            : kind;
      const x =
        this.player.x < 500
          ? 1160 - i * 32
          : this.player.x > 800
            ? 110 + i * 32
            : index % 2
              ? 110 + i * 12
              : 1170 - i * 12;
      const organ = this.trainingOrgan === "cycle" ? organIds[index % organIds.length] : this.trainingOrgan;
      const e = new Carrier(
        selected,
        clamp(x, 75, 1205),
        selected === "floater" ? 400 + (index % 3) * 45 : 585,
        organ,
        3,
      );
      e.hp = e.maxHp = Math.round(e.maxHp * this.enemyHealthScale());
      e.weapon = this.trainingWeapon === "auto" ? e.weapon : this.trainingWeapon;
      e.secondary = this.trainingSecondary === "none" ? null : this.trainingSecondary;
      e.damageFactor = Math.min(20, 1.08 ** Math.max(0, this.wave - 1));
      e.spawnGrace = 0.8;
      this.enemies.push(e);
    }
  }
  enter(id: string, from?: string) {
    if (!zones[id]) return;
    this.zoneId = id;
    if (!this.areas[id]) {
      this.areas[id] = {
        enemies: zones[id].spawns.map(
          (s, i) =>
            new Carrier(
              s.kind,
              s.x + ((this.seed * 37 + i * 19) % 65) - 32,
              s.y ?? 585,
              s.organ,
              zones[id].risk,
            ),
        ),
        drops: [],
        searched: false,
      };
    }
    const a = this.areas[id];
    this.enemies = a.enemies;
    this.drops = a.drops;
    this.platforms = zones[id].platforms.map((p) => ({ ...p }));
    const back = zones[id].portals.find((p) => p.to === from && (!p.shortcut || this.shortcut));
    this.player.x = back ? clamp(back.x + (back.x > 640 ? -65 : 65), 35, 1245) : 180;
    this.player.y = 584;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.dashTime = 0;
    this.player.externalX = 0;
    this.player.invulnerable = 0.9;
    this.projectiles = [];
    this.grenades = [];
    this.effects = [];
    this.beams = [];
    this.damageNumbers = [];
    this.extraction = 0;
    this.extracting = false;
    this.visited.add(id);
    this.record("route", `${id}; hp=${Math.ceil(this.player.hp)}; cargo=${this.cargo}`);
    this.say(zones[id].hint);
    this.messageTime = 7;
  }
  travel(to: string) {
    const portal = this.zone.portals.find((p) => p.to === to && (!p.shortcut || this.shortcut));
    if (!portal || distance(this.player, { x: portal.x, y: 584 }) > 85 || this.result) return false;
    const from = this.zoneId;
    this.metrics.decisions++;
    this.enter(to, from);
    return true;
  }
  /** Interaction prompts for a 0.10 expedition: search, shortcuts, extracts, drops. */
  expeditionNearby() {
    const ex = this.expedition!,
      p = this.player;
    if (ex.search.pile)
      return {
        type: "search" as const,
        label: `搜索中 ${Math.round(ex.search.progress * 100)}% · 松开 E 或受击会中断`,
      };
    const pile = ex.nearestPile(p.x, p.y);
    if (pile)
      return {
        type: "search" as const,
        label: `按住 E 搜索 ${pile.source} · 难度 ${pile.difficulty.toFixed(1)} · 有噪音`,
      };
    const sc = ex.shortcutAt(p.x, p.y);
    if (sc && !ex.open.has(sc.id))
      return { type: "shortcut" as const, label: `E 打开 ${sc.name} · ${sc.note}` };
    const fx = ex.extractorAt(p.x, p.y);
    if (fx) {
      const blocked = ex.extractBlocked(fx);
      return {
        type: "exit" as const,
        short: blocked ? undefined : "按住 E 2 秒 · 撤离",
        label: blocked ?? `按住 E 两秒 · 从${fx.name}撤离 · 货物价值 ${ex.cargo.value}`,
      };
    }
    const expDrop = this.drops
      .filter((d) => distance(d, p) < 88)
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (expDrop)
      return {
        type: "drop" as const,
        drop: expDrop,
        label: `E 查看 / 接入「${organs[expDrop.organ].name}」`,
      };
    return null;
  }
  nearby() {
    if (this.ascent) return this.ascent.nearby();
    if (this.expedition) return this.expeditionNearby();
    const p = this.player;
    // Standing directly at a door/chest must remain usable even if a duplicate organ lands there.
    const closePortal = this.zone.portals.find(
      (v) => (!v.shortcut || this.shortcut) && distance(p, { x: v.x, y: 584 }) < 40,
    );
    if (closePortal) return { type: "portal" as const, portal: closePortal, label: `E ${closePortal.label}` };
    const closeChest = this.zone.chest;
    if (closeChest && !this.areas[this.zoneId].searched && distance(p, { x: closeChest.x, y: 584 }) < 35)
      return { type: "chest" as const, label: `E 搜索 ${closeChest.name} · +${closeChest.value}` };
    const drop = this.drops
      .filter((d) => distance(d, p) < 88)
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (drop) return { type: "drop" as const, drop, label: `E 查看 / 接入「${organs[drop.organ].name}」` };
    const chest = this.zone.chest;
    if (chest && !this.areas[this.zoneId].searched && distance(p, { x: chest.x, y: 584 }) < 78)
      return { type: "chest" as const, label: `E 搜索 ${chest.name} · +${chest.value}` };
    if (this.zoneId === "hub" && distance(p, { x: 180, y: 584 }) < 90)
      return { type: "exit" as const, label: "按住 E 2 秒 · 安全撤离 / 结算本局收获" };
    const portal = this.zone.portals.find(
      (v) => (!v.shortcut || this.shortcut) && distance(p, { x: v.x, y: 584 }) < 80,
    );
    if (portal) return { type: "portal" as const, portal, label: `E ${portal.label}` };
    return null;
  }
  interact() {
    const n = this.nearby();
    if (!n || this.result) return;
    if (n.type === "site") {
      this.ascent?.use(n.site);
      return;
    }
    if (n.type === "drop") {
      this.pendingDrop = n.drop;
      if (this.has(n.drop.organ) || this.unlimited) this.equip();
    }
    if (n.type === "shortcut") {
      const name = this.expedition?.openShortcut(this.player.x, this.player.y);
      if (name) this.say(`${name} 已打开 · 路线缩短`);
      return;
    }
    if (n.type === "portal") this.travel(n.portal.to);
    if (n.type === "chest") {
      const c = this.zone.chest!;
      this.areas[this.zoneId].searched = true;
      this.cargo += c.value;
      if (c.relay) this.relay = true;
      this.record("search", c.name);
      this.say(
        c.relay ? "已拿到运输回路图 · 成功带回后，下次可直达枢纽" : `${c.name} · 携带样本 +${c.value}`,
      );
    }
  }
  equip(slot = this.slots.length) {
    const d = this.pendingDrop;
    if (!d) return false;
    // A drop queued by autoCollect may not be a real floor drop yet (it can still be a duplicate
    // reward for an already-owned organ): fall back to the live entry with the same id.
    let target = this.drops.includes(d) ? d : this.drops.find((x) => x.id === d.id);
    if (!target && this.has(d.organ)) target = d;
    if (!target) return false;
    const beforeVitality = this.naturalMaxHp,
      credit = target.growth ?? target.stacks ?? 1;
    if (this.has(target.organ)) {
      this.collectedLayers += credit;
      this.stackCounts[target.organ] = this.count(target.organ) + (target.stacks ?? 1);
      const at = this.drops.indexOf(target);
      if (at >= 0) this.drops.splice(at, 1);
      this.pendingDrop = null;
      this.syncStats(credit > 0 ? this.naturalMaxHp - beforeVitality : 0);
      this.say(`${organs[target.organ].name} ×${this.count(target.organ)} · 同类效果叠加`);
      this.record("stack", `${target.organ} x${this.count(target.organ)}`);
      this.emit("phase", this.player.x, this.player.y);
      return true;
    }
    if (slot < 0 || slot > this.slots.length || slot >= this.slotLimit) return false;
    this.collectedLayers += credit;
    const oldCount = this.slots[slot] ? this.count(this.slots[slot]) : 0;
    const old = this.slots[slot];
    this.slots[slot] = target.organ;
    this.stackCounts[target.organ] = target.stacks ?? 1;
    const at = this.drops.indexOf(target);
    if (at >= 0) this.drops.splice(at, 1);
    if (old) {
      this.drops.push({
        id: this.nextDrop++,
        x: target.x + 28,
        y: target.y,
        organ: old,
        stacks: oldCount,
        growth: 0,
      });
      delete this.stackCounts[old];
      this.metrics.swaps++;
    }
    this.syncStats(credit > 0 ? this.naturalMaxHp - beforeVitality : 0);
    this.record(old ? "swap" : "equip", `${old ?? "empty"} → ${target.organ}`);
    this.say(`已接入 ${organs[target.organ].name}${old ? ` · ${organs[old].name}留在地面` : ""}`);
    this.pendingDrop = null;
    this.emit("phase", this.player.x, this.player.y);
    return true;
  }
  autoCollect() {
    if (this.result || this.dead || this.pendingDrop) return;
    for (const d of [...this.drops]) {
      if (
        !(this.unlimited || this.has(d.organ)) ||
        distance(d, this.player) > 48 ||
        !this.canSee(this.player, d)
      )
        continue;
      this.pendingDrop = d;
      // Never leave a queued drop the player cannot resolve: on any refusal, put it back.
      if (!this.equip()) this.pendingDrop = null;
    }
  }
  heal() {
    if (this.medkits <= 0 || this.player.hp >= this.player.maxHp || this.result) return;
    const amount = Math.round(this.player.maxHp * 0.4);
    this.medkits--;
    this.recover(amount);
    this.record("heal", `hp=${this.player.hp}`);
    this.say(`医疗针 · 恢复 ${amount} 生命`);
    this.emit("phase", this.player.x, this.player.y);
  }
  projectileHit = false;
  /** Called by the armory whenever the player commits to an attack, so searching breaks. */
  noteAttack() {
    this.attackedAt = this.time;
  }
  override hurtPlayer(amount: number, fromX: number) {
    if (this.dead || this.god) return;
    if (this.player.invulnerable > 0) {
      // Any dash that slips through a real hit is a "perfect dodge": always rewarded with slow-mo,
      // and with charge when 瞬息核 is installed.
      if (this.player.dashTime > 0 && this.perfectDash !== this.dashSerial) {
        this.perfectDash = this.dashSerial;
        this.metrics.perfectDodges++;
        this.juice.beat("perfect", this.player.x, this.player.y);
        this.stamina = Math.min(100, this.stamina + 15);
        this.player.dashCooldown = 0;
        if (this.count("perfect")) {
          this.energy = Math.min(this.energyMax, this.energy + this.count("perfect"));
          this.say("完美闪避 → 充能");
        } else this.say("完美闪避");
      }
      return;
    }
    if (this.armory.blocking && (fromX - this.player.x) * this.player.facing >= -10 && this.stamina >= 8) {
      this.stamina = Math.max(0, this.stamina - 8 - amount * 0.25);
      if (this.armory.blockAge <= 0.18) {
        this.emit("phase", this.player.x, this.player.y, 0x9cdfff);
        this.juice.beat("parry", this.player.x + this.player.facing * 30, this.player.y, 0x9cdfff);
        this.say("完美格挡");
        return;
      }
      amount *= 0.4;
    }
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
      if (amount <= 0) {
        this.player.invulnerable = 0.15;
        return;
      }
    }
    const before = this.player.hp;
    super.hurtPlayer(amount, fromX);
    if (before !== this.player.hp) {
      if (this.projectileHit) this.player.invulnerable = Math.min(this.player.invulnerable, 0.25);
      this.juice.hurt();
      this.juice.beat("hurt", this.player.x, this.player.y);
      this.hurtAt = this.time;
      // Any real damage cancels an in-progress search: greed must cost you the hold.
      this.hurtThisFrame = true;
      this.metrics.damage += before - this.player.hp;
      this.extraction = 0;
    }
    if (this.dead && !this.result) {
      this.result = "dead";
      this.record("death", `lost=${this.cargo}`);
    }
  }
  push(e: Carrier, impulse: number) {
    e.impulseX = clamp(
      e.impulseX +
        (impulse * (1 + 0.65 * this.count("knock")) * (e.stun > 0 ? 1 + this.count("stunKnock") : 1)) /
          (e.kind === "elite" ? 2 : 1),
      -3200,
      3200,
    );
    if (Math.abs(impulse) >= 80) e.pushed = 0.8;
  }
  hit(e: Carrier, amount: number, direct = false, impulse = 0, heavy = false) {
    if (e.dead) return;
    this.ascent?.awakened.add(e.id);
    e.aggro = 5;
    amount = this.hostile.defend(e, amount);
    // Organ archetypes are NOT applied to player damage. Which archetype the player carries is
    // emergent — organs drop at random and slots are unlimited — so a 1.5x/0.7x swing would be an
    // unpredictable tax rather than a decision. The player reads the archetype as intelligence
    // ("this one is a suppression type, don't brawl it"), while the cycle itself does its real
    // work between creatures, where it is what stops one body from owning the map.
    const marked = e.mark > 0;
    if (direct) amount *= this.power() * this.juice.executeScale(e.hp, e.maxHp);
    if (e.vulnerable > 0) amount *= 1 + e.vulnerability;
    const actual = Math.min(e.hp, amount);
    this.metrics.dealt += actual;
    this.recentDamage.push({ time: this.time, amount: actual });
    if (direct) {
      this.metrics.hits++;
      // Poise: sustained direct hits break the enemy out of its wind-up, which is what turns
      // "trading damage" into "pressing the attack".
      if (e.staggerLock <= 0 && e.staggered <= 0) {
        const poiseDamage = (heavy ? feel.poiseHeavy : feel.poiseHit) * this.juice.poisePower;
        e.poise -= poiseDamage;
        if (e.poise <= 0) {
          e.poise = e.maxPoise;
          e.staggerLock =
            feel.staggerCooldown + (e.kind === "elite" ? feel.staggerEliteTime : feel.staggerTime);
          e.staggered = e.kind === "elite" ? feel.staggerEliteTime : feel.staggerTime;
          e.windup = 0;
          e.charge = 0;
          e.attack = Math.max(0, e.attack);
          e.cooldown = Math.max(e.cooldown, e.staggered + 0.15);
          e.vulnerable = Math.max(e.vulnerable, e.staggered);
          e.vulnerability = Math.max(e.vulnerability, feel.staggerVulnerable);
          this.metrics.staggers++;
          this.juice.beat("stagger", e.x, e.y, 0xffe08a);
          if (e.kind === "elite") this.say("母体破韧 · 硬直中");
        }
      }
      if (this.has("mark") && ++e.hits >= Math.max(1, Math.ceil(3 / (1 + 0.35 * (this.count("mark") - 1))))) {
        e.hits = 0;
        e.mark = 8 + 2 * (this.count("mark") - 1);
        this.emit("phase", e.x, e.y, 0xb7a4ed);
      }
      if (this.count("freeze") && e.frozen <= 0) {
        e.freezeValue += this.count("freeze");
        if (e.freezeValue >= 5) {
          e.freezeValue = 0;
          e.frozen = 1.5 + 0.25 * (this.count("freeze") - 1);
          this.stunEnemy(e, e.frozen);
          this.metrics.freezes++;
          this.emit("phase", e.x, e.y, 0x91d5f1);
        }
      }
    }
    this.push(e, impulse);
    super.damageEnemy(e, amount, 0, direct ? "hit" : "combo");
    const color = hex(organs[e.organ].color),
      angle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
    if (direct) this.juice.beat(heavy ? "heavy" : "hit", e.x, e.y, heavy ? 0xffc57d : 0xfff0c9, angle);
    if (e.dead) {
      // A creature killed by the player becomes food for the ecosystem: the player's own kills
      // are what feeds the world's growth, which is the core 搜打撤 feedback loop.
      const ecoId = this.ecoIds.get(e);
      if (ecoId !== undefined && this.expedition) this.expedition.onEnemyKilled(e, ecoId);
      const elite = e.kind === "elite";
      this.juice.kill(elite);
      this.juice.beat(elite ? "eliteKill" : "kill", e.x, e.y, color, angle);
      // The body flies in the direction the killing blow was already pushing it.
      const launch = Math.min(900, Math.abs(e.impulseX) + (heavy ? 420 : 180));
      this.juice.corpse(
        e.x,
        e.y,
        Math.sign(e.impulseX || Math.cos(angle) || 1) * launch,
        -260 - (heavy ? 180 : 0),
        e.w / 2,
        color,
        elite,
      );
      if (this.juice.tier >= 1) this.stamina = Math.min(100, this.stamina + feel.killStamina);
      // Kills refund the dash: the loop is dash in → kill → dash out, not walk-and-shoot.
      this.player.dashCooldown = Math.min(this.player.dashCooldown, 0.12);
      this.cargo += e.kind === "elite" ? 180 : 10 + this.zone.risk * 5;
      // Every organ the body actually carried drops, with its stacks: the loot is the real build.
      for (const [i, [organ, stacks]] of e.organs.entries().entries()) {
        const matching = this.drops.find((d) => d.organ === organ && Math.abs(d.x - e.x) < 110);
        if (matching) {
          matching.growth = (matching.growth ?? matching.stacks ?? 1) + stacks;
          matching.stacks = (matching.stacks ?? 1) + stacks;
        } else
          this.drops.push({
            id: this.nextDrop++,
            x: clamp(e.x + (i - (e.organs.uniqueCount - 1) / 2) * 30, 45, this.width - 45),
            y: this.ascent ? this.ascent.ground(e.x, e.y) - 24 : 585,
            organ,
            stacks: stacks > 1 ? stacks : undefined,
          });
      }
      if (this.drops.length > 84) this.drops.shift();
      if (this.has("leech")) this.recover(5 * this.count("leech"));
      if (!this.player.grounded && this.count("airJump"))
        this.airJumps = Math.min(this.count("airJump"), this.airJumps + 1);
      if (this.has("spread") && e.mark > 0) {
        for (const other of this.enemies)
          if (!other.dead && distance(e, other) < 280 + 60 * (this.count("spread") - 1)) {
            other.mark = 8;
            this.metrics.spreads++;
            this.beams.push({ x: e.x, y: e.y, tx: other.x, ty: other.y, life: 0.3 });
          }
      }
      if (e.kind === "elite") {
        this.say(this.training ? "母体击破 · 下一轮会更强" : "母体核心 +180 · 现在需要活着带回气闸");
        this.record("boss", "defeated");
      }
    }
    if (direct && marked && this.has("conduit")) {
      for (const other of this.enemies)
        if (!other.dead && other !== e && other.mark > 0 && distance(e, other) < 320) {
          this.metrics.transmissions++;
          this.beams.push({ x: e.x, y: e.y, tx: other.x, ty: other.y, life: 0.22 });
          this.hit(other, amount * (0.6 + 0.3 * (this.count("conduit") - 1)));
        }
    }
    if (heavy) {
      if (this.count("vent") && e.mark > 0) {
        e.mark = 0;
        this.heat = Math.max(0, this.heat - 25 * this.count("vent"));
      }
      if (this.count("vulnerable")) {
        e.vulnerable = 4;
        e.vulnerability = 0.2 * this.count("vulnerable");
      }
      if (this.count("shatter") && e.frozen > 0) {
        e.frozen = 0;
        e.stun = 0;
        this.metrics.shatters++;
        this.juice.beat("shatter", e.x, e.y);
        this.blast(
          e.x,
          e.y,
          45 * this.count("shatter"),
          this.attackRange(170 + 30 * (this.count("shatter") - 1)),
          180,
        );
      }
      if (this.count("heavyArea"))
        this.blast(
          e.x,
          e.y,
          amount * (0.35 + 0.15 * (this.count("heavyArea") - 1)),
          this.attackRange(105 + 35 * this.count("heavyArea")),
          120,
          e,
        );
    }
  }
  throwGrenade(mx: number, my: number, power = 1) {
    if (this.grenadeCooldown > 0 || this.result) return;
    this.grenadeCooldown = 4.5;
    const p = this.player,
      dx = clamp(mx - p.x, -360, 360),
      dy = clamp(my - p.y, -160, 120);
    this.grenades.push({
      x: p.x,
      y: p.y - 10,
      vx: (dx * power) / 0.65,
      vy: dy / 0.65 - 190 * power,
      life: 0.65,
    });
    this.record("grenade", this.zoneId);
  }
  blast(x: number, y: number, damage: number, radius: number, push: number, except?: Carrier) {
    this.emit("detach", x, y, 0xedb76c);
    this.juice.beat("blast", x, y, 0xedb76c);
    this.areaFlashes.push({ x, y, radius: Math.min(1800, radius), life: 0.32 });
    if (this.areaFlashes.length > 40) this.areaFlashes.shift();
    const targets = this.enemies.filter((e) => !e.dead && e !== except && distance(e, { x, y }) < radius);
    const multi = 1 + Math.max(0, targets.length - 1) * 0.15 * this.count("multi");
    for (const e of targets) this.hit(e, damage * multi, false, Math.sign(e.x - x || 1) * push);
  }
  updateEnemy(e: Carrier, dt: number) {
    if (e.dead || (this.ascent && !this.ascent.beforeEnemy(e))) return;
    if (e.spawnGrace > 0) {
      e.spawnGrace -= dt;
      return;
    }
    e.flash = Math.max(0, e.flash - dt);
    e.mark = Math.max(0, e.mark - dt);
    e.frozen = Math.max(0, e.frozen - dt);
    e.vulnerable = Math.max(0, e.vulnerable - dt);
    e.staggerLock = Math.max(0, e.staggerLock - dt);
    if (e.staggered > 0) {
      e.staggered = Math.max(0, e.staggered - dt);
    } else if (e.poise < e.maxPoise) {
      e.poise = Math.min(e.maxPoise, e.poise + feel.poiseRegen * dt);
    }
    e.wallLock -= dt;
    e.pushed -= dt;
    e.cooldown -= dt;
    e.stun -= dt;
    e.aggro = Math.max(0, e.aggro - dt);
    this.hostile.tick(e, dt);
    const p = this.player,
      d = distance(p, e),
      dir = Math.sign(p.x - e.x) || 1;
    const sight = this.canSee(e, p);
    if (d < 760 && Math.abs(p.y - e.y) < 220 && sight) e.aggro = 5;
    let speed = 0;
    if ((d < 800 || this.training) && e.stun <= 0 && e.frozen <= 0 && e.staggered <= 0) {
      if (e.windup > 0) {
        e.windup = Math.max(0, e.windup - dt);
        if (e.windup === 0) {
          this.hostile.release(e);
        }
      } else if (e.charge > 0) {
        e.charge -= dt;
        speed = e.chargeDirection * (e.kind === "elite" ? 460 : 420);
      } else {
        speed =
          e.kind === "floater"
            ? d > 300
              ? dir * 100
              : d < 160
                ? -dir * 40
                : 0
            : dir * (e.kind === "elite" ? 105 : e.kind === "reclaimer" ? 165 : 145);
        const ranged = ["handgun", "rifle", "sniper"].includes(e.weapon);
        if (
          e.cooldown <= 0 &&
          sight &&
          d <
            (ranged
              ? 650
              : e.count("ram")
                ? 200
                : this.hostile.radius(e, e.weapon === "hammer" ? 135 : 110)) &&
          (ranged || Math.abs(p.y - e.y) < 65)
        ) {
          e.cooldown =
            (e.weapon === "dagger"
              ? 0.95
              : e.weapon === "hammer"
                ? 1.35
                : e.weapon === "sniper"
                  ? 2.5
                  : e.weapon === "rifle"
                    ? 2.1
                    : 1.1) / this.hostile.speed(e);
          e.windup =
            (e.weapon === "sniper" ? 1.05 : e.weapon === "hammer" ? 0.5 : 0.35) / this.hostile.speed(e);
          if (e.count("slam") && e.grounded) e.vy = -520 - 60 * (e.count("slam") - 1);
          // Ram bodies commit at wind-up: open from range, and every third attack even up close.
          e.ramNext = e.count("ram") > 0 && (d > 110 || e.attack % 3 === 2);
          e.chargeDirection = dir;
          e.aimX = p.x;
          e.aimY = p.y;
          e.attack++;
          speed = 0;
          if (e.attack % 3 === 0 && this.armory.units.length) {
            const u = this.armory.units[e.attack % this.armory.units.length];
            e.aimX = u.x;
            e.aimY = u.y;
          }
        }
      }
    }
    e.vx = speed + e.impulseX;
    if (e.kind === "floater" && e.pushed <= 0)
      e.vy = clamp((e.homeY + Math.sin(this.time * 2 + e.id) * 22 - e.y) * 3, -140, 140);
    const incoming = e.vx;
    integrate(e, dt, this.platforms, e.kind === "floater" ? 0 : 1650);
    if (!this.ascent && e.y + e.h / 2 > 611 && e.vy >= 0) {
      e.y = 610 - e.h / 2;
      e.vy = 0;
      e.grounded = true;
      e.x = clamp(e.x, e.w / 2 + 12, 1268 - e.w / 2);
    }
    this.ascent?.afterEnemy(e);
    const blocked =
      (Math.abs(incoming) > 50 && e.vx === 0) ||
      (e.x <= e.w / 2 + 12.1 && incoming < 0) ||
      (e.x >= this.width - 12 - e.w / 2 - 0.1 && incoming > 0);
    if (blocked && e.pushed > 0 && e.wallLock <= 0) {
      e.wallLock = 0.9;
      this.juice.beat("wallSlam", e.x + Math.sign(incoming) * (e.w / 2), e.y, 0xedb76c);
      e.impulseX = 0;
      e.pushed = 0;
      if (this.has("battery")) {
        this.stunEnemy(e, 0.8);
        this.energy = Math.min(this.energyMax, this.energy + this.count("battery"));
        this.metrics.wallCharges++;
        this.emit("ram", e.x, e.y, 0xedb76c);
        this.say("撞墙 → 充能 +1 · 第五发可释放");
      }
    } else if (blocked && e.grounded && e.stun <= 0 && d < 700) e.vy = -510;
    e.impulseX *= Math.exp(-4 * dt);
    if (
      this.has("ram") &&
      p.dashTime > 0 &&
      overlaps({ ...p, w: p.w + 32 }, e) &&
      e.dashHit !== this.dashSerial
    ) {
      e.dashHit = this.dashSerial;
      this.hit(e, 12 * this.count("ram"), false, Math.sign(p.vx) * 720 * (1 + 0.2 * (this.count("ram") - 1)));
      this.emit("ram", e.x, e.y, 0xedb76c);
    }
    if (!e.dead && e.stun <= 0 && e.charge > 0) {
      if (overlaps(p, e)) this.hostile.damage(e, e.kind === "elite" ? 28 : e.kind === "reclaimer" ? 20 : 14);
      for (const u of this.armory.units)
        if (u.invulnerable <= 0 && distance(u, e) < e.w / 2 + 22) {
          u.hp -= 20 * e.damageFactor;
          u.invulnerable = 0.6;
        }
    }
  }
  override updateProjectiles(dt: number) {
    for (const b of this.projectiles) {
      if (b.dead) continue;
      const dx = b.vx * dt,
        dy = b.vy * dt;
      let first = 2;
      for (const wall of this.platforms) {
        const t = rayRect(b.x, b.y, dx, dy, wall, 2);
        if (t !== null && t < first) first = t;
      }
      const wallT = first;
      const data = this.armory.shots.get(b);
      const hostileShot = this.hostile.shots.get(b);
      if (b.team === "player") {
        for (const u of this.hostile.units) {
          const t = rayRect(b.x, b.y, dx, dy, { ...u, w: 32, h: 30 }, 4);
          if (u.hp > 0 && t !== null && t < first) {
            u.hp -= b.damage * this.power();
            first = t;
            b.dead = true;
            break;
          }
        }
        const hits = this.enemies
          .filter((e) => !e.dead && !data?.hits.has(e.id))
          .map((e) => ({ e, t: rayRect(b.x, b.y, dx, dy, e, 4) }))
          .filter((v): v is { e: Carrier; t: number } => v.t !== null && v.t <= first)
          .sort((a, b) => a.t - b.t);
        const selected = data?.piercing ? hits : hits.slice(0, 1);
        const multi =
          1 + Math.max(0, (data?.hits.size ?? 0) + selected.length - 1) * 0.15 * this.count("multi");
        for (const { e, t } of selected) {
          if (b.dead) break;
          this.hit(
            e,
            b.damage * multi,
            true,
            Math.sign(b.vx) * (data?.heavy ? 150 : 24),
            data?.heavy ?? false,
          );
          data?.hits.add(e.id);
          if (data?.powered || (!data && this.shotHeavy.has(b))) {
            this.metrics.chargedHits++;
            this.blast(e.x, e.y, 35 * this.count("discharge"), this.attackRange(140), 260, e);
            if (data) data.powered = false;
          }
          this.emit("hit", e.x, e.y, data?.heavy ? 0xffc57d : 0xe7edbd);
          if (!data?.piercing) {
            first = t;
            b.dead = true;
            break;
          }
        }
      } else {
        const playerT = hostileShot?.hitPlayer ? null : rayRect(b.x, b.y, dx, dy, this.player, 3);
        let unit: (typeof this.armory.units)[number] | undefined;
        for (const u of this.armory.units) {
          if (hostileShot?.hits.has(u.id)) continue;
          const t = rayRect(b.x, b.y, dx, dy, { ...u, w: 32, h: 30 }, 3);
          if (t !== null && t < first && (playerT === null || t < playerT)) {
            first = t;
            unit = u;
          }
        }
        if (unit) {
          if (hostileShot) {
            this.hostile.damage(hostileShot.owner, b.damage, hostileShot.heavy, unit);
            hostileShot.hits.add(unit.id);
          } else if (unit.invulnerable <= 0) {
            unit.hp -= b.damage;
            unit.invulnerable = 0.1;
          }
          b.dead = !hostileShot?.piercing;
        } else if (playerT !== null && playerT < first) {
          first = playerT;
          b.dead = !hostileShot?.piercing;
          if (hostileShot) {
            // Bullets use short i-frames so automatic bursts are not swallowed by the melee hurt window.
            this.projectileHit = true;
            this.hostile.damage(hostileShot.owner, b.damage, hostileShot.heavy);
            this.projectileHit = false;
            hostileShot.hitPlayer = true;
            if (hostileShot.powered || (hostileShot.heavy && hostileShot.owner.count("heavyArea")))
              this.hostile.blast(hostileShot.owner, this.player.x, this.player.y, 9, 145, true);
          } else this.hurtPlayer(b.damage, b.x - Math.sign(b.vx) * 10);
        }
      }
      if (hostileShot?.piercing && !b.dead) first = wallT;
      b.x += dx * Math.min(1, first);
      b.y += dy * Math.min(1, first);
      if (first <= 1) b.dead = true;
      b.life -= dt;
    }
    this.projectiles = this.projectiles
      .filter(
        (b) => !b.dead && b.life > 0 && b.x > 0 && b.x < this.width && b.y > -60 && b.y < this.height + 20,
      )
      .slice(-1600);
  }
  override update(dt: number, c: Controls, interactHeld = false) {
    // A queued drop must always correspond to a resolvable entry on the floor. If the panel would
    // have nothing to act on, drop it here instead of freezing the simulation forever.
    if (this.pendingDrop && !this.drops.includes(this.pendingDrop)) this.pendingDrop = null;
    if (this.result || this.pendingDrop) return;
    this.time += dt;
    this.messageTime -= dt;
    this.juice.update(dt);
    this.player.moveScale = this.juice.move;
    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
    for (const n of this.damageNumbers) {
      n.life -= dt;
      n.y -= dt * 40;
    }
    this.damageNumbers = this.damageNumbers.filter((n) => n.life > 0);
    for (const f of this.effects) f.life -= dt;
    this.effects = this.effects.filter((f) => f.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const a of this.areaFlashes) a.life -= dt;
    this.areaFlashes = this.areaFlashes.filter((a) => a.life > 0);
    this.recentDamage = this.recentDamage.filter((d) => this.time - d.time < 5).slice(-12000);
    if (!(this.armory.secondary === "shield" && c.phase))
      this.stamina = Math.min(100, this.stamina + 24 * dt);
    if (this.heat >= 60) this.hotCycle = true;
    this.heat = Math.max(0, this.heat - (!c.fire || this.overheated ? 28 : 3) * dt);
    if (this.heat <= 35) {
      if (this.hotCycle) this.gainShield(25 * this.count("coolShield"));
      this.hotCycle = false;
      this.overheated = false;
    }
    this.shield = Math.max(0, this.shield - (1 + 12 * this.count("shieldBurst")) * dt);
    this.dashBuffer = c.dash ? 0.12 : Math.max(0, this.dashBuffer - dt);
    const p = this.player,
      controls = { ...c },
      dash =
        this.dashBuffer > 0 &&
        p.dashCooldown <= 0 &&
        this.stamina >= 20 &&
        this.hostile.playerStatus.frozen <= 0;
    controls.dash = dash;
    if (dash) {
      this.stamina -= 20;
      this.dashBuffer = 0;
      this.slamming = false;
      this.slamWindup = 0;
    }
    // Use the free second jump first; module charges extend the same airborne sequence.
    if (c.jump && !p.grounded && p.coyote <= 0 && this.hostile.playerStatus.frozen <= 0) {
      if (!p.airJumpAvailable && this.airJumps > 0) {
        this.airJumps--;
        p.airJumpAvailable = true;
      }
      if (p.airJumpAvailable) {
        this.slamming = false;
        this.slamWindup = 0;
      }
    }
    if (this.slamming) {
      this.slamWindup = Math.max(0, this.slamWindup - dt);
      p.vy = this.slamWindup > 0 ? -40 : 1050;
      controls.jump = false;
      p.jumpBuffer = 0;
    }
    this.hostile.update(dt);
    if (this.hostile.playerStatus.frozen > 0) {
      controls.left = false;
      controls.right = false;
      controls.jump = false;
      controls.dash = false;
      p.vx = 0;
    }
    p.update(dt, controls, this.platforms);
    if (p.jumped) this.juice.motion(p.airJumped ? "airJump" : "jump", p.x, p.y + 24);
    if (p.landed > 150 && !this.slamming) this.juice.motion("land", p.x, p.y + 24, p.landed / 900);
    if (this.slamming && p.grounded) {
      const height = Math.max(0, p.y - this.slamY),
        n = this.count("slam");
      this.slamming = false;
      this.juice.beat("slam", p.x, p.y + 20, 0xf1e7c8);
      this.blast(p.x, p.y, 30 + height * 0.2 * n, this.attackRange(90 + height * 0.45 * n), 250 + height * n);
    }
    if (dash) {
      this.dashSerial++;
      this.emit("dash", p.x, p.y);
    }
    this.armory.update(dt, controls);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    if (this.result) return;
    this.updateProjectiles(dt);
    for (const g of this.grenades) {
      g.life -= dt;
      g.vy += 580 * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (g.life <= 0 || this.platforms.some((r) => overlaps({ x: g.x, y: g.y, w: 8, h: 8 }, r))) {
        this.blast(g.x, g.y - 10, 12, 160, 650);
        g.life = -1;
      }
    }
    this.grenades = this.grenades.filter((g) => g.life > 0);
    this.autoCollect();
    this.ascent?.update(dt, c);
    this.expedition?.update(dt, c, interactHeld, this.hurtThisFrame, this.attackedRecently());
    this.hurtThisFrame = false;
    if (this.expedition) {
      // Heavy cargo changes mobility directly, which is what makes carrying it a decision.
      const pen = this.expedition.penalty();
      p.cargoSpeed = pen.speed;
      p.cargoJump = pen.jump;
      p.cargoDash = pen.dash;
    }
    if (p.y > this.height + 40) this.hurtPlayer(100, p.x);
    this.extracting = interactHeld && this.nearby()?.type === "exit" && this.time - this.hurtAt > 1;
    this.extraction = this.extracting ? this.extraction + dt : 0;
    if (this.extraction >= 2 && !this.result) {
      this.result = "extracted";
      this.complete = true;
      this.record("extract", `cargo=${this.cargo}; slots=${this.slots.join(",")}`);
      if (this.expedition) {
        // Bank the carried value: only what is on you at the extractor counts.
        this.expedition.metrics.lootValueExtracted += this.expedition.cargo.value;
        this.expedition.metrics.heavyExtracted += this.expedition.cargo.items.filter(
          (i) => i.def.heavy,
        ).length;
        this.expedition.metrics.threatAtExtract = +this.expedition.eco.threat().toFixed(2);
        this.cargo += this.expedition.cargo.value;
      }
    }
    if (this.training) {
      this.enemies = this.enemies.filter((e) => !e.dead);
      this.areas.arena.enemies = this.enemies;
      this.clearDelay = this.enemies.length ? 0 : this.clearDelay + dt;
      if (
        this.trainingAuto &&
        (this.clearDelay >= 1.2 || this.time >= this.nextWaveAt) &&
        this.enemies.length < 28
      )
        this.startWave();
    }
  }
  step(seconds: number, c = idleControls()) {
    for (let i = 0; i < Math.ceil(seconds * 120); i++) {
      this.update(1 / 120, c);
      c = { ...c, jump: false, dash: false };
    }
  }
}
