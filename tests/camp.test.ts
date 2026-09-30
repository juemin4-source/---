import { describe, expect, it } from "vitest";
import { CampWorld, campStations } from "../src/game/meta/CampWorld";
import { idleControls } from "../src/engine/Player";

describe("独立据点地图", () => {
  it("五个设施沿实际可行走地面可达；无敌人与生态", () => {
    const w = new CampWorld();
    for (const s of campStations) {
      for (let i = 0; i < 1200 && w.player.x < s.x - 15; i++)
        w.step(1 / 120, { ...idleControls(), right: true });
      expect(w.station()?.tab).toBe(s.tab);
      expect(w.player.y).toBeCloseTo(566);
    }
    expect(w.enemies).toHaveLength(0);
    expect(w.modules).toHaveLength(0);
  });
  it("设施必须靠近，跳跃不能掉出安全地图", () => {
    const w = new CampWorld();
    w.player.x = 470;
    expect(w.station()).toBeNull();
    w.step(1 / 120, { ...idleControls(), jump: true, jumpHeld: true });
    expect(w.player.y).toBeLessThan(566);
    for (let i = 0; i < 240; i++) w.step(1 / 120, idleControls());
    expect(w.player.y).toBe(566);
    expect(w.player.hp).toBe(100);
  });
});
