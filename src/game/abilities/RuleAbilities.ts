import { registerRuleModules } from "./RuleModules";
import { Projectile } from "../../engine/Projectile";
import { distance, rayRect } from "../../engine/PhysicsHelpers";
import type { Renderer } from "../../engine/Renderer";
import type { Controls } from "../../engine/Player";
import type { SliceWorld, Carrier } from "../SliceWorld";
import type { Companion } from "../Armory";
import { AbilityEvents, type AbilityEvent, type EventName, type Tag } from "./AbilityEvents";
import { exoticWeapons } from "./Content";
type Point = { x: number; y: number };
type Shot = {
  root: number;
  generation: number;
  kind: string;
  returning: boolean;
  returned: boolean;
  split: boolean;
  refracted: boolean;
  tags: Set<Tag>;
};
type Anchor = Point & { host?: Carrier; life: number };
type Line = { a: Anchor; b: Anchor; life: number; clock: number; rift: boolean };
export class RuleAbilities {
  events = new AbilityEvents();
  shots = new WeakMap<Projectile, Shot>();
  anchors: Anchor[] = [];
  lines: Line[] = [];
  corpses: (Point & { life: number; clock: number })[] = [];
  pending: (Point & { damage: number; radius: number; push: number; except?: Carrier; life: number })[] = [];
  bubble: (Point & { radius: number; stored: number }) | null = null;
  mirror: (Point & { life: number }) | null = null;
  tether: { target: Anchor; life: number } | null = null;
  stitches: { a: Carrier; b: Carrier; life: number }[] = [];
  debts = new WeakMap<Carrier, number>();
  private hosts = new WeakMap<Companion, Carrier>();
  private root = 0;
  private peakProjectiles = 0;
  private maxGeneration = 0;
  volleyMirror: Point | null = null;
  private budget = 48;
  private resolving = false;
  constructor(public w: SliceWorld) {
    registerRuleModules(this);
  }
  emit(type: EventName, data: Partial<AbilityEvent> = {}) {
    return this.events.emit({
      type,
      tags: new Set(),
      x: this.w.player.x,
      y: this.w.player.y,
      amount: 0,
      ...data,
    });
  }
  register(b: Projectile, kind = "normal", generation = 0, root?: number, copy = false) {
    this.maxGeneration = Math.max(this.maxGeneration, generation);
    const tags = new Set<Tag>(["Projectile"]);
    if (copy) tags.add("Copy");
    if (kind === "companion" || kind === "corpse") tags.add("Summon");
    if (kind === "shell") tags.add("PhysicalObject");
    if (generation) tags.add("Child");
    if (this.w.armory.shots.get(b)?.heavy) tags.add("Heavy");
    this.shots.set(b, {
      root: root ?? ++this.root,
      generation,
      kind,
      returning: false,
      returned: false,
      split: false,
      refracted: false,
      tags,
    });
    if (this.w.count("returnMembrane")) b.life = Math.min(b.life, 0.55);
    this.emit("AttackCreated", { projectile: b, x: b.x, y: b.y, tags });
  }
  spawn(
    x: number,
    y: number,
    angle: number,
    damage: number,
    heavy: boolean,
    kind = "normal",
    generation = 0,
    root?: number,
    copy = false,
  ) {
    if (this.budget-- <= 0 || this.w.projectiles.length >= 1200) return null;
    const b = new Projectile(
      x + Math.cos(angle) * 6,
      y + Math.sin(angle) * 6,
      Math.cos(angle) * 850,
      Math.sin(angle) * 850,
      "player",
      damage,
    );
    b.life = kind === "blade" ? 0.48 : kind === "recoil" ? 0.3 : 0.8;
    this.w.armory.shots.set(b, { heavy, powered: false, piercing: kind === "blade", hits: new Set() });
    this.w.projectiles.push(b);
    this.register(b, kind, generation, root, copy);
    return b;
  }
  clone(b: Projectile, x: number, y: number, angle: number, scale: number, copy: boolean) {
    const m = this.shots.get(b)!;
    return this.spawn(
      x,
      y,
      angle,
      b.damage * scale,
      this.w.armory.shots.get(b)?.heavy ?? false,
      m.kind,
      m.generation + (copy ? 0 : 1),
      m.root,
      copy,
    );
  }
  returnShot(b: Projectile) {
    const m = this.shots.get(b);
    if (!m || m.returned) return;
    m.returned = true;
    m.returning = true;
    m.tags.add("Returning");
    this.emit("ProjectileReturn", { projectile: b, x: b.x, y: b.y, tags: m.tags });
    b.dead = false;
    b.life = 1.4 + 0.25 * this.w.count("returnMembrane");
    const data = this.w.armory.shots.get(b)!;
    data.hits.clear();
    if (m.kind === "blade") data.heavy = true;
  }
  beforeProjectile(b: Projectile, dt: number) {
    const m = this.shots.get(b);
    if (!m) return;
    if (m.returning) {
      if (distance(b, this.w.player) < 24) {
        b.dead = true;
        return;
      }
      const a = Math.atan2(this.w.player.y - b.y, this.w.player.x - b.x);
      b.vx = Math.cos(a) * 1050;
      b.vy = Math.sin(a) * 1050;
    }
    if (!m.refracted && this.w.count("refract")) {
      const surfaces: Point[] = [...this.w.armory.units];
      if (this.w.armory.blocking) surfaces.push(this.w.player);
      const dx = b.vx * dt,
        dy = b.vy * dt;
      if (surfaces.some((p) => rayRect(b.x, b.y, dx, dy, { ...p, w: 40, h: 60 }, 2) !== null)) {
        m.refracted = true;
        const target = this.w.enemies.find((e) => !e.dead && distance(e, b) < 900);
        const a = target ? Math.atan2(target.y - b.y, target.x - b.x) : Math.atan2(b.vy, b.vx) - 0.5;
        b.vx = Math.cos(a) * 1000;
        b.vy = Math.sin(a) * 1000;
        b.damage *= 1 + 0.05 * this.w.count("refract");
        this.w.armory.shots.get(b)!.heavy = true;
      }
    }
  }
  contact(b: Projectile, target?: Carrier) {
    const m = this.shots.get(b);
    if (!m) return;
    this.emit(target ? "ProjectileHit" : "WallHit", {
      projectile: b,
      target,
      x: target?.x ?? b.x,
      y: target?.y ?? b.y,
      tags: m.tags,
    });
    if (!target && m.kind === "blade" && !m.returned) {
      b.x -= Math.sign(b.vx) * 5;
      b.y -= Math.sign(b.vy) * 5;
      this.returnShot(b);
    }
    if (m.kind === "nail" && !m.returning) {
      const a: Anchor = { x: target?.x ?? b.x, y: target?.y ?? b.y, host: target, life: 7 };
      const last = this.anchors.at(-1);
      if (last) this.lines.push({ a: last, b: a, life: 6, clock: 0, rift: false });
      this.anchors.push(a);
      this.anchors = this.anchors.slice(-8);
      this.lines = this.lines.slice(-20);
    }
    if (m.kind === "harpoon" && !m.returning) {
      if (target && target.kind !== "elite" && target.maxHp < 250) {
        target.impulseX = Math.sign(this.w.player.x - target.x) * 1100;
        target.vy = -160;
      } else
        this.tether = {
          target: { x: target?.x ?? b.x, y: target?.y ?? b.y, host: target, life: 1 },
          life: 0.55,
        };
    }
  }
  expire(b: Projectile) {
    const m = this.shots.get(b);
    if (!m || b.dead) return;
    if (m.kind === "blade") this.returnShot(b);
    this.emit("ProjectileExpire", { projectile: b, x: b.x, y: b.y, tags: m.tags });
  }
  explosion(x: number, y: number, damage: number, radius: number, push: number, except?: Carrier) {
    this.emit("Explosion", { x, y, amount: damage, tags: new Set(["Explosion"]) });
    if (this.resolving || !this.w.count("vacuum")) return false;
    this.pending.push({ x, y, damage, radius, push, except, life: 0.3 });
    this.pending = this.pending.slice(-40);
    return true;
  }
  attached(unit: Companion) {
    const host = this.hosts.get(unit);
    if (!host || host.dead) return false;
    unit.x = host.x;
    unit.y = host.y - 28;
    return true;
  }
  deploy(unit: Companion) {
    this.emit("Deploy", { x: unit.x, y: unit.y, tags: new Set(["Deploy"]) });
    if (this.w.count("parasite")) {
      const p = this.w.player;
      const host = this.w.enemies
        .filter(
          (e) =>
            !e.dead &&
            distance(e, p) < 360 + 40 * this.w.count("parasite") &&
            (e.x - p.x) * Math.cos(p.aim) + (e.y - p.y) * Math.sin(p.aim) > 0,
        )
        .sort((a, b) => distance(a, p) - distance(b, p))[0];
      if (host) this.hosts.set(unit, host);
    }
  }
  weapon(dt: number, c: Controls, speed: number) {
    const w = this.w,
      p = w.player,
      id = w.armory.primary;
    if (!Object.hasOwn(exoticWeapons, id)) return false;
    if (id === "gravity") {
      if (c.fire && w.stamina > 0 && (this.bubble || p.fireCooldown <= 0)) {
        w.noteAttack();
        if (!this.bubble) {
          let reach = 1;
          for (const wall of w.platforms) {
            if (wall.oneWay) continue;
            const t = rayRect(p.x, p.y, Math.cos(p.aim) * 180, Math.sin(p.aim) * 180, wall, 8);
            if (t !== null) reach = Math.min(reach, Math.max(0, t - 0.03));
          }
          this.bubble = {
            x: p.x + Math.cos(p.aim) * 180 * reach,
            y: p.y + Math.sin(p.aim) * 180 * reach,
            radius: 110,
            stored: 0,
          };
        }
        this.bubble.radius = Math.min(220, this.bubble.radius + 150 * dt);
        w.stamina = Math.max(0, w.stamina - 14 * dt);
      } else if (this.bubble) {
        this.collapse();
        p.fireCooldown = 0.4 / speed;
      }
      return true;
    }
    if (!c.fire || p.fireCooldown > 0 || w.armory.blocking) return true;
    w.noteAttack();
    p.fireCooldown = (id === "recoil" ? 0.5 : id === "harpoon" ? 0.7 : 0.4) / speed;
    if (id === "rift") {
      w.armory.melee(23, false, 100);
      const a = { x: p.x, y: p.y, life: 4 },
        b = { x: p.x + Math.cos(p.aim) * 180, y: p.y + Math.sin(p.aim) * 180, life: 4 };
      for (const l of this.lines.filter((l) => l.rift))
        if (this.cross(a, b, l.a, l.b)) w.blast((a.x + b.x) / 2, (a.y + b.y) / 2, 40, 120, 180);
      this.lines.push({ a, b, life: 3.5, clock: 0, rift: true });
      this.lines = this.lines.slice(-20);
    } else {
      this.volleyMirror = this.mirror;
      for (let i = 0; i < (id === "recoil" ? 7 : 1); i++) {
        const angle = p.aim + (id === "recoil" ? (i - 3) * 0.075 : 0);
        const b = w.armory.shoot(
          id === "recoil" ? 19 : id === "harpoon" ? 28 : 17,
          false,
          id === "blade",
          p.x,
          p.y,
          angle,
          false,
          id,
        );
        if (b) b.life = id === "recoil" ? 0.3 : id === "blade" ? 0.48 : 0.8;
      }
      this.volleyMirror = null;
      if (id === "recoil") {
        const grounded = p.grounded;
        p.vx -= Math.cos(p.aim) * (grounded ? 75 : 150);
        p.externalX -= Math.cos(p.aim) * (grounded ? 2200 : 5500);
        if (!grounded) p.vy -= Math.sin(p.aim) * 360;
      }
    }
    w.skills.addHeat(7);
    return true;
  }
  private cross(a: Point, b: Point, c: Point, d: Point) {
    const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
  }
  private collapse() {
    const b = this.bubble;
    if (!b) return;
    this.bubble = null;
    this.w.blast(b.x, b.y, 65 + b.radius * 0.45 + Math.min(140, b.stored), b.radius, 450);
  }
  update(dt: number) {
    this.budget = 48;
    this.peakProjectiles = Math.max(this.peakProjectiles, this.w.projectiles.length);
    const w = this.w;
    if (this.mirror && (this.mirror.life -= dt) <= 0) this.mirror = null;
    if (w.armory.primary !== "gravity" && this.bubble) this.collapse();
    if (this.tether) {
      const t = this.tether;
      t.life -= dt;
      if (t.target.host && !t.target.host.dead) {
        t.target.x = t.target.host.x;
        t.target.y = t.target.host.y;
      }
      const d = distance(w.player, t.target);
      if (t.life <= 0 || d < 35) this.tether = null;
      else {
        w.player.grounded = false;
        w.player.externalX = ((t.target.x - w.player.x) / Math.max(1, d)) * 18000;
        w.player.vx = ((t.target.x - w.player.x) / Math.max(1, d)) * 650;
        w.player.vy = ((t.target.y - w.player.y) / Math.max(1, d)) * 680;
      }
    }
    for (const u of w.armory.units) {
      const h = this.hosts.get(u);
      if (h && !h.dead) {
        u.x = h.x;
        u.y = h.y - 28;
      } else if (h) this.hosts.delete(u);
    }
    const pull = (b: Point, r: number, force: number) => {
      for (const e of w.enemies)
        if (!e.dead && distance(b, e) < r && w.canSee(b, e)) {
          e.impulseX += (b.x - e.x) * force * dt;
          e.vy += (b.y - e.y) * force * dt;
        }
    };
    if (this.bubble) {
      const b = this.bubble;
      pull(b, b.radius, 18);
      for (const shot of w.projectiles)
        if (!shot.dead && distance(b, shot) < b.radius && w.canSee(b, shot)) {
          shot.vx += (b.x - shot.x) * 35 * dt;
          shot.vy += (b.y - shot.y) * 35 * dt;
          if (distance(b, shot) < 35) {
            b.stored += shot.damage;
            shot.dead = true;
          }
        }
      for (const d of w.drops)
        if (distance(b, d) < b.radius && w.canSee(b, d)) {
          d.x += (b.x - d.x) * dt * 3;
          d.y += (b.y - d.y) * dt * 3;
        }
    }
    for (const b of this.pending) {
      pull(b, b.radius, 9 + 3 * w.count("vacuum"));
      b.life -= dt;
      if (b.life <= 0) {
        this.resolving = true;
        w.blast(b.x, b.y, b.damage, b.radius, b.push, b.except);
        this.resolving = false;
      }
    }
    this.pending = this.pending.filter((b) => b.life > 0);
    for (const l of this.lines) {
      l.life -= dt;
      for (const a of [l.a, l.b])
        if (a.host && !a.host.dead) {
          a.x = a.host.x;
          a.y = a.host.y;
        }
      l.clock -= dt;
      if (l.clock <= 0) {
        l.clock = 0.25;
        for (const e of w.enemies)
          if (
            !e.dead &&
            w.canSee(l.a, e) &&
            rayRect(l.a.x, l.a.y, l.b.x - l.a.x, l.b.y - l.a.y, e, 6) !== null
          )
            w.hit(e, l.rift ? 8 : 6, true, 0, false);
      }
      if (!l.rift)
        for (const [a, b] of [
          [l.a, l.b],
          [l.b, l.a],
        ])
          if (a.host && !a.host.dead && distance(a, b) > 100) a.host.impulseX += (b.x - a.x) * dt * 2;
    }
    this.lines = this.lines.filter(
      (l) => l.life > 0 && (!l.a.host || !l.a.host.dead) && (!l.b.host || !l.b.host.dead),
    );
    this.anchors = this.anchors.filter((a) => (a.life -= dt) > 0 && (!a.host || !a.host.dead));
    this.stitches = this.stitches.filter((s) => (s.life -= dt) > 0 && !s.a.dead && !s.b.dead);
    for (const c of [...this.corpses]) {
      c.life -= dt;
      c.clock -= dt;
      if (c.clock <= 0) {
        c.clock = 0.65;
        const target = w.enemies.find((e) => !e.dead && distance(c, e) < 600 && w.canSee(c, e));
        if (target) this.spawn(c.x, c.y, Math.atan2(target.y - c.y, target.x - c.x), 9, false, "corpse");
      }
    }
    this.corpses = this.corpses.filter((c) => c.life > 0);
  }
  snapshot() {
    return {
      events: { ...this.events.counts },
      roots: this.root,
      maxGeneration: this.maxGeneration,
      peakProjectiles: this.peakProjectiles,
      anchors: this.anchors.length,
      lines: this.lines.length,
      corpses: this.corpses.length,
      pendingExplosions: this.pending.length,
    };
  }
  render(art: Renderer) {
    const g = art.g;
    for (const b of this.w.projectiles) {
      const m = this.shots.get(b);
      if (!m) continue;
      const color = m.returning
        ? 0xffd182
        : m.kind === "nail"
          ? 0x9adfe4
          : m.kind === "harpoon"
            ? 0xe3bb83
            : 0xc6b7ef;
      if (m.kind === "blade") {
        g.lineStyle(3, color, 0.9);
        g.beginPath();
        g.arc(b.x, b.y, 10, this.w.time * 18, this.w.time * 18 + Math.PI * 1.4);
        g.strokePath();
      } else if (m.kind !== "normal" || m.returning) {
        const a = Math.atan2(b.vy, b.vx);
        g.lineStyle(m.kind === "shell" ? 7 : 3, color, 0.9);
        g.lineBetween(b.x, b.y, b.x - Math.cos(a) * 17, b.y - Math.sin(a) * 17);
      }
    }
    for (const e of this.w.enemies) {
      const debt = this.debts.get(e);
      if (debt && !e.dead)
        art.label(`debt-${e.id}`, e.x - 20, e.y - e.h / 2 - 38, `欠账 ${Math.round(debt)}`, "#e7ca84", 11);
    }

    for (const l of this.lines) {
      g.lineStyle(l.rift ? 4 : 2, l.rift ? 0xcfabef : 0x9bd6df, 0.7);
      g.lineBetween(l.a.x, l.a.y, l.b.x, l.b.y);
    }
    for (const a of this.anchors) {
      g.fillStyle(0xe5c586);
      g.fillCircle(a.x, a.y, 5);
    }
    for (const s of this.stitches) {
      g.lineStyle(2, 0xd9a991, 0.6);
      g.lineBetween(s.a.x, s.a.y, s.b.x, s.b.y);
    }
    if (this.tether) {
      g.lineStyle(3, 0xe6c794);
      g.lineBetween(this.w.player.x, this.w.player.y, this.tether.target.x, this.tether.target.y);
    }
    for (const b of [...this.pending, ...(this.bubble ? [this.bubble] : [])]) {
      g.fillStyle(0x91b4de, 0.12);
      g.fillCircle(b.x, b.y, b.radius);
      g.lineStyle(2, 0x9dc6ee, 0.7);
      g.strokeCircle(b.x, b.y, b.radius);
    }
    if (this.mirror) {
      g.lineStyle(2, 0xccb4ef, 0.8);
      g.strokeCircle(this.mirror.x, this.mirror.y, 21);
    }
    for (const c of this.corpses) {
      g.fillStyle(0xb5c88c, 0.7);
      g.fillTriangle(c.x, c.y - 18, c.x - 12, c.y + 8, c.x + 12, c.y + 8);
    }
  }
}
