import { describe, it, expect } from "vitest";
import { SliceWorld } from "../src/game/SliceWorld";
import { organIds } from "../src/game/config";
import { sites } from "../src/game/AscentMap";

describe("自动拾取与无限收集", () => {
  it("六槽同类近距离自动叠整组，新类型仍留在地上", () => {
    const w = new SliceWorld();
    w.grant("ram");
    w.drops.push(
      { id: 10, x: w.player.x + 25, y: w.player.y, organ: "ram", stacks: 4 },
      { id: 11, x: w.player.x, y: w.player.y, organ: "speed" },
    );
    w.step(0.1);
    expect(w.count("ram")).toBe(5);
    expect(w.pendingDrop).toBeNull();
    expect(w.has("speed")).toBe(false);
    expect(w.drops).toHaveLength(1);
    w.step(0.2);
    expect(w.count("ram")).toBe(5);
  });
  it("隔墙、隔层和远处不会吸取，暂停选择与死亡不会捡", () => {
    const w = new SliceWorld();
    w.grant("ram");
    w.player.x = 200;
    w.player.y = 580;
    w.drops.push({ id: 10, x: 230, y: 580, organ: "ram" }, { id: 11, x: 200, y: 490, organ: "ram" });
    w.platforms.push({ x: 215, y: 580, w: 8, h: 70 });
    w.autoCollect();
    expect(w.count("ram")).toBe(1);
    w.platforms = [];
    w.pendingDrop = w.drops[1];
    w.autoCollect();
    expect(w.count("ram")).toBe(1);
    w.pendingDrop = null;
    w.result = "dead";
    w.autoCollect();
    expect(w.count("ram")).toBe(1);
  });
  it("无限模式 28 种全接入，第七种及重复层数都不弹框", () => {
    const w = new SliceWorld(false, 1, false, true, true);
    for (const [i, id] of organIds.entries())
      w.drops.push({ id: i + 10, x: w.player.x, y: w.player.y, organ: id });
    w.autoCollect();
    expect(w.slots).toHaveLength(28);
    expect(w.totalLayers).toBe(28);
    expect(w.collectedLayers).toBe(28);
    expect(w.pendingDrop).toBeNull();
    expect(w.drops).toHaveLength(0);
    w.drops.push({ id: 99, x: w.player.x, y: w.player.y, organ: "speed", stacks: 10 });
    w.autoCollect();
    expect(w.count("speed")).toBe(11);
    expect(w.slots).toHaveLength(28);
  });
  it("无限开箱直接接入，但原六槽仍要求选择", () => {
    const s = sites.find((s) => s.id === "pump-cache")!;
    const w = new SliceWorld(false, 1, false, true, true);
    w.player.x = s.x;
    w.player.y = s.y;
    w.interact();
    expect(w.has("knock")).toBe(true);
    expect(w.pendingDrop).toBeNull();
    const original = new SliceWorld(false, 1, false, true);
    original.player.x = s.x;
    original.player.y = s.y;
    original.interact();
    expect(original.pendingDrop?.organ).toBe("knock");
  });
  it("0.10 删除了时间增压：沉井不再有 pressure / incursion / healthScale", () => {
    // The point of 0.10: danger comes from the ecosystem the player disturbs, never from elapsed
    // time. This fails loudly if the timer-based model is ever reintroduced.
    const w = new SliceWorld(false, 1, false, true, true);
    const a = w.ascent as unknown as Record<string, unknown>;
    for (const gone of ["pressure", "incursion", "healthScale", "damageScale", "nextIncursion"])
      expect(a[gone], `Ascent.${gone} 应已删除`).toBeUndefined();
    // Enemy health must not grow with time: the same body keeps its health as the run ages.
    const e = w.enemies[0],
      hp = e.maxHp;
    w.time = 900;
    w.step(0.02);
    expect(e.maxHp).toBe(hp);
  });
  it("生态出行不会因为玩家收集层数或时间而变强", () => {
    const w = new SliceWorld(false, 1, false, true, true, true);
    const ex = w.expedition!;
    expect(ex.eco.alive.length).toBeGreaterThan(0);
    w.grant("speed", 6);
    w.time = 600;
    w.step(0.02);
    // Creature health is a function of organs and stage only, so nothing here is unbounded.
    const after = ex.eco.alive.map((c) => c.maxHp);
    expect(after.length).toBeGreaterThan(0);
    expect(Math.max(...after)).toBeLessThan(2000);
  });
  it("六槽与训练模式不产生生态出行；训练场仍按波次独立增压", () => {
    const six = new SliceWorld(false, 1, false, true);
    expect(six.ascent).toBeTruthy();
    expect(six.expedition).toBeNull();
    const t = new SliceWorld(false, 1, true);
    expect(t.expedition).toBeNull();
    expect(t.enemyHealthScale()).toBeGreaterThan(0);
  });
});
