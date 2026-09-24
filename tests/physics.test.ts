import { expect, it } from "vitest";
import { World } from "../src/engine/World";
import { EnemyModule } from "../src/engine/EnemyModule";
import { Projectile } from "../src/engine/Projectile";
import { idleControls } from "../src/engine/Player";
import { updateModules } from "../src/engine/ModuleSystems";
const lab = () => {
  const w = new World();
  w.enemies = [];
  w.modules = [];
  w.platforms = w.platforms.slice(0, 1);
  w.player.x = 80;
  return w;
};
it("upward jet lifts player above the normal jump envelope", () => {
  const w = lab(),
    m = new EnemyModule("thruster", 350, 595);
  w.modules.push(m);
  w.stabilize(m);
  w.player.x = 350;
  w.player.y = 560;
  let top = 560;
  for (let i = 0; i < 140; i++) {
    w.update(1 / 120, idleControls());
    top = Math.min(top, w.player.y);
  }
  expect(top).toBeLessThan(310);
  expect(top).toBeGreaterThanOrEqual(w.player.h / 2 + 12);
});
it("carrying an upward jet while aiming down does not launch its carrier", () => {
  const w = lab(),
    m = new EnemyModule("thruster", 350, 595);
  w.modules.push(m);
  w.stabilize(m);
  w.player.x = 350;
  w.player.y = 586;
  m.held = true;
  w.held = m;
  const c = idleControls();
  c.mx = 350;
  c.my = 700;
  for (let i = 0; i < 360; i++) w.update(1 / 120, c);
  expect(w.player.y).toBeGreaterThan(550);
  expect(w.stats.boosted).toBe(false);
});
it("same jet pushes a shield into a damaging high speed slide", () => {
  const w = lab(),
    t = new EnemyModule("thruster", 300, 580),
    s = new EnemyModule("shield", 380, 564);
  t.angle = 0;
  w.modules.push(t, s);
  w.stabilize(t);
  w.stabilize(s);
  for (let i = 0; i < 25; i++) updateModules(w, 1 / 120);
  expect(s.vx).toBeGreaterThan(300);
  expect(s.x).toBeGreaterThan(410);
});
it("stable shield intercepts fast hostile shots before they reach player", () => {
  const w = lab(),
    s = new EnemyModule("shield", 400, 550);
  w.modules.push(s);
  w.stabilize(s);
  w.player.x = 300;
  w.player.y = 550;
  w.projectiles.push(new Projectile(500, 550, -12000, 0, "enemy"));
  w.updateProjectiles(1 / 60);
  expect(w.projectiles).toHaveLength(0);
  expect(w.player.hp).toBe(100);
  expect(s.hp).toBe(s.maxHp);
});
it("phased grapple drags a loose physical module towards itself", () => {
  const w = lab(),
    g = new EnemyModule("grapple", 300, 580),
    s = new EnemyModule("shield", 500, 564);
  g.angle = 0;
  w.modules.push(g, s);
  w.stabilize(g);
  for (let i = 0; i < 40; i++) updateModules(w, 1 / 120);
  expect(s.x).toBeLessThan(465);
  expect(s.vx).toBeLessThan(0);
});
it("turning a grounded shield upright preserves ground contact without teleporting", () => {
  const w = lab(),
    s = new EnemyModule("shield", 300, 598);
  s.w = 92;
  s.h = 24;
  s.grounded = true;
  w.modules.push(s);
  w.stabilize(s);
  w.player.x = 240;
  const c = idleControls();
  c.rotate = 1;
  c.mx = 300;
  c.my = 598;
  w.update(1 / 120, c);
  expect(s.h).toBe(92);
  expect(s.x).toBeCloseTo(300);
  expect(s.y + s.h / 2).toBeCloseTo(610);
});
it("reclaimer shield can detach at ground level without penetrating the floor", () => {
  const w = lab(),
    e = w.spawnEnemy("reclaimer", 700, 586, "shield");
  const s = e.modules.find((m) => m.kind === "shield")!;
  s.detach();
  w.update(1 / 120, idleControls());
  expect(s.x).toBeGreaterThan(600);
  expect(s.x).toBeLessThan(660);
  expect(s.y + s.h / 2).toBeLessThanOrEqual(610);
});
it("point-blank fire still hits a core overlapping the muzzle", () => {
  const w = lab();
  const e = w.spawnEnemy("crawler", 300, 586, "gun");
  w.player.x = 300;
  w.player.y = 586;
  const c = idleControls();
  c.fire = true;
  c.mx = 500;
  c.my = 586;
  w.update(1 / 120, c);
  expect(e.hp).toBeLessThan(e.maxHp);
});
