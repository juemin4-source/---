import { expect, it } from "vitest";
import { World } from "../src/engine/World";
import { EnemyModule } from "../src/engine/EnemyModule";
import { idleControls } from "../src/engine/Player";
import { Projectile } from "../src/engine/Projectile";
it("floater loses lift when the propulsion organ is detached", () => {
  const w = new World();
  w.enemies = [];
  w.modules = [];
  const e = w.spawnEnemy("floater", 800, 350);
  for (let i = 0; i < 60; i++) w.update(1 / 120, idleControls());
  const before = e.y;
  const m = e.modules.find((m) => m.kind === "thruster")!;
  m.detach();
  m.dead = true;
  for (let i = 0; i < 90; i++) w.update(1 / 120, idleControls());
  expect(e.y).toBeGreaterThan(before + 80);
});
it("reclaimer pulls detached pieces preferentially and loses that ability without its grapple", () => {
  const w = new World();
  w.enemies = [];
  w.modules = [];
  w.platforms = w.platforms.slice(0, 1);
  w.player.x = 100;
  const e = w.spawnEnemy("reclaimer", 900, 580),
    m = new EnemyModule("gun", 650, 590);
  m.cooldown = 100;
  w.modules.push(m);
  for (let i = 0; i < 30; i++) w.update(1 / 120, idleControls());
  expect(m.x).toBeGreaterThan(660);
  expect(e.modules[0].targetX).toBeGreaterThan(600);
  e.modules[0].detach();
  expect(e.has("grapple")).toBe(false);
});
it("elite supports both exposed core kill and full intact disassembly", () => {
  const w = new World();
  w.enemies = [];
  w.modules = [];
  const a = w.spawnEnemy("elite", 900, 560);
  for (let i = 0; i < 46; i++) {
    w.projectiles.push(new Projectile(1140, 560, -1000, 0, "player"));
    w.updateProjectiles(0.2);
  }
  expect(a.dead).toBe(true);
  expect(a.modules.every((m) => m.dead)).toBe(true);
  const b = w.spawnEnemy("elite", 900, 560);
  for (const m of b.modules) {
    if (!m.parent) continue;
    w.player.x = m.x - 60;
    w.player.y = m.y;
    w.player.aim = 0;
    for (let i = 0; i < 2; i++) {
      w.player.meleeCooldown = 0;
      w.strike();
    }
  }
  expect(b.modules.every((m) => !m.parent && !m.dead)).toBe(true);
  w.damageEnemy(b, 600);
  expect(b.modules.every((m) => !m.dead)).toBe(true);
});
