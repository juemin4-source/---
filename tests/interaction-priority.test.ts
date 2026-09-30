import { expect, it } from "vitest";
import { SliceWorld } from "../src/game/SliceWorld";
import { idleControls } from "../src/engine/Player";
import { extractorPos, extractors, shortcutDefs } from "../src/game/expedition/ExpeditionContent";
import { lootDefs } from "../src/game/expedition/LootSystem";
const setup = (pos: { x: number; y: number }) => {
  const w = new SliceWorld(false, 1, false, true, true, true);
  w.player.x = pos.x;
  w.player.y = pos.y;
  w.player.grounded = true;
  const ex = w.expedition!;
  ex.piles = [
    {
      uid: 999,
      ...pos,
      district: "deep",
      source: "重叠箱",
      taken: false,
      difficulty: 1,
      items: [{ uid: 998, def: lootDefs.fuelCell, source: "test", district: "deep" }],
    },
  ];
  return w;
};
it("重叠箱子不能阻止开闸，同一次长按不能顺带搜索", () => {
  const s = shortcutDefs.find((s) => s.id === "freight-power")!;
  const w = setup(extractorPos({ ...s, needsPower: false, cargo: false })),
    ex = w.expedition!;
  expect(w.nearby()?.type).toBe("shortcut");
  w.interact();
  expect(ex.power).toBe(true);
  for (let i = 0; i < 30; i++) ex.update(0.1, idleControls(), true, false, false);
  expect(ex.metrics.searchesStarted).toBe(0);
  expect(ex.piles[0].taken).toBe(false);
  ex.update(0.01, idleControls(), false, false, false);
  expect(w.nearby()?.type).toBe("search");
  for (let i = 0; i < 20; i++) ex.update(0.1, idleControls(), true, false, false);
  expect(ex.metrics.searchesCompleted).toBe(1);
});
it("箱子和封装器官重叠在撤离点时，提示和实际动作都仍然是撤离", () => {
  const pos = extractorPos(extractors[0]),
    w = setup(pos),
    ex = w.expedition!;
  ex.objectives.packing = true;
  w.drops = [{ id: 88, ...pos, organ: "speed" }];
  expect(w.nearby()?.type).toBe("exit");
  w.interact();
  expect(ex.cargo.items).toHaveLength(0);
  w.god = true;
  for (let i = 0; i < 240 && !w.result; i++) w.update(1 / 60, idleControls(), true);
  expect(w.result).toBe("extracted");
  expect(ex.metrics.searchesStarted).toBe(0);
});
it("新增燃料柜和供电开关的交互范围不再重叠", () => {
  const w = new SliceWorld(false, 1, false, true, true, true),
    p = w.expedition!.piles.find((p) => p.source === "聚变燃料柜")!;
  const s = shortcutDefs.find((s) => s.id === "freight-power")!,
    pos = extractorPos({ ...s, needsPower: false, cargo: false });
  expect(Math.abs(p.x - pos.x)).toBeGreaterThan(158);
});
