import { describe, it, expect } from "vitest";
import { Player, idleControls } from "../src/engine/Player";
import { buildGeometry } from "../src/game/expedition/ExpeditionGeometry";
import { SliceWorld } from "../src/game/SliceWorld";

describe("梯子、蹬墙与货梯", () => {
  it("所有普通梯子能从底端爬上出口，并能向下爬回", () => {
    const geo = buildGeometry();
    for (const l of geo.ladders) {
      const p = new Player();
      p.boundsWidth = geo.size.width;
      p.ladders = [l];
      p.x = l.x;
      p.y = l.bottom - 24;
      for (let i = 0; i < Math.ceil(((l.bottom - l.top) / 175) * 120) + 3; i++)
        p.update(1 / 120, { ...idleControls(), up: true }, geo.platforms);
      expect(p.y, `ladder ${l.x}`).toBeCloseTo(l.top - 24, 0);
      for (let i = 0; i < 30; i++) p.update(1 / 120, idleControls(), geo.platforms);
      for (let i = 0; i < Math.ceil(((l.bottom - l.top) / 175) * 120) + 30; i++)
        p.update(1 / 120, { ...idleControls(), down: true }, geo.platforms);
      expect(p.y).toBeGreaterThanOrEqual(l.bottom - 25);
    }
  });
  it("梯子不自动吸附，跳离后不立即重新吸住，重物不能攀爬", () => {
    const p = new Player();
    p.ladders = [{ x: 300, top: 100, bottom: 600 }];
    p.x = 300;
    p.y = 400;
    p.update(1 / 120, idleControls(), []);
    expect(p.climbing).toBeNull();
    p.update(1 / 120, { ...idleControls(), up: true }, []);
    expect(p.climbing).not.toBeNull();
    p.update(1 / 120, { ...idleControls(), up: true, jump: true }, []);
    expect(p.climbing).toBeNull();
    expect(p.vy).toBeLessThan(0);
    p.traversalBlocked = true;
    p.update(1 / 120, { ...idleControls(), up: true }, []);
    expect(p.climbing).toBeNull();
  });
  it("贴墙滑落限速，蹬墙跳向外推出，不消耗二段跳", () => {
    const p = new Player();
    p.x = 287.5;
    p.y = 300;
    p.vy = 600;
    const walls = [{ x: 310, y: 350, w: 20, h: 600 }];
    p.update(1 / 120, { ...idleControls(), right: true }, walls);
    expect(p.vy).toBeLessThan(120);
    p.update(1 / 120, { ...idleControls(), right: true, jump: true, jumpHeld: true }, walls);
    expect(p.vx).toBeLessThan(-300);
    expect(p.vy).toBeLessThan(-500);
    expect(p.airJumpAvailable).toBe(true);
  });
  it("货梯供电后实际带着玩家上升，断电时静止", () => {
    const w = new SliceWorld(false, 1, false, true, true, true),
      ex = w.expedition!,
      lift = ex.geometry.lifts[0];
    const platform = w.platforms[lift.index];
    w.player.x = platform.x;
    w.player.y = platform.y - platform.h / 2 - 24;
    w.player.grounded = true;
    const y = w.player.y;
    ex.update(0.5, idleControls(), false, false, false);
    expect(w.player.y).toBe(y);
    ex.power = true;
    ex.update(0.5, idleControls(), false, false, false);
    expect(w.player.y).toBeCloseTo(y - 47.5);
  });
  it("真实竖井可左右交替蹬跳到顶，途中没有悬空梯级", () => {
    const geo = buildGeometry();
    for (const shaft of geo.connectors.filter((c) => c.kind === "shaft")) {
      const p = new Player();
      p.boundsWidth = geo.size.width;
      p.x = shaft.x;
      p.y = shaft.bottomSurface - 24;
      p.grounded = true;
      let dir = 1,
        highest = p.y;
      for (let i = 0; i < 2400 && highest > shaft.topSurface - 25; i++) {
        const touching = Math.abs(p.x - shaft.x) > 53;
        if (touching) dir = p.x < shaft.x ? 1 : -1;
        p.update(
          1 / 120,
          { ...idleControls(), left: dir < 0, right: dir > 0, jump: p.grounded || touching, jumpHeld: true },
          geo.platforms,
        );
        highest = Math.min(highest, p.y);
      }
      expect(highest, `shaft ${shaft.x}`).toBeLessThan(shaft.topSurface - 24);
    }
  });
});
