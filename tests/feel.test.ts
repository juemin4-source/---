import { describe, it, expect } from "vitest";
import { Carrier, SliceWorld } from "../src/game/SliceWorld";
import { Juice, feel } from "../src/game/Juice";

const world = () => {
  const w = new SliceWorld(false, 1, true, false, true);
  w.enemies = [];
  return w;
};
const spawn = (w: SliceWorld, hp = 1, x = 500) => {
  const e = new Carrier("crawler", x, 584, "ram", 1);
  e.hp = e.maxHp = hp;
  w.enemies.push(e);
  return e;
};
describe("打击感导演", () => {
  it("命中产生顿帧、震动与粒子，且顿帧不叠加", () => {
    const w = world(),
      e = spawn(w, 500);
    w.hit(e, 10, true, 0, false);
    const j = w.juice;
    expect(j.hitstop).toBeGreaterThan(0);
    expect(j.trauma).toBeGreaterThan(0);
    expect(j.particles.length).toBeGreaterThan(0);
    const first = j.hitstop;
    w.hit(e, 10, true, 0, false);
    expect(j.hitstop).toBeLessThanOrEqual(Math.max(first, 0.075));
  });
  it("连杀累计并在窗口结束后清空，狂热提升攻速与伤害", () => {
    const w = world(),
      j = w.juice;
    const base = w.power();
    for (let i = 0; i < 3; i++) w.hit(spawn(w, 1, 400 + i * 40), 999);
    expect(j.streak).toBe(3);
    expect(j.tier).toBe(1);
    w.step(0.2);
    for (let i = 0; i < 5; i++) w.hit(spawn(w, 1, 400 + i * 40), 999);
    expect(j.streak).toBe(8);
    expect(j.tier).toBe(2);
    expect(w.power()).toBeGreaterThan(base);
    expect(w.speedFactor()).toBeGreaterThan(1);
    w.step(feel.streakWindow + 0.5);
    expect(j.streak).toBe(0);
    expect(j.tier).toBe(0);
  });
  it("多杀在窗口内合并成横幅", () => {
    const w = world();
    for (let i = 0; i < 3; i++) w.hit(spawn(w, 1, 400 + i * 30), 999);
    expect(w.juice.banners.some((b) => b.text === "三杀")).toBe(true);
  });
  it("击杀母体触发慢动作与更强顿帧", () => {
    const w = world(),
      e = new Carrier("elite", 500, 584, "ram", 1);
    e.hp = e.maxHp = 1;
    w.enemies.push(e);
    w.hit(e, 999);
    expect(w.juice.slowmo).toBeGreaterThan(0);
    expect(w.juice.hitstop).toBeGreaterThan(0.1);
  });
  it("受伤打断连杀计时并触发受击反馈", () => {
    const w = world();
    w.hit(spawn(w, 1, 400), 999);
    const before = w.juice.streakTimer;
    w.player.invulnerable = 0;
    w.hurtPlayer(5, 600);
    expect(w.juice.streakTimer).toBeLessThan(before);
    expect(w.juice.hurtVignette).toBeGreaterThan(0);
  });
  it("完美闪避给慢动作，装瞬息核时额外给充能", () => {
    const w = world();
    w.player.invulnerable = 0.1;
    w.player.dashTime = 0.1;
    w.dashSerial = 3;
    w.hurtPlayer(10, 600);
    expect(w.juice.slowmo).toBeGreaterThan(0);
    expect(w.energy).toBe(0);
    w.grant("perfect");
    w.player.invulnerable = 0.1;
    w.dashSerial = 4;
    w.hurtPlayer(10, 600);
    expect(w.energy).toBe(1);
  });
  it("真实时间与模拟时间分离：顿帧返回 0 时间缩放，世界仍可推进", () => {
    const j = new Juice();
    j.beat("heavy", 0, 0, 0, 0);
    expect(j.updateReal(0.016)).toBe(0);
    const w = world();
    w.hit(spawn(w, 500), 10, true);
    const t = w.time;
    w.step(0.5);
    expect(w.time).toBeGreaterThan(t);
  });
  it("粒子与横幅会随时间清理，不会无限增长", () => {
    const j = new Juice();
    for (let i = 0; i < 40; i++) j.beat("kill", i, 0);
    const n = j.particles.length;
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) j.updateReal(0.016);
    expect(j.particles.length).toBeLessThan(n);
    expect(j.banners.length).toBe(0);
  });
  it("持续命中会破韧，打断敌人起手并进入硬直与易伤", () => {
    const w = world(),
      e = spawn(w, 2000);
    e.cooldown = 0;
    e.windup = 0.5;
    let breaks = 0;
    for (let i = 0; i < 40 && breaks === 0; i++) {
      w.hit(e, 1, true);
      if (e.staggered > 0) breaks = e.staggered;
    }
    expect(breaks).toBeGreaterThan(0);
    expect(e.windup).toBe(0);
    expect(e.vulnerability).toBeGreaterThan(0);
    expect(w.metrics.staggers).toBe(1);
  });
  it("破韧有冷却，不能连续锁死敌人", () => {
    const w = world(),
      e = spawn(w, 5000);
    for (let i = 0; i < 60; i++) w.hit(e, 1, true);
    expect(w.metrics.staggers).toBeLessThanOrEqual(2);
  });
  it("处决线内伤害提高，线外不变", () => {
    const j = new Juice();
    expect(j.executeScale(100, 100)).toBe(1);
    expect(j.executeScale(10, 100)).toBeGreaterThan(1);
    expect(world().juice.executeScale(28, 100)).toBeGreaterThan(1);
  });
  it("击杀返还冲刺与体力，狂热越高收益越大", () => {
    const w = world(),
      j = w.juice;
    for (let i = 0; i < 7; i++) w.hit(spawn(w, 1, 400 + i * 30), 999);
    expect(j.tier).toBeGreaterThanOrEqual(2);
    w.player.dashCooldown = 0.6;
    w.stamina = 20;
    w.hit(spawn(w, 1, 900), 999);
    expect(w.player.dashCooldown).toBeLessThanOrEqual(0.12);
    expect(w.stamina).toBeGreaterThan(20);
  });
  it("击杀尸体会被抛出并随时间清理", () => {
    const w = world();
    w.hit(spawn(w, 1, 600), 999, false, 400);
    expect(w.juice.corpses.length).toBe(1);
    const c = w.juice.corpses[0];
    expect(Math.abs(c.vx)).toBeGreaterThan(0);
    for (let i = 0; i < 100; i++) w.juice.updateReal(0.016);
    expect(w.juice.corpses.length).toBe(0);
  });
});
