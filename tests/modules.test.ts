import { expect, it } from "vitest";
import { World } from "../src/World";
import { idleControls } from "../src/Player";
import { EnemyModule } from "../src/EnemyModule";
it("melee detaches a usable module without killing its core", () => {
  const w = new World(),
    m = w.modules[0],
    e = w.enemies[0],
    c = idleControls();
  w.player.x = m.x - 60;
  w.player.y = m.y;
  c.melee = true;
  w.update(1 / 120, c);
  expect(m.parent).toBe(e);
  w.player.meleeCooldown = 0;
  w.update(1 / 120, c);
  expect(m.parent).toBeNull();
  expect(m.hp).toBe(m.maxHp);
  expect(e.hp).toBe(e.maxHp);
  expect(e.has("gun")).toBe(false);
});
it("shooting a module destroys it instead of producing free equipment", () => {
  const w = new World(),
    m = w.modules[0];
  m.damage(100);
  expect(m.dead).toBe(true);
  expect(w.enemies[0].has("gun")).toBe(false);
});
it("detached gun falls and continues firing independently", () => {
  const w = new World(),
    m = w.modules[0];
  m.detach();
  m.cooldown = 0;
  w.update(1 / 120, idleControls());
  expect(w.projectiles.some((p) => p.team === "wild")).toBe(true);
  for (let i = 0; i < 240; i++) w.update(1 / 120, idleControls());
  expect(m.grounded).toBe(true);
});
it("fourth phase releases oldest; repeated phase does not consume a slot", () => {
  const w = new World(),
    ms = Array.from({ length: 4 }, () => new EnemyModule("gun", 200, 500));
  ms.forEach((m) => {
    w.modules.push(m);
    w.stabilize(m);
  });
  expect(ms.map((m) => m.stable)).toEqual([false, true, true, true]);
  w.stabilize(ms[3]);
  expect(w.stableQueue.length).toBe(3);
});
