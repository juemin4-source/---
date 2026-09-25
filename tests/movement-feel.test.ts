import { expect, it } from "vitest";
import { Player, idleControls } from "../src/engine/Player";
import { SliceWorld } from "../src/game/SliceWorld";

const floor = [{ x: 640, y: 650, w: 1280, h: 80 }];
function actor() {
  const p = new Player();
  p.x = 400;
  p.y = 586;
  p.grounded = true;
  return p;
}
const tick = (p: Player, c = idleControls(), frames = 1) => {
  for (let i = 0; i < frames; i++) p.update(1 / 120, c, floor);
};

it("reaches run speed, reverses promptly and stops without sliding", () => {
  const p = actor(),
    c = idleControls();
  c.right = true;
  tick(p, c, 8);
  expect(p.vx).toBe(325);
  c.right = false;
  c.left = true;
  tick(p, c, 7);
  expect(p.vx).toBeLessThan(0);
  c.left = false;
  tick(p, c, 8);
  expect(p.vx).toBe(0);
});
it("held jumps clear existing stairs while tapped jumps stay lower", () => {
  const height = (held: boolean) => {
    const p = actor(),
      c = idleControls();
    c.jump = true;
    c.jumpHeld = held;
    tick(p, c);
    c.jump = false;
    let top = p.y;
    for (let i = 0; i < 120; i++) {
      tick(p, c);
      top = Math.min(top, p.y);
    }
    expect(p.grounded).toBe(true);
    return 586 - top;
  };
  const high = height(true),
    low = height(false);
  expect(high).toBeGreaterThan(105);
  expect(high).toBeLessThan(135);
  expect(high - low).toBeGreaterThan(30);
});
it("buffers a jump just before landing", () => {
  const p = actor(),
    c = idleControls();
  p.y -= 7;
  p.grounded = false;
  p.vy = 300;
  c.jump = true;
  c.jumpHeld = true;
  tick(p, c);
  c.jump = false;
  tick(p, c, 5);
  expect(p.vy).toBeLessThan(-500);
});
it("dashes in the last movement direction and can chain a ground jump", () => {
  const p = actor(),
    c = idleControls();
  c.right = true;
  c.mx = 0;
  tick(p, c, 8);
  c.right = false;
  c.dash = true;
  tick(p, c);
  c.dash = false;
  expect(p.vx).toBe(880);
  tick(p, c, 6);
  c.jump = true;
  c.jumpHeld = true;
  tick(p, c, 2);
  expect(p.dashTime).toBe(0);
  expect(p.vy).toBeLessThan(-500);
  expect(p.trails.length).toBeGreaterThan(0);
});
it("dash cancels slam and spends stamina only once", () => {
  const w = new SliceWorld(false, 1, true),
    c = idleControls();
  w.enemies = [];
  w.trainingAuto = false;
  w.player.y = 400;
  w.player.grounded = false;
  w.slamming = true;
  w.slamWindup = 0.05;
  c.dash = true;
  c.right = true;
  w.update(1 / 120, c);
  c.dash = false;
  expect(w.slamming).toBe(false);
  expect(w.player.vy).toBe(0);
  expect(w.stamina).toBe(80);
  for (let i = 0; i < 10; i++) w.update(1 / 120, c);
  expect(w.stamina).toBeGreaterThan(80);
  expect(w.stamina).toBeLessThan(83);
});
it("slam interrupts air dash and lands instead of hovering", () => {
  const w = new SliceWorld(false, 1, true),
    c = idleControls();
  w.enemies = [];
  w.trainingAuto = false;
  w.player.y = 400;
  w.player.grounded = false;
  w.player.dashTime = 0.12;
  c.melee = true;
  w.update(1 / 120, c);
  c.melee = false;
  expect(w.player.dashTime).toBe(0);
  expect(w.slamming).toBe(true);
  for (let i = 0; i < 60; i++) w.update(1 / 120, c);
  expect(w.slamming).toBe(false);
  expect(w.player.grounded).toBe(true);
});

it("grants one free air jump, rejects a third jump and restores it on landing", () => {
  const p = actor(),
    c = idleControls();
  c.jump = true;
  c.jumpHeld = true;
  tick(p, c);
  c.jump = false;
  tick(p, c, 20);
  c.jump = true;
  tick(p, c);
  c.jump = false;
  expect(p.airJumped).toBe(true);
  expect(p.airJumpAvailable).toBe(false);
  tick(p, c, 20);
  const before = p.vy;
  c.jump = true;
  tick(p, c);
  c.jump = false;
  expect(p.airJumped).toBe(false);
  expect(p.vy).toBeGreaterThan(before);
  tick(p, c, 150);
  expect(p.grounded).toBe(true);
  expect(p.airJumpAvailable).toBe(true);
});

it("holding jump does not automatically consume the second jump", () => {
  const p = actor(),
    c = idleControls();
  c.jump = true;
  c.jumpHeld = true;
  tick(p, c);
  c.jump = false;
  tick(p, c, 30);
  expect(p.airJumpAvailable).toBe(true);
  expect(p.airJumped).toBe(false);
});

it("module jumps extend the free air jump and cannot be consumed while frozen", () => {
  const w = new SliceWorld(false, 1, true),
    c = idleControls();
  w.enemies = [];
  w.trainingAuto = false;
  w.player.y = 350;
  w.player.grounded = false;
  w.airJumps = 1;
  c.jump = true;
  c.jumpHeld = true;
  w.update(1 / 120, c);
  expect(w.airJumps).toBe(1);
  expect(w.player.airJumpAvailable).toBe(false);
  c.jump = false;
  w.update(1 / 120, c);
  w.hostile.playerStatus.frozen = 0.5;
  c.jump = true;
  w.update(1 / 120, c);
  expect(w.airJumps).toBe(1);
  w.hostile.playerStatus.frozen = 0;
  w.update(1 / 120, c);
  expect(w.airJumps).toBe(0);
  expect(w.player.airJumped).toBe(true);
});

it("free air jump can cancel a slam", () => {
  const w = new SliceWorld(false, 1, true),
    c = idleControls();
  w.enemies = [];
  w.trainingAuto = false;
  w.player.y = 350;
  w.player.grounded = false;
  w.slamming = true;
  c.jump = true;
  c.jumpHeld = true;
  w.update(1 / 120, c);
  expect(w.slamming).toBe(false);
  expect(w.player.vy).toBeLessThan(-500);
});
