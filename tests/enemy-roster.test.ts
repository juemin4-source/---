import { describe, it, expect } from "vitest";
import { Ecology } from "../src/game/expedition/Ecology";
import { equipReinforcement, reinforcementTier } from "../src/game/expedition/EnemyRoster";
import { SliceWorld, Carrier } from "../src/game/SliceWorld";

describe("分阶段增援阵容", () => {
  it("出生时决定强度，旧个体不会因时钟改变；强度有上限", () => {
    const eco = new Ecology(1);
    const old = eco.creatures[0],
      hp = old.maxHp;
    eco.time = 480;
    eco.refreshStats(old);
    expect(old.maxHp).toBe(hp);
    const late = eco.spawn(eco.nests[0])!;
    expect(late.combatTier).toBe(4);
    expect(late.organs.uniqueCount).toBeGreaterThanOrEqual(3);
    expect(reinforcementTier(999999)).toBe(4);
  });
  it("中后期包含七种实际武器职责且同种子配置一致", () => {
    const eco = new Ecology(7);
    const roles = new Set();
    for (let id = 100; id < 121; id++) {
      const c = { ...eco.creatures[0], id, bornAt: 480 };
      equipReinforcement(c);
      roles.add(c.combatRole);
    }
    expect(roles.size).toBe(7);
    expect(new Ecology(7).creatures.map((c) => c.combatRole)).toEqual(eco.creatures.map((c) => c.combatRole));
  });
  it("维修者治疗有上限，布雷者产生有预警延迟的真实地雷", () => {
    const w = new SliceWorld(false, 1, true);
    w.enemies = [];
    w.platforms = [];
    w.player.x = 300;
    w.player.y = 500;
    const medic = new Carrier("reclaimer", 400, 500, "speed", 1);
    const ally = new Carrier("crawler", 440, 500, "speed", 1);
    medic.y = ally.y = 500;
    medic.combatRole = "medic";
    ally.hp = 10;
    w.enemies.push(medic, ally);
    w.hostile.kit(medic).support = 0;
    w.hostile.tick(medic, 0.01);
    expect(ally.hp).toBeGreaterThan(10);
    expect(ally.hp).toBeLessThanOrEqual(34);
    medic.combatRole = "miner";
    w.hostile.kit(medic).support = 0;
    w.hostile.tick(medic, 0.01);
    expect(w.hostile.mines).toHaveLength(1);
    const mine = w.hostile.mines[0];
    w.player.x = mine.x;
    w.player.y = mine.y;
    w.hostile.update(0.81);
    expect(mine.fuse).not.toBeNull();
  });
});
