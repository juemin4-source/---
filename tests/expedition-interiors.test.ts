import { buildLootPiles, extractors, extractorPos } from "../src/game/expedition/ExpeditionContent";
import { overlaps } from "../src/engine/PhysicsHelpers";
import { describe, expect, it } from "vitest";
import { SliceWorld } from "../src/game/SliceWorld";
import { Player, idleControls } from "../src/engine/Player";
import { buildGeometry } from "../src/game/expedition/ExpeditionGeometry";

describe("探索入口与地面拾取", () => {
  it("无限探索自动接入落在地板上的新器官，并叠加同类，无需 E", () => {
    const w = new SliceWorld(false, 1, false, true, true, true);
    const p = w.player;
    w.drops = [
      { id: 1, x: p.x + 8, y: p.y + 24, organ: "battery" },
      { id: 2, x: p.x - 8, y: p.y + 24, organ: "battery", stacks: 2 },
    ];
    w.autoCollect();
    expect(w.count("battery")).toBe(3);
    expect(w.drops).toEqual([]);
    expect(w.pendingDrop).toBeNull();
  });
  it("不能隔着实体墙捡器官", () => {
    const w = new SliceWorld(false, 1, false, true, true, true);
    const { x, y } = w.player;
    w.platforms.push({ x: x + 30, y, w: 12, h: 100 });
    w.drops = [{ id: 1, x: x + 50, y, organ: "battery" }];
    w.autoCollect();
    expect(w.count("battery")).toBe(0);
  });
  it("气闸平地出发进入工区，不强迫爬梯", () => {
    const geo = buildGeometry(),
      p = new Player();
    Object.assign(p, geo.start);
    p.boundsWidth = geo.size.width;
    p.ladders = geo.ladders;
    for (let i = 0; i < 240; i++) p.update(1 / 120, { ...idleControls(), right: true }, geo.platforms);
    expect(p.x).toBeGreaterThan(850);
    expect(p.y).toBeCloseTo(geo.start.y);
    expect(p.climbing).toBeNull();
  });

  it("搜索点和撤离点没有埋进新墙体，实体怪物也不会生成在墙内", () => {
    const w = new SliceWorld(false, 1, false, true, true, true);
    const geo = w.expedition!.geometry;
    for (const p of [...buildLootPiles(() => true), ...extractors.map(extractorPos)]) {
      expect(
        geo.platforms.some((r) => !r.oneWay && overlaps({ ...p, w: 25, h: 48 }, r)),
        JSON.stringify(p),
      ).toBe(false);
    }
    w.expedition!.update(0, idleControls(), false, false, false);
    for (const e of w.enemies) expect(geo.platforms.some((r) => !r.oneWay && overlaps(e, r))).toBe(false);
  });
});
