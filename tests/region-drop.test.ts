import { expect, it } from "vitest";
import { Body, integrate, type Rect } from "../src/PhysicsHelpers";
it("down input crosses catwalks but still lands on the solid region floor", () => {
  const platforms: Rect[] = [
    { x: 500, y: 450, w: 400, h: 20, oneWay: true },
    { x: 500, y: 665, w: 1000, h: 110 },
  ];
  const p = new Body(500, 416, 30, 48);
  for (let i = 0; i < 60; i++) integrate(p, 1 / 120, platforms);
  expect(p.y).toBe(416);
  p.platformDrop = true;
  for (let i = 0; i < 180; i++) integrate(p, 1 / 120, platforms);
  expect(p.y).toBe(586);
  expect(p.grounded).toBe(true);
});
