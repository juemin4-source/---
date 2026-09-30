import { drawRigBoss } from "./RigBossArt";
import { Carrier, type SliceWorld } from "./SliceWorld";
import type { Renderer } from "../engine/Renderer";
import { lootDefs, nextUid } from "./expedition/LootSystem";

type Phase = "dormant" | "anchored" | "exposed" | "moving" | "dead";
/** Authored encounter. Parts are real damage targets; anchors are machinery, not farmable kills. */
export class RigBoss {
  phase: Phase = "dormant";
  core: Carrier | null = null;
  anchors: Carrier[] = [];
  x = 6030;
  timer = 0;
  attackClock = 2;
  stable = 0;
  interrupted = false;
  sweep: { x: number; y: number; left: number; width: number; remaining: number; fired: boolean } | null =
    null;
  moveFrom = 0;
  moveTo = 0;
  constructor(private w: SliceWorld) {}
  start() {
    if (this.phase !== "dormant") return;
    const core = new Carrier("elite", this.x, 1394, "heavyArea", 1);
    core.rigPart = "core";
    core.w = 100;
    core.h = 80;
    core.hp = core.maxHp = 4200;
    this.core = core;
    this.w.enemies.push(core);
    this.anchors = [-1, 1].map((side) => {
      const a = new Carrier("reclaimer", this.x + side * 135, 1394, "armor", 1);
      a.rigPart = "anchor";
      a.w = 42;
      a.h = 64;
      a.hp = a.maxHp = 360;
      this.w.enemies.push(a);
      return a;
    });
    this.phase = "anchored";
    this.place();
    this.w.say("井架回收者启动 · 拆掉任一锚脚，核心倾倒暴露 · 可以撤退");
    this.w.record("rig_boss", "start");
  }
  private place() {
    if (!this.core) return;
    this.core.x = this.x;
    this.core.y = this.phase === "exposed" ? 1340 : 1240;
    this.anchors.forEach((a, i) => {
      a.x = this.x + (i ? 135 : -135);
      a.y = 1357;
      a.impulseX = a.vx = a.vy = 0;
    });
    this.core.impulseX = this.core.vx = this.core.vy = 0;
  }
  scaleDamage(e: Carrier, amount: number) {
    return e === this.core && this.phase !== "exposed" ? amount * 0.3 : amount;
  }
  breakAnchor(e: Carrier, amount: number) {
    if (e.rigPart !== "anchor" || amount < e.hp) return false;
    e.hp = 0;
    e.dead = true;
    this.w.emit("break", e.x, e.y, 0xffcc88);
    if (this.phase === "anchored") {
      this.phase = "exposed";
      this.timer = 6;
      this.sweep = null;
      this.w.record("rig_boss", "anchor_break:core_exposed");
      this.w.say("锚脚破坏 · 核心暴露 6 秒");
    }
    return true;
  }
  update(dt: number) {
    const w = this.w,
      p = w.player;
    if (this.phase === "dormant") {
      if (w.expedition && p.x > 5680 && p.x < 6500 && p.y > 1120 && p.y < 1410) this.start();
      return;
    }
    if (this.phase === "dead" || !this.core) return;
    if (this.core.dead) {
      this.phase = "dead";
      this.sweep = null;
      for (const a of this.anchors) a.dead = true;
      w.record("rig_boss", "defeated");
      w.expedition?.piles.push({
        uid: nextUid(),
        x: this.x,
        y: 1370,
        district: "spine",
        source: "井架回收者核心",
        taken: false,
        difficulty: 0,
        items: [{ uid: nextUid(), def: lootDefs.reactorCore, source: "井架回收者", district: "spine" }],
      });
      w.say("井架回收者击破 · 吊装间已安全");
      return;
    }
    for (const part of [this.core, ...this.anchors]) {
      part.flash = Math.max(0, part.flash - dt);
      part.mark = Math.max(0, part.mark - dt);
      part.frozen = Math.max(0, part.frozen - dt);
      part.stun = Math.max(0, part.stun - dt);
      part.staggered = Math.max(0, part.staggered - dt);
      part.staggerLock = Math.max(0, part.staggerLock - dt);
      part.vulnerable = Math.max(0, part.vulnerable - dt);
    }
    // No offscreen attacks. Leaving costs no reset of boss health.
    const present = p.x > 5500 && p.x < 6550 && p.y > 1100 && p.y < 1430;
    if (!present) {
      this.sweep = null;
      this.place();
      return;
    }
    this.stable = Math.max(0, this.stable - dt);
    if (this.phase === "exposed") {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.phase = "moving";
        this.timer = 2.5;
        this.moveFrom = this.x;
        this.moveTo = this.x > 6000 ? 5820 : 6270;
        w.record("rig_boss", "rail_move");
      }
    } else if (this.phase === "moving") {
      this.timer -= dt;
      this.x = this.moveFrom + (this.moveTo - this.moveFrom) * Math.min(1, 1 - this.timer / 2.5);
      if (this.timer <= 0) {
        for (const a of this.anchors) {
          a.dead = false;
          a.hp = a.maxHp;
          a.mark = a.frozen = a.stun = a.staggered = a.vulnerable = 0;
          a.poise = a.maxPoise;
        }
        this.phase = "anchored";
        this.attackClock = 1.4;
        this.stable = 2;
      }
    } else {
      const controlled = this.anchors.some((a) => !a.dead && (a.frozen > 0 || a.staggered > 0));
      if (controlled && this.stable <= 0 && !this.interrupted) {
        this.sweep = null;
        this.attackClock = 1.5;
        this.stable = 4;
        this.interrupted = true;
        w.record("rig_boss", "arm_interrupted");
      }
      if (!controlled) this.interrupted = false;
      this.attackClock -= dt * (controlled && this.stable <= 0 ? 0.55 : 1);
      if (this.attackClock <= 0 && !this.sweep) {
        const width = this.core.hp < this.core.maxHp * 0.5 ? 340 : 260;
        const left = Math.max(5510, Math.min(6540 - width, p.x - width / 2));
        this.sweep = { x: p.x, y: p.y, left, width, remaining: 1.35, fired: false };
        this.attackClock = this.core.hp < this.core.maxHp * 0.5 ? 2.5 : 3.3;
      }
    }
    if (this.sweep) {
      const s = this.sweep;
      s.remaining -= dt;
      if (s.remaining <= 0 && !s.fired) {
        s.fired = true;
        s.remaining = 0.3;
        if (p.x > s.left && p.x < s.left + s.width && Math.abs(p.y - s.y) < 65) w.hurtPlayer(38, this.x);
        for (const unit of w.armory.units)
          if (unit.x > s.left && unit.x < s.left + s.width && Math.abs(unit.y - s.y) < 65) unit.hp -= 25;
        w.emit("slam", s.left + s.width / 2, s.y, 0xffaa66);
      } else if (s.fired && s.remaining <= 0) this.sweep = null;
    }
    this.place();
  }
  render(art: Renderer) {
    drawRigBoss(art, this);
  }
}
