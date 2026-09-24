import { it, expect } from "vitest";
import { Expedition } from "../src/Expedition";
import { idleControls } from "../src/Player";
it("a rider is carried continuously to the shaft's upper walkway without teleportation", () => {
  const e = new Expedition();
  e.start(6);
  e.zoneId = "core";
  e.world.enemies = [];
  const lift = e.area.lift!,
    p = e.world.player;
  p.x = lift.x;
  p.y = lift.y - lift.h / 2 - p.h / 2;
  p.vy = 0;
  let previous = p.y,
    maxDelta = 0;
  for (let i = 0; i < 3000; i++) {
    e.update(1 / 120, idleControls());
    maxDelta = Math.max(maxDelta, Math.abs(p.y - previous));
    previous = p.y;
  }
  expect(p.y).toBeLessThan(800);
  expect(maxDelta).toBeLessThan(4);
  expect(e.state).toBe("field");
});
