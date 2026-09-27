import { extractors, extractorPos } from "../src/game/expedition/ExpeditionContent";
import { describe, expect, it, vi } from "vitest";
import { SliceWorld } from "../src/game/SliceWorld";
import { idleControls } from "../src/engine/Player";
import { Ecology } from "../src/game/expedition/Ecology";
import { cargoAdd, lootDefs } from "../src/game/expedition/LootSystem";

const setup = () => {
  const w = new SliceWorld(false, 1, false, true, true, true);
  const ex = w.expedition!;
  ex.eco.spawnRoamer("airlock", "scavenger"); // Explicit fixture: production airlock stays safe.
  ex.update(0, idleControls(), false, false, false);
  return { w, ex };
};

describe("实体与离屏生态交接", () => {
  it("实际位置、伤势与器官经过离屏再进场仍然保留", () => {
    const { w, ex } = setup();
    const c = ex.eco.alive.find((c) => c.district === "airlock")!;
    const body = ex.live.get(c.id)!;
    body.x = 400;
    body.y = 2176;
    body.hp = 1;
    body.organs.add("battery", 2);
    const max = body.maxHp;
    ex.update(0, idleControls(), false, false, false);
    expect(c.x).toBe(400);
    expect(c.y).toBe(2176);
    expect(c.hp).toBe(1);
    w.player.x = 3900;
    w.player.y = 400;
    ex.update(0, idleControls(), false, false, false);
    expect(ex.live.has(c.id)).toBe(false);
    w.player.x = 400;
    w.player.y = 2176;
    ex.update(0, idleControls(), false, false, false);
    const restored = ex.live.get(c.id)!;
    expect(restored).not.toBe(body);
    expect(restored.x).toBe(400);
    expect(restored.y).toBe(2176);
    expect(restored.hp).toBe(1);
    expect(restored.maxHp).toBe(max);
    expect(restored.count("battery")).toBe(body.count("battery"));
  });

  it("离屏捕食不能杀死或挪动实体战斗中的怪物", () => {
    const eco = new Ecology(1);
    const [prey, hunter] = eco.alive;
    hunter.x = prey.x;
    hunter.y = prey.y;
    hunter.district = prey.district;
    hunter.intent = "fightCreature";
    hunter.target = prey.id;
    hunter.intentTime = 100;
    prey.hp = 1;
    const pos = { x: prey.x, y: prey.y };
    eco.update(1, { player: null, open: new Set(), materialized: new Set([prey.id]) });
    expect(prey.alive).toBe(true);
    expect(prey.hp).toBe(1);
    expect({ x: prey.x, y: prey.y }).toEqual(pos);
  });

  it("刷新成长属性不会把一滴血的怪物治满", () => {
    const eco = new Ecology(1),
      c = eco.alive[0];
    c.hp = 1;
    c.biomass = 40;
    eco.refreshStats(c);
    expect(c.stage).toBe("apex");
    expect(c.hp).toBe(1);
  });

  it("击杀后的尸骸使用实际死亡位置和器官", () => {
    const { ex } = setup();
    const [id, body] = [...ex.live][0];
    body.x = 500;
    body.y = 1650;
    body.organs.add("battery", 2);
    ex.onEnemyKilled(body, id);
    const remains = ex.eco.remains.find((r) => r.sourceId === id)!;
    expect(remains.x).toBe(500);
    expect(remains.y).toBe(1666);
    expect(remains.organs).toEqual(body.organs.toJSON());
  });

  it("近场进食必须靠近并停留，战斗会中断，完成后成长同步到实体", () => {
    const { ex } = setup();
    const id = ex.eco.alive.find((c) => c.district === "airlock")!.id;
    const body = ex.live.get(id)!;
    body.x = 200;
    const c = ex.eco.alive.find((c) => c.id === id)!;
    c.role = "scavenger";
    const r = ex.eco.createRemains(c);
    r.x = body.x + 200;
    r.y = body.y;
    r.biomass = 30;
    const before = c.biomass;
    for (let i = 0; i < 50; i++) ex.steerBody(body, 0.1, false);
    expect(c.biomass).toBe(before);
    body.x = r.x;
    ex.steerBody(body, 1, false);
    ex.steerBody(body, 1, true);
    expect(c.intent).toBe("fightPlayer");
    expect(ex.eco.remains).toContain(r);
    for (let i = 0; i < 70; i++) ex.steerBody(body, 0.1, false);
    expect(c.biomass).toBeGreaterThan(before);
    expect(ex.eco.remains).not.toContain(r);
    expect(body.maxHp).toBe(c.maxHp);
  });

  it("丢下的大型货物可以在原地再次拾取，身份和价值不复制", () => {
    const { w, ex } = setup();
    const item = { uid: 99999, def: lootDefs.regenTank, district: ex.district, source: "test" };
    cargoAdd(ex.cargo, item);
    ex.dropLoot(item.uid);
    const pile = ex.piles.find((p) => p.items.includes(item))!;
    expect(pile.x).toBe(w.player.x);
    expect(pile.y).toBe(w.player.y);
    expect(ex.cargo.value).toBe(0);
    expect(ex.heavy).toBe(false);
    ex.takeLoot(pile);
    ex.takeLoot(pile);
    expect(ex.cargo.items).toEqual([item]);
    expect(ex.cargo.value).toBe(item.def.value);
    expect(ex.heavy).toBe(true);
  });
  it("重型货物无法从边界进入维修井，放下后立即可以通过", () => {
    const { w, ex } = setup();
    const n = ex.geometry.narrow[0];
    w.player.x = n.x - n.w / 2 - 20;
    w.player.y = n.y;
    ex.update(0, idleControls(), false, false, false);
    const startX = w.player.x;
    const item = { uid: 77777, def: lootDefs.regenTank, district: ex.district, source: "test" };
    cargoAdd(ex.cargo, item);
    w.player.x = n.x;
    w.player.dashTime = 0.2;
    ex.update(0, idleControls(), false, false, false);
    expect(w.player.x).toBe(startX);
    expect(w.player.dashTime).toBe(0);
    ex.dropLoot(item.uid);
    w.player.x = n.x;
    ex.update(0, idleControls(), false, false, false);
    expect(w.player.x).toBe(n.x);
  });

  it("长通路穿过的中间楼板也有出口，不会爬到一半顶住实体楼板", () => {
    const { ex } = setup();
    for (const link of ex.geometry.connectors.filter((l) => !l.sameFloor)) {
      const blockers = ex.geometry.platforms.filter(
        (p, index) =>
          !ex.geometry.gates.some((g) => g.index === index) &&
          !p.oneWay &&
          p.w > p.h &&
          p.y - p.h / 2 >= link.topSurface &&
          p.y - p.h / 2 < link.bottomSurface &&
          Math.abs(p.x - link.x) < p.w / 2 + 13,
      );
      expect(blockers, `${link.a} → ${link.b}`).toEqual([]);
    }
  });
  it("本轮被捕食的单位不能在同一 tick 继续吃尸骸", () => {
    const eco = new Ecology(1);
    const [hunter, prey] = eco.alive;
    eco.creatures = [hunter, prey];
    eco.nests = [];
    hunter.x = prey.x;
    hunter.y = prey.y;
    hunter.district = prey.district;
    hunter.intent = "fightCreature";
    hunter.target = prey.id;
    hunter.intentTime = 10;
    const meal = eco.createRemains(prey);
    prey.intent = "consume";
    prey.remainsTarget = meal.id;
    prey.intentTime = 0;
    meal.claimed = prey.id;
    const chance = vi.spyOn(eco.rng, "chance").mockReturnValue(true);
    eco.step(0.5, { player: null, open: new Set() });
    chance.mockRestore();
    expect(prey.alive).toBe(false);
    expect(eco.metrics.creatureConsumes).toBe(0);
    expect(eco.remains).toContain(meal);
  });

  it("冲刺打断搜索，移动打断撤离", () => {
    const { w, ex } = setup();
    w.enemies = [];
    ex.live.clear();
    ex.eco.creatures = [];
    ex.eco.nests = [];
    const pile = ex.piles[0];
    w.player.x = pile.x;
    w.player.y = pile.y;
    w.player.grounded = true;
    ex.update(0.2, idleControls(), true, false, false);
    expect(ex.search.pile).toBe(pile);
    w.player.dashTime = 0.1;
    ex.update(0.1, idleControls(), true, false, false);
    expect(ex.search.pile).toBeNull();
    expect(pile.taken).toBe(false);
    const other = setup();
    other.w.enemies = [];
    other.ex.live.clear();
    other.ex.eco.creatures = [];
    other.ex.eco.nests = [];
    Object.assign(other.w.player, extractorPos(extractors[0]));
    for (let i = 0; i < 60; i++) other.w.update(1 / 120, idleControls(), true);
    expect(other.w.extraction).toBeGreaterThan(0.4);
    other.w.update(1 / 120, { ...idleControls(), right: true }, true);
    expect(other.w.extraction).toBe(0);
  });
});
