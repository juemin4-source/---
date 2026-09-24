import { EnemyModule, moduleInfo, type ModuleKind } from "./EnemyModule";
import { rigBalance } from "./CombatBalance";
import { clamp, distance, rayRect } from "./PhysicsHelpers";
import { Projectile } from "./Projectile";
import type { Controls } from "./Player";
import type { World } from "./World";

export const rigInfo: Record<ModuleKind, { name: string; hint: string }> = {
  thruster: {
    name: "推进囊",
    hint: "空中再按 Space 喷跳；落地充能。与甲壳盾接成冲撞。",
  },
  gun: { name: "炮腕", hint: "按住射击协同开火，松开散热；过热会暂时停火。" },
  shield: { name: "甲壳盾", hint: "面向鼠标挡住敌弹；与推进囊接成冲撞。" },
  grapple: {
    name: "牵引腕",
    hint: "射击时聚拢轻型敌人；配炮腕每 2.4 秒可触发一次聚爆。",
  },
};
interface Implosion {
  x: number;
  y: number;
  remaining: number;
  pulse: number;
}

/** One expedition's physical organs; transfer these same objects when changing area. */
export class OrganRig {
  modules: EnemyModule[] = [];
  selected = 0;
  telemetry = { installed: 0, ramHits: 0, implosions: 0, boosts: 0 };
  implosions: Implosion[] = [];
  boostReady = true;
  gunHeat = 0;
  gunOverheated = false;
  comboCooldown = 0;
  private boostPending = false;
  private ramActive = false;
  private ramTargets = new Set<number>();

  has(kind: ModuleKind) {
    return this.modules.some((m) => m.kind === kind && m.mounted && m.stable && !m.dead);
  }
  get combos() {
    const result: { id: string; name: string; hint: string }[] = [];
    if (this.has("thruster") && this.has("shield"))
      result.push({
        id: "ram",
        name: "推进冲城",
        hint: "Shift：盾面冲撞敌群，震脱敌方甲壳。",
      });
    if (this.has("grapple") && this.has("gun"))
      result.push({
        id: "implosion",
        name: "牵引聚爆",
        hint: "每 2.4 秒聚爆一次；重型星骸更难牵动，掩体挡住爆风。",
      });
    return result;
  }
  select(index: number) {
    this.selected = clamp(Math.floor(index), 0, Math.max(0, this.modules.length - 1));
  }
  nearest(w: World) {
    return (
      w.modules
        .filter((m) => !m.dead && !m.parent && !m.mounted && distance(m, w.player) < 140)
        .sort((a, b) => distance(a, w.player) - distance(b, w.player))[0] ?? null
    );
  }
  installNearest(w: World) {
    this.sync(w);
    const m = this.nearest(w);
    if (!m || w.phaseCapacity < 1) return false;
    const duplicate = this.modules.findIndex((n) => n.kind === m.kind);
    let slot = duplicate;
    if (slot < 0 && this.modules.length >= w.phaseCapacity) slot = this.selected;
    if (slot >= 0) {
      const old = this.modules[slot];
      this.unmount(w, old, true);
      this.modules.splice(slot, 1);
    } else slot = this.modules.length;
    if (w.held === m) w.held = null;
    m.held = false;
    // Stabilization owns shared capacity, including deployed organs in other areas.
    if (!m.stable) w.stabilize(m);
    else if (!w.stableQueue.includes(m)) w.stableQueue.push(m);
    m.mounted = true;
    m.vx = m.vy = 0;
    m.cooldown = Math.min(m.cooldown, 0.15);
    this.modules.splice(Math.min(slot, this.modules.length), 0, m);
    this.selected = this.modules.indexOf(m);
    this.telemetry.installed++;
    this.sync(w);
    this.position(w);
    w.say(moduleInfo[m.kind].name + "已接入 · " + rigInfo[m.kind].hint);
    return true;
  }
  deploySelected(w: World) {
    this.sync(w);
    const m = this.modules[this.selected];
    if (!m) return false;
    this.unmount(w, m, false);
    this.modules.splice(this.selected, 1);
    this.select(this.selected);
    w.say(moduleInfo[m.kind].name + "已部署 · 保持定相，Q 旋转 / V 搬运");
    return true;
  }
  private unmount(w: World, m: EnemyModule, release: boolean) {
    m.mounted = false;
    m.held = false;
    m.x = clamp(w.player.x + w.player.facing * 76, 30, w.width - 30);
    m.w = m.kind === "shield" ? 24 : 34;
    m.h = m.kind === "shield" ? 92 : 30;
    m.y = w.player.y - (m.kind === "shield" ? 25 : 0);
    for (const p of w.platforms)
      if (Math.abs(m.x - p.x) < (m.w + p.w) / 2 && m.y < p.y && m.y + m.h / 2 > p.y - p.h / 2)
        m.y = p.y - (p.h + m.h) / 2;
    m.angle = m.kind === "thruster" ? -Math.PI / 2 : w.player.aim;
    m.vx = w.player.facing * 60;
    m.vy = -50;
    m.cooldown = 0.65;
    if (release) {
      m.stable = false;
      m.dormant = true;
      w.stableQueue = w.stableQueue.filter((n) => n !== m);
    }
    if (!w.modules.includes(m)) w.modules.push(m);
  }
  sync(w: World) {
    for (const m of [...this.modules]) {
      if (m.dead || !m.stable || !m.mounted) {
        if (m.mounted) this.unmount(w, m, false);
        this.modules.splice(this.modules.indexOf(m), 1);
      } else if (!w.modules.includes(m)) w.modules.push(m);
    }
    w.stableQueue = w.stableQueue.filter((m) => m.stable && !m.dead);
    while (w.stableQueue.length > w.phaseCapacity) {
      const m = w.stableQueue.shift()!;
      m.stable = false;
      if (m.mounted) {
        this.unmount(w, m, false);
        this.modules.splice(this.modules.indexOf(m), 1);
      }
    }
    this.select(this.selected);
  }
  reset() {
    for (const m of this.modules) {
      m.mounted = false;
      m.stable = false;
      m.dead = true;
    }
    this.modules = [];
    this.implosions = [];
    this.selected = 0;
    this.boostReady = true;
    this.gunHeat = 0;
    this.gunOverheated = false;
    this.comboCooldown = 0;
    this.boostPending = this.ramActive = false;
    this.ramTargets.clear();
    this.telemetry = { installed: 0, ramHits: 0, implosions: 0, boosts: 0 };
  }
  beforePlayerUpdate(w: World, dt: number, c: Controls) {
    this.sync(w);
    const p = w.player;
    if (p.grounded) this.boostReady = true;
    this.boostPending = this.has("thruster") && this.boostReady && c.jump && !p.grounded && p.coyote <= 0;
    if (c.dash && p.dashCooldown <= dt) {
      this.ramActive = this.has("thruster") && this.has("shield");
      this.ramTargets.clear();
    }
  }
  private position(w: World) {
    const p = w.player,
      a = p.aim;
    for (const m of this.modules) {
      const offset = m.kind === "shield" ? 47 : m.kind === "gun" ? 27 : -24;
      m.x = p.x + Math.cos(a) * offset;
      m.y =
        p.y +
        Math.sin(a) * offset +
        (m.kind === "gun" ? -22 : m.kind === "thruster" ? 16 : m.kind === "grapple" ? -22 : 0);
      m.angle = m.kind === "thruster" ? -Math.PI / 2 : a;
      m.vx = m.vy = 0;
      if (m.kind === "shield") {
        m.w = Math.abs(Math.cos(a)) * 18 + Math.abs(Math.sin(a)) * 76;
        m.h = Math.abs(Math.cos(a)) * 76 + Math.abs(Math.sin(a)) * 18;
      }
    }
  }
  update(w: World, dt: number, c: Controls) {
    this.position(w);
    this.comboCooldown = Math.max(0, this.comboCooldown - dt);
    if (this.gunOverheated || !c.fire)
      this.gunHeat = Math.max(
        0,
        this.gunHeat - dt * (this.gunOverheated ? rigBalance.overheatCooling : rigBalance.cooling),
      );
    if (this.gunOverheated && this.gunHeat <= rigBalance.resumeHeat) this.gunOverheated = false;
    const p = w.player;
    if (this.boostPending) {
      this.boostPending = false;
      this.boostReady = false;
      p.vy = -980;
      p.jumpBuffer = 0;
      this.telemetry.boosts++;
      w.stats.boosted = true;
      this.modules.find((m) => m.kind === "thruster")!.active = 0.35;
      w.emit("dash", p.x, p.y + 20, 0xffb85b, -Math.PI / 2);
      w.say("推进喷跳 · 落地后充能");
    }
    if (this.ramActive && p.dashTime > 0) {
      const dir = Math.sign(p.vx) || p.facing;
      for (const e of w.enemies) {
        if (
          e.dead ||
          this.ramTargets.has(e.id) ||
          (e.x - p.x) * dir < -30 ||
          Math.abs(e.x - p.x) > 120 ||
          Math.abs(e.y - p.y) > 82
        )
          continue;
        this.ramTargets.add(e.id);
        for (const m of e.modules)
          if (m.parent === e && !m.dead && m.kind === "shield") {
            m.detach();
            m.vx = dir * 500;
            w.stats.detached++;
            w.onModuleDetached?.(m);
            w.emit("detach", m.x, m.y, 0x8dc7ed);
          }
        e.charge = 0;
        e.ramCooldown = 0.6;
        w.damageEnemy(e, 65, dir * 850);
        this.telemetry.ramHits++;
        w.stats.rams++;
        w.emit("ram", e.x, e.y, 0x8dc7ed, dir > 0 ? 0 : Math.PI);
        w.say("推进冲城 · 震脱甲壳，撞散星骸");
      }
    } else this.ramActive = false;
    const gun = this.modules.find((m) => m.kind === "gun");
    if (gun && gun.cooldown <= 0) {
      const target = w.enemies
        .filter(
          (e) =>
            !e.dead &&
            distance(p, e) < 850 &&
            ((e.x - p.x) * Math.cos(p.aim) + (e.y - p.y) * Math.sin(p.aim)) / Math.max(1, distance(p, e)) >
              0.85,
        )
        .sort((a, b) => distance(a, { x: c.mx, y: c.my }) - distance(b, { x: c.mx, y: c.my }))[0];
      if (c.fire && !this.gunOverheated) {
        const a = !c.fire && target ? Math.atan2(target.y - gun.y, target.x - gun.x) : p.aim;
        const shot = new Projectile(
          gun.x + Math.cos(a) * 24,
          gun.y + Math.sin(a) * 24,
          Math.cos(a) * 740,
          Math.sin(a) * 740,
          "player",
          rigBalance.gunDamage,
          -gun.id,
        );
        shot.implosion = this.has("grapple") && this.comboCooldown <= 0;
        if (shot.implosion) this.comboCooldown = rigBalance.comboInterval;
        w.projectiles.push(shot);
        gun.cooldown = rigBalance.gunInterval;
        this.gunHeat = Math.min(100, this.gunHeat + rigBalance.heatPerShot);
        if (this.gunHeat >= 100) {
          this.gunOverheated = true;
          w.say("炮腕过热 · 基础枪仍可开火，松开射击可散热");
        }
        gun.active = 0.15;
        gun.targetX = gun.x + Math.cos(a) * 70;
        gun.targetY = gun.y + Math.sin(a) * 70;
        w.emit("shot", shot.x, shot.y, shot.implosion ? 0xb799ff : 0xff7284, a);
      }
    }
    const grapple = this.modules.find((m) => m.kind === "grapple");
    if (grapple && c.fire) {
      const d = clamp(Math.hypot(c.mx - p.x, c.my - p.y), 185, 540);
      const center = {
        x: clamp(p.x + Math.cos(p.aim) * d, 30, w.width - 30),
        y: clamp(p.y + Math.sin(p.aim) * d, 85, w.height - 134),
      };
      this.pull(w, center.x, center.y, rigBalance.pullRadius, dt, rigBalance.pullForce);
      grapple.targetX = center.x;
      grapple.targetY = center.y;
      grapple.active = 0.08;
    }
    for (const field of this.implosions) {
      field.remaining -= dt;
      field.pulse -= dt;
      this.pull(w, field.x, field.y, rigBalance.blastRadius, dt, rigBalance.blastPull);
      if (field.pulse <= 0) {
        field.pulse = 0.09;
        w.emit("phase", field.x, field.y, 0xb799ff);
      }
      if (field.remaining <= 0) {
        for (const e of w.enemies)
          if (
            !e.dead &&
            distance(e, field) < rigBalance.blastRadius &&
            !w.platforms.some((r) => {
              const hit = rayRect(field.x, field.y, e.x - field.x, e.y - field.y, r);
              return hit !== null && hit > 0.01 && hit < 0.99;
            })
          ) {
            w.damageEnemy(
              e,
              rigBalance.blastDamage * (e.has("shield") ? 0.55 : 1),
              Math.sign(e.x - field.x) * 100,
              "combo",
            );
            for (const m of e.modules)
              if (m.parent === e && !m.dead && m.kind === "shield") {
                m.connection -= 24;
                if (m.connection <= 0) {
                  m.detach();
                  w.stats.detached++;
                  w.onModuleDetached?.(m);
                  w.emit("detach", m.x, m.y, 0xb799ff);
                }
              }
          }
        w.emit("ram", field.x, field.y, 0xb799ff);
        w.emit("kill", field.x, field.y, 0xb799ff);
        this.telemetry.implosions++;
        w.say("牵引聚爆 · 聚点爆裂，链路重新蓄能");
      }
    }
    this.implosions = this.implosions.filter((f) => f.remaining > 0);
  }
  private pull(w: World, x: number, y: number, radius: number, dt: number, force: number) {
    // Close enemies are pushed out, never reeled into the carrier's contact damage.
    for (const e of w.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (e.dead || d > radius || d < 18) continue;
      const safe = distance(e, w.player) < 100;
      const dx = safe ? Math.sign(e.x - w.player.x) || w.player.facing : (x - e.x) / d;
      e.impulseX = clamp(e.impulseX + (dx * force * dt) / Math.sqrt(e.mass), -550, 550);
      if (!safe) e.vy = clamp(e.vy + (((y - e.y) / d) * force * dt) / Math.sqrt(e.mass), -420, 500);
    }
  }
  onProjectileHit(w: World, p: Projectile) {
    if (!p.implosion) return;
    this.implosions.push({ x: p.x, y: p.y, remaining: 0.38, pulse: 0 });
    w.emit("phase", p.x, p.y, 0xb799ff);
  }
}
