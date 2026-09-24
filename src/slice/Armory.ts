import { Projectile } from "../Projectile";
import { clamp, distance } from "../PhysicsHelpers";
import type { Controls } from "../Player";
import { weapons, secondaries, type WeaponId, type SecondaryId } from "./config";
import type { SliceWorld } from "./SliceWorld";

export interface ShotData { heavy: boolean; powered: boolean; piercing: boolean; hits: Set<number> }
export interface Companion { id: number; type: "drone" | "turret"; x: number; y: number; hp: number; cooldown: number; invulnerable: number }
const rhythm = [0.23, 0.46, 0.23, 0.23, 0.46, 0.23, 0.23, 0.23, 0.46, 0.23, 0.46];
export class Armory {
  primary: WeaponId = "handgun"; secondary: SecondaryId = "grenade";
  previousFire = false; previousQ = false; charge = 0; grenadeCharge = 0;
  rhythmStacks = 0; rhythmIndex = 0; lastBeat = -10; rhythmFeedback = "跟随节拍点按";
  combo = 0; comboUntil = 0; droneStock = 8; nextUnit = 1;
  blocking = false; blockAge = 0; units: Companion[] = [];
  swing = { radius: 0, life: 0, angle: 0, heavy: false };
  shots = new WeakMap<Projectile, ShotData>();
  constructor(public w: SliceWorld) {}
  switchPrimary(id: WeaponId) { if (!weapons[id]) return; this.primary = id; this.charge = 0; this.previousFire = false; this.combo = 0; this.w.record("weapon", id); }
  switchSecondary(id: SecondaryId) { if (!secondaries[id]) return; this.secondary = id; this.grenadeCharge = 0; this.previousQ = false; this.blocking = false; this.w.record("secondary", id); }
  shoot(damage: number, heavy: boolean, piercing = false, x = this.w.player.x, y = this.w.player.y, angle = this.w.player.aim) {
    const w = this.w, powered = heavy && w.count("discharge") > 0 && w.energy > 0;
    if (powered) { w.energy--; damage += 32 * w.count("discharge"); }
    const b = new Projectile(x + Math.cos(angle) * 19, y + Math.sin(angle) * 19, Math.cos(angle) * (piercing ? 1600 : 980), Math.sin(angle) * (piercing ? 1600 : 980), "player", damage);
    this.shots.set(b, { heavy, powered, piercing, hits: new Set() });
    if (powered) w.shotHeavy.add(b);
    w.projectiles.push(b); w.metrics.shots++; w.emit("shot", b.x, b.y, heavy ? 0xffc87e : 0xe7edbd, angle);
  }
  melee(damage: number, heavy: boolean, radius: number) {
    const w = this.w, p = w.player;
    this.swing = { radius: w.attackRange(radius), life: 0.2, angle: p.aim, heavy };
    let powered = false;
    if (heavy && w.count("discharge") && w.energy > 0) { w.energy--; powered = true; damage += 32 * w.count("discharge"); }
    const targets = w.enemies.filter(e => !e.dead && distance(e, p) < w.attackRange(radius) + e.w / 2 && (e.x - p.x) * Math.cos(p.aim) + (e.y - p.y) * Math.sin(p.aim) > -22);
    const multi = 1 + Math.max(0, targets.length - 1) * 0.15 * w.count("multi");
    for (const e of targets) {
      w.hit(e, damage * multi, true, Math.sign(e.x - p.x || p.facing) * (heavy ? 380 : 95), heavy);
      if (heavy) w.stunEnemy(e, e.kind === "elite" ? 0.25 : 0.75);
    }
    if (powered && targets.length) { w.metrics.chargedHits++; w.blast(targets[0].x, targets[0].y, 35 * w.count("discharge"), w.attackRange(140), 260, targets[0]); }
    w.metrics.shots++; w.emit("melee", p.x, p.y, heavy ? 0xedb76c : 0xe8edd0, p.aim);
  }
  deploy() {
    const w = this.w;
    if (w.grenadeCooldown > 0) return;
    if (this.secondary === "drone") {
      if (this.droneStock <= 0 || this.units.filter(u => u.type === "drone" && u.hp > 0).length >= 3) { w.say("无人机最多三架；储备耗尽可在训练台补给"); return; }
      this.droneStock--; this.units.push({ id: this.nextUnit++, type: "drone", x: w.player.x, y: w.player.y - 90, hp: 75, cooldown: 0, invulnerable: 0 });
      w.grenadeCooldown = 0.65;
    } else if (this.secondary === "turret") {
      this.units = this.units.filter(u => u.type !== "turret");
      this.units.push({ id: this.nextUnit++, type: "turret", x: w.player.x, y: w.player.y + 7, hp: 200, cooldown: 0, invulnerable: 0 });
      w.grenadeCooldown = 2;
    }
  }
  update(dt: number, c: Controls) {
    const w = this.w, p = w.player, speed = w.speedFactor(), pressed = c.fire && !this.previousFire;
    this.swing.life = Math.max(0, this.swing.life - dt);
    const blocking = this.secondary === "shield" && c.phase && w.stamina > 0;
    this.blockAge = blocking && this.blocking ? this.blockAge + dt : 0;
    this.blocking = blocking;
    if (blocking) w.stamina = Math.max(0, w.stamina - 10 * dt);
    if (c.melee && !p.grounded && !w.slamming && w.stamina >= 15) { w.slamming = true; w.slamY = p.y; w.stamina -= 15; }
    if (this.primary === "sniper") {
      if (c.fire) this.charge = Math.min(1.3, this.charge + dt);
      if (!c.fire && this.previousFire && p.fireCooldown <= 0) {
        const heavy = this.charge >= 0.25;
        this.shoot(heavy ? 35 + 85 * this.charge / 1.3 : 22, heavy, heavy);
        p.fireCooldown = 0.38 / speed; w.heat = Math.min(100, w.heat + (heavy ? 25 : 6)); this.charge = 0;
      }
    } else if (this.primary === "dagger") {
      if (pressed && p.fireCooldown <= 0 && w.stamina >= 4) {
        const expected = rhythm[this.rhythmIndex] / Math.min(2, speed), gap = w.time - this.lastBeat;
        if (this.lastBeat > 0 && Math.abs(gap - expected) < 0.12) { this.rhythmStacks = Math.min(15, this.rhythmStacks + 1); this.rhythmFeedback = "节拍命中"; }
        else if (this.lastBeat > 0) { this.rhythmStacks = Math.max(0, this.rhythmStacks - 3); this.rhythmFeedback = "失拍 · 降三层"; }
        this.rhythmIndex = (this.rhythmIndex + 1) % rhythm.length; this.lastBeat = w.time;
        this.melee(21 * (1 + this.rhythmStacks * 0.2), false, 83);
        w.stamina -= 4; p.fireCooldown = 0.12 / speed; w.heat = Math.min(100, w.heat + 3);
      }
    } else if (c.fire && p.fireCooldown <= 0 && !blocking) {
      if (this.primary === "hammer") {
        if (w.stamina >= 10) {
          if (w.time > this.comboUntil) this.combo = 0;
          this.combo = (this.combo + 1) % 3; this.comboUntil = w.time + 1.4;
          const heavy = this.combo === 0;
          this.melee(heavy ? 68 : 32, heavy, heavy ? 155 : 107);
          w.stamina -= 10; p.fireCooldown = (heavy ? 0.64 : 0.42) / speed; w.heat = Math.min(100, w.heat + 6);
        }
      } else if (this.primary === "rifle") {
        if (!w.overheated) {
          this.shoot(w.heat >= 60 ? 18 : 11, w.heat >= 60);
          w.heat = Math.min(100, w.heat + 10); p.fireCooldown = 0.105 / speed;
          if (w.heat >= 100) { w.overheated = true; w.say("步枪过热 · 停火散热至 35 以下"); }
        }
      } else {
        w.ammo = (w.ammo + 1) % 5; this.shoot(w.ammo === 0 ? 28 : 14, w.ammo === 0);
        p.fireCooldown = 0.235 / speed; w.heat = Math.min(100, w.heat + 4);
      }
    }
    if (this.secondary === "grenade") {
      if (c.grab) this.grenadeCharge = Math.min(1.2, this.grenadeCharge + dt);
      if (!c.grab && this.previousQ) { w.throwGrenade(c.mx, c.my, 0.5 + this.grenadeCharge / 1.2); this.grenadeCharge = 0; }
    } else if (c.grab && !this.previousQ) this.deploy();
    this.previousQ = c.grab; this.previousFire = c.fire;
    for (const [i, u] of this.units.entries()) {
      if (u.hp <= 0) continue;
      u.cooldown -= dt; u.invulnerable = Math.max(0, u.invulnerable - dt);
      if (u.type === "drone") { u.x += (p.x + Math.cos(w.time * 1.8 + i * 2) * 80 - u.x) * Math.min(1, dt * 5); u.y += (p.y - 85 + Math.sin(w.time * 2 + i) * 18 - u.y) * Math.min(1, dt * 5); }
      const target = w.enemies.filter(e => !e.dead && distance(e, u) < 740 && w.canSee(u, e)).sort((a, b) => distance(a, u) - distance(b, u))[0];
      if (target && u.cooldown <= 0) {
        this.shoot(u.type === "turret" ? 20 : 12, false, false, u.x, u.y, Math.atan2(target.y - u.y, target.x - u.x));
        u.cooldown = (u.type === "turret" ? 0.26 : 0.45) / speed;
      }
    }
    this.units = this.units.filter(u => u.hp > 0);
  }
  get rhythmRemaining() { return Math.max(0, rhythm[this.rhythmIndex] / Math.min(2, this.w.speedFactor()) - (this.w.time - this.lastBeat)); }
}
