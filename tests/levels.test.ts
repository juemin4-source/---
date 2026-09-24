import { expect, it } from "vitest";
import { World } from "../src/World";
import { idleControls } from "../src/Player";
it("five rooms advance through gates and elite death completes campaign", () => {
  const w = new World(true);
  w.god = true;
  for (let room = 0; room < 5; room++) {
    expect(w.roomIndex).toBe(room);
    for (let wave = 0; wave < w.room.waves.length; wave++) {
      w.enemies.forEach((e) => w.damageEnemy(e, 9999));
      for (let i = 0; i < 230; i++) w.update(1 / 120, idleControls());
    }
    if (room < 4) {
      expect(w.gateOpen).toBe(true);
      w.player.x = w.room.exit.x;
      w.player.y = w.room.exit.y;
      w.update(1 / 120, idleControls());
    }
  }
  expect(w.complete).toBe(true);
  w.reset();
  expect(w.roomIndex).toBe(0);
  expect(w.complete).toBe(false);
});
it("destroying all propulsion does not permanently softlock ascent room", () => {
  const w = new World(true);
  w.enterRoom(1);
  w.enemies.forEach((e) => w.damageEnemy(e, 9999));
  for (let i = 0; i < 420; i++) w.update(1 / 120, idleControls());
  expect(w.modules.some((m) => !m.dead && m.kind === "thruster")).toBe(true);
});
