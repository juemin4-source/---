import { describe, expect, it } from "vitest";
import { SliceWorld, Carrier } from "../src/game/SliceWorld";
import { idleControls } from "../src/engine/Player";
import { Ecology } from "../src/game/expedition/Ecology";

const world = () => new SliceWorld(false, 1, false, true, true, true);
describe("探索生态与成长回归", () => {
  it("看不见玩家的实体仍巡逻，不落入近远场都不更新的空档", () => {
    const w = world(),
      ex = w.expedition!;
    ex.update(0, idleControls(), false, false, false);
    const body = [...ex.live.values()].find((b) => b.x > 1300)!;
    const x = body.x;
    for (let i = 0; i < 120; i++) w.update(1 / 60, idleControls());
    expect(Math.abs(body.x - x)).toBeGreaterThan(10);
    expect(body.aggro).toBe(0);
  });
  it("站在观察廊三分钟，实体发生捕食、吞噬与成熟，玩家不参与战斗", () => {
    const w = world(),
      ex = w.expedition!;
    w.player.x = 2550;
    w.player.y = 2085;
    w.god = true;
    ex.update(0, idleControls(), false, false, false);
    const seen = new Set<string>();
    const localMature = new Set<number>();
    for (let i = 0; i < 180 * 30; i++) {
      w.update(1 / 30, idleControls());
      for (const c of ex.eco.alive)
        if (ex.live.has(c.id) && c.district === "lower") {
          seen.add(c.intent);
          if (c.stage !== "juvenile") localMature.add(c.id);
        }
    }
    const localMeals = ex.eco.log.filter((l) => l.event === "consume_complete");
    console.log("observer", {
      seen: [...seen],
      meals: localMeals.length,
      kills: ex.eco.metrics.creatureVsCreatureKills,
      mature: ex.eco.metrics.matureCreated,
      localMature: localMature.size,
    });
    expect(seen.has("fightCreature")).toBe(true);
    expect(seen.has("consume")).toBe(true);
    expect(ex.eco.metrics.matureCreated).toBeGreaterThan(0);
    expect(w.metrics.dealt).toBe(0);
    expect(localMature.size).toBeGreaterThan(0);
  });
  it("巡游者也能凭进食成熟，身份不会变成新刷出的 Boss", () => {
    const eco = new Ecology(4),
      c = eco.spawnRoamer("lower", "hunter")!;
    const id = c.id;
    const meal = eco.createRemains(c);
    meal.x = c.x;
    meal.y = c.y;
    meal.biomass = 20;
    c.hunger = 1;
    for (let i = 0; i < 60; i++) eco.physicalIntent(c, 0.1, false);
    expect(c.stage).toBe("mature");
    expect(c.id).toBe(id);
    expect(c.organs.totalLayers).toBeGreaterThan(1);
  });
  it("清空巢区后会补充幼体，但玩家贴着巢穴时不当面刷怪", () => {
    const eco = new Ecology(3),
      nest = eco.nests.find((n) => n.district === "lower")!;
    eco.nests = [nest];
    eco.creatures = [];
    eco.remains = [];
    nest.spawnTimer = 0;
    eco.update(30, { player: null, open: new Set() });
    expect(eco.alive.length).toBeGreaterThan(0);
    expect(eco.alive.length).toBeLessThanOrEqual(3);
    eco.creatures = [];
    nest.spawnTimer = 0;
    const floor = 2254;
    eco.update(30, { player: { x: nest.x, y: floor, district: "lower" }, open: new Set() });
    expect(eco.alive).toHaveLength(0);
  });
  it("发现玩家后追过 600 像素，不会稍微拉开就脱战", () => {
    const w = world(),
      ex = w.expedition!;
    w.player.x = 1000;
    w.player.y = 2176;
    ex.district = "cargo";
    ex.update(0, idleControls(), false, false, false);
    const body = [...ex.live.values()].find((b) => b.x === 980)!;
    body.x = 1500;
    body.aggro = 8;
    expect(ex.mayPursue(body)).toBe(true);
    expect(ex.mayPursue(Object.assign(body, { x: 1700 }))).toBe(true);
  });
  it("普通敌人不再倾倒全部层数，稀有个体回收更多种，尸骸保留原构筑", () => {
    const w = world(),
      ex = w.expedition!;
    const e = new Carrier("crawler", 1000, 2200, { battery: 50, mark: 30, armor: 10 }, 1);
    let layers = 0;
    for (let i = 0; i < 30; i++) layers += ex.salvage(e).reduce((n, [, v]) => n + v, 0);
    expect(layers).toBe(12);
    expect(e.count("battery")).toBe(50);
    w.grant("speed", 20);
    expect(w.count("speed")).toBe(20);
    expect(w.speedFactor()).toBeLessThan(3);
  });
  it("基础生命可叠加，护甲减伤有收益且不会免疫，移除后效果消失", () => {
    const w = world();
    w.grant("vitality", 2);
    expect(w.player.maxHp).toBe(140);
    w.grant("armor", 5);
    w.player.invulnerable = 0;
    const before = w.player.hp;
    w.hurtPlayer(32, w.player.x + 100);
    expect(before - w.player.hp).toBeCloseTo(20);
    w.slots = w.slots.filter((id) => id !== "armor");
    w.player.invulnerable = 0;
    const hp = w.player.hp;
    w.hurtPlayer(32, w.player.x + 100);
    expect(hp - w.player.hp).toBeCloseTo(32);
  });
});
