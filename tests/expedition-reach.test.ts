import { describe, expect, it } from "vitest";
import { Player, idleControls } from "../src/engine/Player";
import { buildGeometry } from "../src/game/expedition/ExpeditionGeometry";
import { districts } from "../src/game/expedition/ExpeditionMap";

/** Jump with the key held, using the real Player physics, and return the height gained. */
function measureJump(): number {
  const sim = new Player();
  const floor = 1760;
  const platforms = [{ x: 500, y: floor, w: 1100, h: 24, oneWay: false }];
  sim.x = 500;
  sim.grounded = true;
  sim.y = floor - 12 - sim.h / 2;
  sim.vy = 0;
  const standY = sim.y;
  const c = { ...idleControls(), jump: true, jumpHeld: true };
  let highest = standY;
  for (let i = 0; i < 180; i++) {
    sim.update(1 / 60, c, platforms);
    highest = Math.min(highest, sim.y);
  }
  return standY - highest;
}

describe("0.10 地图可达性", () => {
  it("跳跃高度是有限的，且远小于区域高度差", () => {
    const jump = measureJump();
    // If this changes, every connector in the map must be re-checked against the new value.
    expect(jump).toBeGreaterThan(90);
    expect(jump).toBeLessThan(260);
  });

  it("每个连接段的台阶间距都小于实测跳跃高度，整张图可以爬上去", () => {
    const jump = measureJump();
    const geo = buildGeometry();
    // A generous margin: climbing must never require a frame-perfect max-height jump.
    const limit = jump * 0.8;
    const failures: string[] = [];
    for (const l of geo.connectors) {
      if (l.sameFloor || l.kind === "drop") continue; // walking, or a one-way descent
      // Rungs are the climbable platforms in this connector's own column; compare SURFACES, since
      // that is what a player actually stands on.
      const surface = (p: { y: number; h: number }) => p.y - p.h / 2;
      const rungs = geo.platforms
        .filter(
          (p) =>
            p.oneWay &&
            Math.abs(p.x - l.x) <= 130 &&
            surface(p) >= l.topSurface - 40 &&
            surface(p) <= l.bottomSurface + 40,
        )
        .map(surface)
        .sort((m, n) => m - n);
      const chain = [l.topSurface, ...rungs, l.bottomSurface];
      for (let i = 1; i < chain.length; i++) {
        const gap = chain[i] - chain[i - 1];
        if (gap > limit)
          failures.push(`${l.a}→${l.b} (${l.kind}) 台阶间距 ${gap.toFixed(0)}px > ${limit.toFixed(0)}px`);
      }
    }
    expect(failures, `不可攀爬的连接段：\n${failures.join("\n")}`).toEqual([]);
  });

  it("连接段的梯子落在实地上，不会悬空在区域外的空隙里", () => {
    const geo = buildGeometry();
    const byDistrict = new Map(districts.map((d) => [d.id, d]));
    const orphan: string[] = [];
    for (const l of geo.connectors) {
      if (l.sameFloor) continue;
      const a = byDistrict.get(l.a)!,
        b = byDistrict.get(l.b)!;
      // The ladder's bottom must sit above a floor: either district's floor, or an apron platform
      // that was added to bridge a diagonal gap.
      const floors = geo.platforms.filter((p) => p.oneWay && Math.abs(p.y - p.h / 2 - l.bottomSurface) < 45);
      const covered =
        (l.x >= a.x && l.x <= a.x + a.w) ||
        (l.x >= b.x && l.x <= b.x + b.w) ||
        floors.some((p) => Math.abs(p.x - l.x) <= p.w / 2 + 20);
      if (!covered) orphan.push(`${l.a}(${a.x}..${a.x + a.w}) ↔ ${l.b}(${b.x}..${b.x + b.w}) · 梯子 ${l.x}`);
    }
    expect(orphan, `连接段悬空：\n${orphan.join("\n")}`).toEqual([]);
  });

  it("每个从下方抵达的上层地板都开了口，否则玩家会永远撞在地板底面", () => {
    const geo = buildGeometry();
    const byDistrict = new Map(districts.map((d) => [d.id, d]));
    const blocked: string[] = [];
    for (const l of geo.connectors) {
      if (l.sameFloor) continue;
      const a = byDistrict.get(l.a)!,
        b = byDistrict.get(l.b)!;
      const upper = a.floor < b.floor ? a : b;
      // The upper district's SOLID floor segments must leave a gap at the connector's column.
      const solids = geo.platforms.filter(
        (p) =>
          !p.oneWay &&
          Math.abs(p.y - upper.floor) < 2 &&
          Math.abs(p.x - (upper.x + upper.w / 2)) <= upper.w / 2 + 40,
      );
      const covered = solids.some((p) => l.x >= p.x - p.w / 2 && l.x <= p.x + p.w / 2);
      if (covered) blocked.push(`${l.a}↔${l.b}：${upper.id} 地板在 x=${l.x} 仍有实心块，爬上去会撞头`);
    }
    expect(blocked, `地板没有开口：\n${blocked.join("\n")}`).toEqual([]);
  });

  it("站在出生点不会卡进地板，也不会掉出地图", () => {
    const geo = buildGeometry();
    const p = { x: geo.start.x, y: geo.start.y, w: 25, h: 48 };
    const overlapping = geo.platforms.filter(
      (q) => Math.abs(p.x - q.x) < (p.w + q.w) / 2 - 2 && Math.abs(p.y - q.y) < (p.h + q.h) / 2 - 2,
    );
    expect(overlapping, `出生点嵌进了 ${overlapping.length} 块平台`).toEqual([]);
    expect(geo.start.x).toBeGreaterThan(0);
    expect(geo.start.x).toBeLessThan(geo.size.width);
    expect(geo.start.y).toBeGreaterThan(0);
    expect(geo.start.y).toBeLessThan(geo.size.height);
  });
});
