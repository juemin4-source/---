import { expect, it } from "vitest";
import { World } from "../src/World";
import { idleControls } from "../src/Player";
it("moves, brakes, jumps, dashes and fires while moving", () => {
  const w = new World(),
    c = idleControls();
  for (let i = 0; i < 60; i++) w.update(1 / 120, c);
  expect(w.player.grounded).toBe(true);
  c.right = true;
  c.fire = true;
  for (let i = 0; i < 24; i++) w.update(1 / 120, c);
  expect(w.player.vx).toBe(325);
  expect(w.projectiles.length).toBeGreaterThan(0);
  c.right = false;
  for (let i = 0; i < 12; i++) w.update(1 / 120, c);
  expect(w.player.vx).toBe(0);
  c.jump = true;
  c.jumpHeld = true;
  w.update(1 / 120, c);
  expect(w.player.vy).toBeLessThan(-500);
  c.jump = false;
  c.dash = true;
  w.update(1 / 120, c);
  expect(Math.abs(w.player.vx)).toBe(880);
  expect(w.player.vy).toBe(0);
});
