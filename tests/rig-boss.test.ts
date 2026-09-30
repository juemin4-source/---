import { describe, it, expect } from "vitest";
import { SliceWorld } from "../src/game/SliceWorld";
import { idleControls } from "../src/engine/Player";
import type { OrganId } from "../src/game/config";
const setup = () => {
  const w = new SliceWorld(false, 54, true, false, true);
  w.trainingAuto = false;
  w.enemies = [];
  w.platforms = [];
  w.width = 7000;
  w.height = 3000;
  w.player.x = 6030;
  w.player.y = 1350;
  w.rigBoss.start();
  return w;
};
describe("井架回收者", () => {
  it("种子 54 的 118 层构筑仍能拆脚并对暴露核心输出，没有伤害封顶", () => {
    const w = setup(),
      b = w.rigBoss;
    const stacks = {
      ram: 10,
      vitality: 5,
      armor: 10,
      returnMembrane: 1,
      mirrorEye: 1,
      split: 1,
      leech: 3,
      stitch: 1,
      polarity: 1,
      vulnerable: 10,
      debt: 1,
      discharge: 1,
      corpse: 1,
      glass: 4,
      refract: 1,
      shell: 1,
      multi: 2,
      conduit: 3,
      stunKnock: 3,
      vacuum: 1,
      perfect: 5,
      parasite: 1,
      mark: 6,
      vent: 1,
      rage: 5,
      knock: 7,
      airPower: 2,
      speed: 6,
      freeze: 2,
      battery: 8,
      fullRange: 1,
      heavyArea: 2,
      shieldBurst: 3,
      coolShield: 2,
      spread: 2,
      overflow: 1,
      shatter: 1,
      hot: 2,
    };
    for (const [id, n] of Object.entries(stacks)) w.grant(id as OrganId, n);
    w.armory.switchPrimary("nail");
    w.player.x = 5710;
    w.player.y = 1357;
    w.player.aim = 0;
    for (let i = 0; i < 600 && b.phase === "anchored"; i++) {
      w.player.fireCooldown = Math.max(0, w.player.fireCooldown - 1 / 120);
      w.armory.update(1 / 120, { ...idleControls(), fire: true });
      w.updateProjectiles(1 / 120);
      w.rules.update(1 / 120);
      b.update(1 / 120);
    }
    expect(b.phase).toBe("exposed");
    const hp = b.core!.hp;
    w.hit(b.core!, 100, true, 0, true);
    expect(b.core!.hp).toBeLessThan(hp);
  });
  it("锚脚破坏取消攻击并暴露核心；部件不提供可反复刷取的击杀收益", () => {
    const w = setup(),
      b = w.rigBoss;
    b.update(2.1);
    expect(b.sweep).not.toBeNull();
    const kills = w.stats.kills;
    w.hit(b.anchors[0], 9999);
    expect(b.phase).toBe("exposed");
    expect(b.sweep).toBeNull();
    expect(w.stats.kills).toBe(kills);
    expect(w.drops).toHaveLength(0);
    expect(b.scaleDamage(b.core!, 100)).toBe(100);
    b.update(6.1);
    expect(b.phase).toBe("moving");
    b.update(2.6);
    expect(b.phase).toBe("anchored");
    expect(b.anchors.every((a) => !a.dead)).toBe(true);
    expect(b.x).toBe(5820);
  });
  it("清扫锁定旧位置并保留预警，移动可躲；离场不追击", () => {
    const w = setup(),
      b = w.rigBoss;
    for (let i = 0; i < 130; i++) b.update(1 / 60);
    expect(b.sweep).not.toBeNull();
    const hp = w.player.hp;
    w.player.x = 6400;
    for (let i = 0; i < 100; i++) b.update(1 / 60);
    expect(w.player.hp).toBe(hp);
    w.player.x = 5400;
    b.update(1);
    expect(b.sweep).toBeNull();
  });
  it("控制能打断吊臂，但不能永久锁住攻击；核心不锁血", () => {
    const w = setup(),
      b = w.rigBoss;
    b.anchors[0].frozen = 20;
    b.update(0.01);
    expect(b.stable).toBeGreaterThan(0);
    for (let i = 0; i < 180; i++) b.update(1 / 60);
    expect(b.sweep).not.toBeNull();
    w.hit(b.anchors[0], 9999);
    w.hit(b.core!, 99999);
    b.update(0.01);
    expect(b.phase).toBe("dead");
  });
  it("锚定部件不被击退挤出世界", () => {
    const w = setup(),
      a = w.rigBoss.anchors[0];
    w.push(a, 99999);
    for (let i = 0; i < 60; i++) {
      w.updateEnemy(a, 1 / 60);
      w.rigBoss.update(1 / 60);
    }
    expect(a.x).toBe(5895);
    expect(a.y).toBe(1357);
  });
});
