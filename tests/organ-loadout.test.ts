import { describe, expect, it } from "vitest";
import { Carrier, SliceWorld } from "../src/game/SliceWorld";
import { OrganLoadout } from "../src/game/OrganLoadout";

const arena = (organs: ConstructorParameters<typeof Carrier>[3], weapon: Carrier["weapon"] = "hammer") => {
  const w = new SliceWorld();
  w.player.x = 60; // pinned against the left boundary: a "wall" for battery
  w.player.y = 584;
  w.player.invulnerable = 0;
  const e = new Carrier("reclaimer", 320, 584, organs, 1);
  e.weapon = weapon;
  w.enemies = [e];
  return { w, e };
};

describe("OrganLoadout / 多器官敌人", () => {
  it("可叠层、可移除、统计种类与层数", () => {
    const l = new OrganLoadout(["ram", "battery"]);
    l.add("ram", 2);
    expect(l.count("ram")).toBe(3);
    expect(l.has("battery")).toBe(true);
    expect(l.uniqueCount).toBe(2);
    expect(l.totalLayers).toBe(4);
    expect(l.primary).toBe("ram");
    l.remove("ram");
    expect(l.has("ram")).toBe(false);
    expect(l.entries()).toEqual([["battery", 1]]);
  });

  it("敌人同时拥有多种器官，两种不同效果同时生效", () => {
    const { w, e } = arena({ speed: 2, glass: 1, shieldBurst: 1 });
    expect(e.organs.uniqueCount).toBe(3);
    expect(w.hostile.speed(e)).toBeCloseTo(1 + 0.5 + 0.4);
    expect(w.hostile.kit(e).shield).toBe(35);
    expect(w.hostile.power(e)).toBeCloseTo(1.5); // burning shield bonus active at the same time
    expect(e.maxHp).toBeLessThan(135 + 12); // glass really cut max HP
  });

  it("三段链式：冲锋 → 撞墙充能 → 重击消费充能并触发震荡范围", () => {
    const { w, e } = arena({ ram: 1, battery: 1, discharge: 1, heavyArea: 1 });
    const k = w.hostile.kit(e);
    k.energy = 0;
    // 1. From range, ram opens with a charge instead of a swing.
    e.chargeDirection = -1;
    w.hostile.release(e);
    expect(e.charge).toBeGreaterThan(0);
    // 2. Charge contact shoves the player into the wall → battery gives charge.
    w.hostile.damage(e, 14);
    expect(w.player.externalX).toBeLessThan(0);
    expect(k.energy).toBe(1);
    expect(w.hostile.chains.wallCharges).toBe(1);
    // 3. Up close the same body swings; the third hammer hit is heavy, spends charge, and
    //    heavyArea adds a second wide blast.
    e.charge = 0;
    e.x = 130;
    k.combo = 2;
    w.player.invulnerable = 0;
    const before = w.player.hp;
    w.hostile.release(e);
    expect(k.energy).toBe(0);
    expect(w.hostile.chains.dischargeHeavies).toBe(1);
    expect(w.hostile.chains.heavyAreas).toBe(1);
    expect(w.hostile.warnings.some((a) => a.radius >= 200)).toBe(true);
    expect(w.player.hp).toBeLessThan(before);
  });

  it("没有压电骨时同样的冲锋不会产生充能（效果来自组合而非图标数量）", () => {
    const { w, e } = arena({ ram: 3, knock: 1 });
    e.charge = 0.3;
    w.hostile.damage(e, 14);
    expect(w.hostile.kit(e).energy).toBe(0);
    expect(w.hostile.chains.wallCharges).toBe(0);
  });

  it("实时模拟中组合敌人会自己打出撞墙充能", () => {
    const { w } = arena({ ram: 1, battery: 1, discharge: 1, heavyArea: 1 });
    w.step(12);
    expect(w.hostile.chains.wallCharges).toBeGreaterThan(0);
  });

  it("死亡掉落与实际携带器官一致（含层数）", () => {
    const { w, e } = arena({ ram: 1, battery: 2, mark: 1 });
    w.drops = [];
    w.hit(e, 99999);
    expect(e.dead).toBe(true);
    const dropped = Object.fromEntries(w.drops.map((d) => [d.organ, d.stacks ?? 1]));
    expect(dropped).toEqual({ ram: 1, battery: 2, mark: 1 });
  });

  it("兼容旧接口：写 organ 会重置为单器官", () => {
    const e = new Carrier("crawler", 0, 584, { ram: 2, mark: 1 }, 1);
    e.organ = "freeze";
    expect(e.organs.entries()).toEqual([["freeze", 1]]);
  });
});
