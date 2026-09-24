import { configureEnemy, enemyBands, bandIndex, playerWeapon } from "./CombatBalance";
import { populateArea } from "./ExpeditionEncounters";
import { World } from "./World";
import { OrganRig } from "./OrganRig";
import { FieldDiscovery, type FieldFeature } from "./FieldDiscovery";
import { Player, type Controls } from "./Player";
import { EnemyModule } from "./EnemyModule";
import { clamp, distance, type Rect } from "./PhysicsHelpers";
import {
  zones,
  zoneOrder,
  seededRandom,
  shortcuts,
  type ZoneId,
  type Portal,
} from "./ExpeditionMap";
import {
  ProfileStore,
  emptyCargo,
  settle,
  buyUpgrade,
  type Cargo,
  type Profile,
  type Upgrade,
  type RunRecord,
  type ActiveRecord,
} from "./Progression";

export interface Salvage {
  id: string;
  x: number;
  y: number;
  kind: "cache" | "drop" | "coolant" | "signal" | "medkit";
  label: string;
  cargo: Cargo;
  taken: boolean;
}
export interface AreaState {
  world: World;
  loot: Salvage[];
  visited: boolean;
  lift?: Rect;
  liftClock?: number;
}
export type Interaction = {
  id: string;
  x: number;
  y: number;
  kind: "portal" | "loot" | "extract" | "feature" | "repair";
  shortcutId?: string;
  feature?: FieldFeature;
  blocked?: string;
  label: string;
  duration: number;
  portal?: Portal;
  loot?: Salvage;
};

export class Expedition {
  profile: Profile;
  rig = new OrganRig();
  discovery: FieldDiscovery;
  state: "hub" | "field" = "hub";
  areas = new Map<ZoneId, AreaState>();
  zoneId: ZoneId = "airlock";
  hubWorld: World;
  cargo = emptyCargo();
  seconds = 0;
  activity = 0;
  medkits = 2;
  healCooldown = 0;
  maxDepth = 0;
  route: ZoneId[] = [];
  seed = 0;
  random = seededRandom(1);
  interactionProgress = 0;
  interactionId = "";
  travelCooldown = 0;
  spawnClock = 0;
  saveClock = 0;
  beacon = false;
  stages = new Set<number>();
  rareIds = new Set<number>();
  pendingRare = false;
  globalStable: EnemyModule[] = [];
  lastRecord: RunRecord | null;
  message = "临时模块仅在当次出行中有效。";
  messageTime = 0;
  debugUsed = false;
  constructor(public store = new ProfileStore()) {
    this.profile = store.load();
    this.discovery = new FieldDiscovery(this.profile, 1, 0);
    this.lastRecord = this.profile.history[0] ?? null;
    this.hubWorld = this.emptyWorld();
    this.applyUpgrades(this.hubWorld, true);
  }
  get world() {
    return this.state === "field"
      ? this.areas.get(this.zoneId)!.world
      : this.hubWorld;
  }
  get area() {
    return this.areas.get(this.zoneId)!;
  }
  get zone() {
    return zones[this.zoneId];
  }
  get activityStage() {
    return this.activity >= 100
      ? "聚合状态"
      : this.activity >= 80
        ? "高活化"
        : this.activity >= 60
          ? "强化活化"
          : this.activity >= 30
            ? "残骸苏醒"
            : "正常状态";
  }
  get portals(): Portal[] {
    const result = [...this.zone.portals];
    for (const s of shortcuts)
      if (s.from === this.zoneId && this.profile.shortcuts.includes(s.id))
        result.push({
          id: s.id,
          to: s.to,
          x: s.x,
          y: this.zone.height - 134,
          arrival: {
            x: zones[s.to].portals[0].x + 85,
            y: zones[s.to].portals[0].y,
          },
          label: s.id + " ↓ " + zones[s.to].name,
          shortcut: s.id,
        });
    return result;
  }
  heal() {
    if (
      this.state !== "field" ||
      this.medkits <= 0 ||
      this.healCooldown > 0 ||
      this.world.player.hp >= this.world.player.maxHp
    )
      return false;
    this.medkits--;
    this.healCooldown = 1;
    this.world.player.hp = Math.min(
      this.world.player.maxHp,
      this.world.player.hp + 45,
    );
    this.say("应急医疗 +45 · 剩余 " + this.medkits + " 针");
    return true;
  }
  repair(id: string) {
    const s = shortcuts.find((s) => s.id === id);
    if (
      !s ||
      s.from !== this.zoneId ||
      this.profile.shortcuts.includes(id) ||
      this.cargo.material < s.cost ||
      distance(this.world.player, { x: s.x, y: this.zone.height - 134 }) > 85
    )
      return false;
    this.cargo.material -= s.cost;
    this.profile.shortcuts.push(id);
    this.activity = clamp(this.activity + s.activity, 0, 100);
    this.saveActive();
    this.say(id + " 已永久恢复 · 即使本次救援也保留；再按 W 下行");
    return true;
  }
  get discoveryContext() {
    return {
      activity: this.activity,
      connected: this.rig.modules
        .filter((m) => m.stable && !m.dead)
        .map((m) => m.kind),
      modules: this.world.modules,
    };
  }
  get nextGoal() {
    if (this.discovery.escort)
      return "工程师正在跟随 · S1 广场货梯 / S2 高架维修井均可折返";
    if (this.world.player.hp < this.world.player.maxHp * 0.35)
      return "生命告急 · H 使用医疗针；地图上绿色捷径通向地下";
    if (this.zone.depth >= 5)
      return this.activity >= 70
        ? "北线休眠匣已苏醒 · 西找活人，东探光塔，仍可返回"
        : "地表三路：西找活人 / 东探光塔 / 北追星骸";
    return this.rig.modules.length
      ? "沿核心升降井向上 · 隔离站外才是真正地表"
      : "击倒星骸后 E 接入器官 · 地下主廊可选三条路";
  }
  installOrgan() {
    if (this.state !== "field") return false;
    const before = this.rig.combos.length;
    if (!this.rig.installNearest(this.world)) return false;
    if (this.rig.combos.length > before)
      this.say(
        "组合接通：" +
          this.rig.combos.map((c) => c.name).join(" / ") +
          " · " +
          this.rig.combos[0].hint,
        7,
      );
    return true;
  }
  get totals() {
    let detached = 0,
      phased = 0;
    for (const a of this.areas.values()) {
      detached += a.world.stats.detached;
      phased += a.world.stats.phased;
    }
    return { detached, phased };
  }
  emptyWorld() {
    const w = new World();
    w.enemies = [];
    w.modules = [];
    w.projectiles = [];
    w.messageTime = 0;
    w.platforms = [{ x: 640, y: 665, w: 1280, h: 110 }];
    return w;
  }
  applyUpgrades(w: World, heal = false) {
    w.player.maxHp = this.profile.upgrades.health ? 125 : 100;
    if (heal) w.player.hp = w.player.maxHp;
    w.phaseCapacity = this.profile.upgrades.phase ? 4 : 3;
    w.shotInterval = this.profile.upgrades.weapon ? playerWeapon.upgradedInterval : playerWeapon.interval;
    w.shotDamage = this.profile.upgrades.weapon ? playerWeapon.upgradedDamage : playerWeapon.damage;
  }
  say(text: string, duration = 5) {
    this.message = text;
    this.messageTime = duration;
  }
  buy(key: Upgrade) {
    if (this.state !== "hub" || !buyUpgrade(this.profile, key)) return false;
    this.applyUpgrades(this.hubWorld, true);
    this.store.save(this.profile);
    return true;
  }
  start(seed?: number) {
    if (this.state === "field") return false;
    this.profile.sorties++;
    this.seed =
      seed ?? (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    this.random = seededRandom(this.seed);
    this.rig.reset();
    this.discovery = new FieldDiscovery(
      this.profile,
      this.seed,
      this.profile.sorties,
    );
    this.areas.clear();
    this.cargo = emptyCargo();
    this.seconds = 0;
    this.medkits = 2;
    this.healCooldown = 0;
    this.activity = 4;
    this.maxDepth = 0;
    this.route = [];
    this.stages.clear();
    this.rareIds.clear();
    this.globalStable = [];
    this.spawnClock = 0;
    this.saveClock = 0;
    this.beacon = false;
    this.pendingRare = false;
    this.interactionProgress = 0;
    this.interactionId = "";
    this.travelCooldown = 0.5;
    this.debugUsed = false;
    for (const id of zoneOrder) this.buildArea(id);
    const eventZones: ZoneId[] = ["nursery", "freight", "market"];
    const offset = this.profile.sorties % eventZones.length;
    for (let i = 0; i < 1 + (this.profile.sorties % 2); i++) {
      const id = eventZones[(offset + i) % eventZones.length];
      this.areas.get(id)!.loot.push({
        id: `event-${id}`,
        x: 530 + Math.floor(this.random() * 170),
        y: zones[id].height - 134,
        kind: i === 0 ? "coolant" : "signal",
        label: i === 0 ? "冷却泄流 · 活化 −15" : "未登记残骸 · 核心 / 活化 +8",
        cargo:
          i === 0
            ? { material: 3, core: 0, data: 1 }
            : { material: 4, core: 1, data: 1 },
        taken: false,
      });
    }
    // Keep the early junction readable. Rare encounters belong to deep space or high activity.
    if (this.random() < 0.3) this.spawn("crater", true);
    this.state = "field";
    this.zoneId = "airlock";
    this.area.visited = true;
    this.route.push("airlock");
    this.applyUpgrades(this.world, true);
    this.world.player.x = 330;
    this.world.player.y = this.zone.height - 134;
    this.say(
      this.profile.sorties === 1
        ? "击倒星骸 → E 接入器官 · W 搜索与通行 · 随时撤离"
        : "设施结构不变，但本次星骸、资源和事件已改变。",
      7,
    );
    this.saveActive();
    return true;
  }
  buildArea(id: ZoneId) {
    const z = zones[id],
      w = this.emptyWorld();
    w.width = z.width;
    w.height = z.height;
    w.player.boundsWidth = z.width;
    w.platforms = z.platforms.map((p) => ({ ...p }));
    w.rig = this.rig;
    w.salvageOnKill = true;
    w.roomIndex = id === "concourse" ? 1 : zoneOrder.indexOf(id);
    this.applyUpgrades(w, true);
    const a: AreaState = { world: w, loot: [], visited: false };
    this.areas.set(id, a);
    if (id === "core" || id === "tower") {
      a.lift = {
        x: z.width - 450,
        y: z.height - 100,
        w: 340,
        h: 20,
        oneWay: true,
      };
      a.liftClock = 0;
      w.platforms.push(a.lift);
      const top = z.portals.find((p) => p.y < z.height - 600)!;
      w.platforms.push({
        x: (top.x + a.lift.x) / 2,
        y: top.y + 34,
        w: Math.abs(top.x - a.lift.x) + 200,
        h: 20,
        oneWay: true,
      });
    }
    a.loot = populateArea(w, z, this.random, this.profile.sorties);
    for (const e of w.enemies) configureEnemy(w, e, z.depth);
    w.onEnemyKilled = (e) => {
      this.activity = clamp(this.activity + 0.38, 0, 100);
      const rare = this.rareIds.has(e.id),
        core =
          e.kind === "elite" || rare
            ? 2
            : Number(
                z.depth >= 2 &&
                  this.random() < (this.activity >= 60 ? 0.45 : 0.18),
              );
      a.loot.push({
        id: `drop-${e.id}`,
        x: e.x,
        y: e.y,
        kind: "drop",
        label: rare ? "稀有星骸残留" : "星骸残留",
        cargo: {
          material: e.kind === "elite" ? 10 : 4,
          core,
          data: rare ? 2 : Number(this.activity >= 60),
        },
        taken: false,
      });
    };
    w.onModuleDetached = (m) => {
      this.activity = clamp(this.activity + 0.22, 0, 100);
      a.loot.push({
        id: `detach-${m.id}`,
        x: m.x,
        y: m.y,
        kind: "drop",
        label: "完整拆解材料",
        cargo: { material: 2, core: 0, data: 0 },
        taken: false,
      });
    };
  }
  activeRecord(): ActiveRecord {
    return {
      cargo: { ...this.cargo },
      seconds: this.seconds,
      activity: this.activity,
      route: [...this.route],
      ...this.totals,
      seed: this.seed,
      build: this.rig.modules.map((m) => m.kind),
      findings: [...this.discovery.found],
      escort: this.discovery.escort,
    };
  }
  saveActive() {
    if (this.state !== "field") return;
    this.profile.active = this.activeRecord();
    this.store.save(this.profile);
  }
  finish(outcome: "extracted" | "rescued") {
    if (this.state !== "field") return null;
    this.lastRecord = settle(this.profile, this.activeRecord(), outcome);
    this.rig.reset();
    for (const a of this.areas.values()) {
      a.world.modules = [];
      a.world.held = null;
      a.world.stableQueue = [];
      a.world.projectiles = [];
    }
    this.areas.clear();
    this.globalStable = [];
    this.cargo = emptyCargo();
    this.state = "hub";
    this.hubWorld = this.emptyWorld();
    this.applyUpgrades(this.hubWorld, true);
    this.store.save(this.profile);
    return this.lastRecord;
  }
  collect(item: Salvage) {
    if (this.state !== "field" || item.taken) return;
    item.taken = true;
    if (item.kind === "medkit") {
      this.medkits = Math.min(5, this.medkits + 1);
      this.say("医疗针 +1 · H 使用");
      return;
    }
    for (const k of ["material", "core", "data"] as const)
      this.cargo[k] += item.cargo[k];
    if (item.kind === "coolant")
      this.activity = Math.max(0, this.activity - 15);
    else if (item.kind === "signal") {
      this.activity = Math.min(100, this.activity + 8);
      this.spawn(this.zoneId);
      this.spawn(this.zoneId);
    } else if (item.kind === "cache")
      this.activity = Math.min(100, this.activity + 0.8);
    this.world.emit("phase", item.x, item.y, 0xcbdca9);
    this.say(
      item.kind === "coolant"
        ? "冷却泄流已开启 · 活化度降低 15%"
        : `${item.label}已收取 · 仅撤离后存入据点`,
    );
    this.saveActive();
  }
  interaction(): Interaction | null {
    if (this.state !== "field") return null;
    const p = this.world.player,
      candidates: Interaction[] = [];
    for (const portal of this.portals)
      if (distance(p, portal) < 72)
        candidates.push({
          id: `portal-${portal.id}`,
          kind: "portal",
          x: portal.x,
          y: portal.y,
          label: portal.label,
          duration: 0,
          portal,
        });
    for (const loot of this.area.loot)
      if (!loot.taken && loot.kind !== "drop" && distance(p, loot) < 78)
        candidates.push({
          id: loot.id,
          kind: "loot",
          x: loot.x,
          y: loot.y,
          label: loot.label,
          duration: loot.kind === "cache" ? 1.25 : 1.8,
          loot,
        });
    for (const s of shortcuts)
      if (
        s.from === this.zoneId &&
        !this.profile.shortcuts.includes(s.id) &&
        distance(p, { x: s.x, y: this.zone.height - 134 }) < 85
      )
        candidates.push({
          id: s.id,
          shortcutId: s.id,
          kind: "repair",
          x: s.x,
          y: this.zone.height - 134,
          label: s.label + " · 材料 " + s.cost + " / 永久保存",
          duration: s.duration,
          blocked:
            this.cargo.material < s.cost ? "需本局材料 " + s.cost : undefined,
        });
    for (const feature of this.discovery.features)
      if (
        feature.zoneId === this.zoneId &&
        !feature.done &&
        distance(p, feature) < 74
      )
        candidates.push({
          id: feature.id,
          kind: "feature",
          x: feature.x,
          y: feature.y,
          label: feature.label,
          duration: feature.duration,
          feature,
          blocked: this.discovery.blockedReason(feature, this.discoveryContext),
        });
    if (this.zoneId === "airlock" && distance(p, { x: 175, y: 565 }) < 86)
      candidates.push({
        id: "extract",
        x: 175,
        y: 565,
        kind: "extract",
        label: "安全撤离 · 带回 100% 资源",
        duration: 1.5,
      });
    return (
      candidates.sort((a, b) => distance(p, a) - distance(p, b))[0] ?? null
    );
  }
  travel(id: string) {
    if (this.state !== "field" || this.travelCooldown > 0) return false;
    const portal = this.portals.find((p) => p.id === id);
    if (!portal || distance(this.world.player, portal) > 75) return false;
    if (portal.shortcut) this.activity = clamp(this.activity + 2, 0, 100);
    const previous = this.world,
      next = this.areas.get(portal.to)!.world,
      player = previous.player,
      held = previous.held;
    this.globalStable = previous.stableQueue.filter((m) => !m.dead && m.stable);
    const carried = [...this.rig.modules, ...(held ? [held] : [])];
    previous.modules = previous.modules.filter((m) => !carried.includes(m));
    previous.held = null;
    for (const m of carried)
      if (!next.modules.includes(m)) next.modules.push(m);
    next.held = held;
    this.rig.implosions = [];
    this.zoneId = portal.to;
    next.player = player;
    player.boundsWidth = next.width;
    next.god = previous.god;
    next.stableQueue = this.globalStable;
    this.applyUpgrades(next);
    player.x = portal.arrival.x;
    player.y = portal.arrival.y;
    player.vx = 0;
    player.vy = 0;
    player.externalX = 0;
    player.invulnerable = Math.max(player.invulnerable, 0.75);
    player.dashTime = 0;
    player.grounded = false;
    if (held) {
      held.x = player.x + 55;
      held.y = player.y - 15;
    }
    if (!this.area.visited) {
      this.area.visited = true;
      this.activity = clamp(
        this.activity + Math.max(0, this.zone.depth - this.maxDepth) * 3,
        0,
        100,
      );
      this.maxDepth = Math.max(this.maxDepth, this.zone.depth);
    }
    this.route.push(this.zoneId);
    this.travelCooldown = 0.65;
    this.interactionId = "";
    this.interactionProgress = 0;
    this.say(
      this.zoneId === "airlock"
        ? "已进入安全气闸 · 左侧长按 W 撤离"
        : this.zone.description,
    );
    this.saveActive();
    return true;
  }
  spawn(id: ZoneId, rare = false) {
    if (zones[id].quiet) return false;
    const w = this.areas.get(id)!.world;
    if (
      w.enemies.filter((e) => !e.dead && distance(e, w.player) < 1300).length >=
      7
    )
      return false;
    const x = clamp(
      w.player.x + (this.random() < 0.5 ? -1 : 1) * 950,
      200,
      w.width - 200,
    );
    const needsThruster =
      id === "concourse" &&
      !w.modules.some((m) => m.kind === "thruster" && !m.dead);
    const kind = rare
      ? "elite"
      : needsThruster
        ? "crawler"
        : this.activity >= 60
          ? this.random() < 0.5
            ? "reclaimer"
            : "floater"
          : "crawler";
    const e = w.spawnEnemy(
      kind,
      x,
      w.height - 134 - (kind === "floater" ? 190 : 0),
      kind === "crawler"
        ? needsThruster
          ? "thruster"
          : this.random() < 0.5
            ? "gun"
            : "thruster"
        : undefined,
    );
    configureEnemy(w, e, zones[id].depth);
    if (rare) {
      this.rareIds.add(e.id);
      e.hp = e.maxHp *= 1.15;
    }
    return true;
  }
  update(
    dt: number,
    c: Controls,
    interactHeld = false,
    interactPressed = false,
  ) {
    if (this.state !== "field") return;
    this.seconds += dt;
    this.healCooldown = Math.max(0, this.healCooldown - dt);
    this.messageTime -= dt;
    this.travelCooldown = Math.max(0, this.travelCooldown - dt);
    this.activity = clamp(
      this.activity +
        dt *
          (this.zone.quiet
            ? 0
            : (this.zone.depth >= 7 ? 0.09 : 0.012) +
              this.zone.depth * 0.003 +
              (c.fire ? 0.008 : 0)),
      0,
      100,
    );
    this.world.damageScale =
      this.activity >= 100
        ? 1.7
        : this.activity >= 80
          ? 1.4
          : this.activity >= 60
            ? 1.15
            : 1;
    this.world.damageScale *= enemyBands[bandIndex(this.zone.depth)].attack;
    if (this.area.lift) {
      const lift = this.area.lift,
        oldTop = lift.y - lift.h / 2;
      this.area.liftClock = (this.area.liftClock ?? 0) + dt;
      const cycle = this.area.liftClock % 42,
        upper =
          this.zone.portals.find((p) => p.y < this.zone.height - 600)?.y ?? 450;
      const blend =
        cycle < 6
          ? 0
          : cycle < 21
            ? (cycle - 6) / 15
            : cycle < 27
              ? 1
              : (42 - cycle) / 15;
      lift.y = (this.zone.height - 100) * (1 - blend) + (upper + 34) * blend;
      for (const b of [
        this.world.player,
        ...this.world.modules.filter((m) => !m.parent && !m.mounted && !m.held),
      ])
        if (
          Math.abs(b.x - lift.x) < (lift.w + b.w) / 2 &&
          Math.abs(b.y + b.h / 2 - oldTop) < 5 &&
          b.vy >= 0
        )
          b.y += lift.y - lift.h / 2 - oldTop;
    }
    const hpBefore = this.world.player.hp;
    this.world.update(dt, c);
    this.globalStable = this.world.stableQueue;
    if (this.world.dead) {
      this.finish("rescued");
      return;
    }
    for (const item of this.area.loot)
      if (!item.taken && item.kind === "drop") {
        item.y = Math.min(this.zone.height - 134, item.y + dt * 500);
        if (distance(item, this.world.player) < 48) this.collect(item);
      }
    const target = this.interaction();
    if (!target || !interactHeld) {
      this.interactionProgress = 0;
      this.interactionId = "";
    } else if (target.blocked) {
      this.interactionProgress = 0;
      if (interactPressed) this.say(target.blocked, 3);
    } else if (target.kind === "portal") {
      if (interactPressed && this.travel(target.portal!.id)) return;
    } else if (this.world.player.hp < hpBefore) {
      this.interactionProgress = 0;
      this.say("搜索被打断 · 先用炮腕清敌，或用甲壳遮住弹道", 2);
    } else {
      if (this.interactionId !== target.id) {
        this.interactionId = target.id;
        this.interactionProgress = 0;
      }
      this.interactionProgress += dt;
      if (this.interactionProgress >= target.duration) {
        this.interactionProgress = 0;
        if (target.kind === "extract") {
          this.finish("extracted");
          return;
        } else if (target.kind === "repair") {
          this.repair(target.shortcutId!);
        } else if (target.kind === "feature") {
          const reward = this.discovery.complete(
            target.feature!,
            this.discoveryContext,
          );
          if (reward) {
            for (const key of ["material", "core", "data"] as const)
              this.cargo[key] += reward.cargo[key];
            this.activity = clamp(this.activity + reward.activity, 0, 100);
            this.say(reward.message, 7);
            this.world.emit("phase", target.x, target.y, 0xc9dbaa);
            this.saveActive();
          }
        } else this.collect(target.loot!);
      }
    }
    for (const stage of [30, 60, 80, 100])
      if (this.activity >= stage && !this.stages.has(stage)) {
        this.stages.add(stage);
        this.say(
          stage === 100
            ? "聚合状态 · 撤离路线仍开放，更多星骸正在苏醒"
            : stage === 80
              ? "高活化 · 稀有星骸接近，核心产出增加"
              : stage === 60
                ? "强化活化 · 更强星骸携带更高价值残留"
                : "残骸开始苏醒 · 增援频率上升",
          7,
        );
        if (stage >= 80) this.pendingRare = true;
      }
    if (
      this.pendingRare &&
      this.zone.depth >= 5 &&
      this.spawn(this.zoneId, true)
    )
      this.pendingRare = false;
    if (this.activity >= 65 && !this.beacon) {
      this.beacon = true;
      const taken = this.areas
        .get("crater")
        ?.loot.find((item) => item.id === "crater-0")?.taken;
      this.say(
        taken
          ? "核心已收入背包。返回气闸，可以保住这一趟的成果。"
          : "北线信标：星骸坠落坑与聚合巢正在活化。继续上行，还是先送人回家？",
        8,
      );
    }
    if (!this.zone.quiet) {
      this.spawnClock += dt;
      let interval =
        this.activity >= 100
          ? 25
          : this.activity >= 80
            ? 40
            : this.activity >= 60
              ? 65
              : this.activity >= 30
                ? 90
                : 150;
      if (
        this.zoneId === "concourse" &&
        !this.world.modules.some((m) => m.kind === "thruster" && !m.dead)
      )
        interval = Math.min(interval, 20);
      if (this.spawnClock >= interval) {
        this.spawnClock = 0;
        this.spawn(this.zoneId, this.activity >= 100 && this.random() < 0.35);
      }
    }
    this.saveClock += dt;
    if (this.saveClock > 8) {
      this.saveClock = 0;
      this.saveActive();
    }
  }
}
