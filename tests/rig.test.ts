import { it, expect } from "vitest";
import { World } from "../src/World";
import { OrganRig } from "../src/OrganRig";
import { EnemyModule, type ModuleKind } from "../src/EnemyModule";
import { idleControls } from "../src/Player";
import { Projectile } from "../src/Projectile";
import { Expedition } from "../src/Expedition";
function lab() {
  const w = new World();
  w.enemies = [];
  w.modules = [];
  w.platforms = [{ x: 640, y: 665, w: 1280, h: 110 }];
  w.player.x = 300;
  w.player.y = 586;
  w.rig = new OrganRig();
  w.salvageOnKill = true;
  return w;
}
function install(w: World, kind: ModuleKind) {
  const m = new EnemyModule(kind, w.player.x + 40, 550);
  w.modules.push(m);
  expect(w.rig!.installNearest(w)).toBe(true);
  return m;
}
it("killing an enemy yields one usable organ that one input connects", () => {
  const w = lab();
  const e = w.spawnEnemy("crawler", 500, 586, "gun");
  w.damageEnemy(e, 999);
  const m = e.modules[0];
  expect(m.dead).toBe(false);
  expect(m.parent).toBeNull();
  w.player.x = m.x - 30;
  expect(w.rig!.installNearest(w)).toBe(true);
  expect(m.stable && m.mounted).toBe(true);
  expect(w.rig!.has("gun")).toBe(true);
});
it("kill salvage stays dormant until stabilization so pickup cannot launch the player", () => {
  const w = lab();
  const e = w.spawnEnemy("crawler", 300, 586, "thruster");
  w.damageEnemy(e, 999);
  const m = e.modules[0];
  w.player.x = m.x;
  for (let i = 0; i < 500; i++) w.update(1 / 120, idleControls());
  expect(w.player.y).toBeGreaterThan(550);
  expect(m.dormant).toBe(true);
  w.rig!.installNearest(w);
  expect(m.dormant).toBe(false);
});
it("old combat retains its deliberate dismantling rule", () => {
  const w = lab();
  w.salvageOnKill = false;
  const e = w.spawnEnemy("crawler", 500, 586, "gun");
  w.damageEnemy(e, 999);
  expect(e.modules[0].dead).toBe(true);
});
it("a double jump reaches a high ledge but a third midair press cannot recharge it", () => {
  const w = lab();
  install(w, "thruster");
  const c = idleControls();
  for (let i = 0; i < 3; i++) w.update(1 / 120, c);
  c.jump = true;
  c.jumpHeld = true;
  w.update(1 / 120, c);
  c.jump = false;
  for (let i = 0; i < 25; i++) w.update(1 / 120, c);
  c.jump = true;
  w.update(1 / 120, c);
  c.jump = false;
  let top = w.player.y;
  for (let i = 0; i < 65; i++) {
    w.update(1 / 120, c);
    top = Math.min(top, w.player.y);
  }
  expect(top).toBeLessThan(270);
  expect(w.rig!.telemetry.boosts).toBe(1);
  c.jump = true;
  w.update(1 / 120, c);
  expect(w.rig!.telemetry.boosts).toBe(1);
});
it("ram synergy removes the opposing shield and hits each enemy once per dash", () => {
  const w = lab();
  install(w, "thruster");
  install(w, "shield");
  const e = w.spawnEnemy("reclaimer", 385, 586, "shield");
  const c = idleControls();
  c.mx = 900;
  c.my = 586;
  c.dash = true;
  c.right = true;
  w.update(1 / 120, c);
  expect(e.has("shield")).toBe(false);
  expect(w.rig!.telemetry.ramHits).toBe(1);
  c.dash = false;
  for (let i = 0; i < 5; i++) w.update(1 / 120, c);
  expect(w.rig!.telemetry.ramHits).toBe(1);
});
it("implosion damages multiple enemies behind a shield after a delay", () => {
  const w = lab();
  install(w, "gun");
  install(w, "grapple");
  const a = w.spawnEnemy("reclaimer", 620, 586, "shield"),
    b = w.spawnEnemy("crawler", 700, 586, "gun");
  const p = new Projectile(650, 570, 0, 0, "player", 19);
  p.implosion = true;
  w.rig!.onProjectileHit(w, p);
  const hp = [a.hp, b.hp];
  const c = idleControls();
  w.rig!.update(w, 0.2, c);
  expect([a.hp, b.hp]).toEqual(hp);
  w.rig!.update(w, 0.2, c);
  expect(a.hp).toBeLessThan(hp[0]);
  expect(b.hp).toBeLessThan(hp[1]);
  expect(w.rig!.telemetry.implosions).toBe(1);
});
it("connected shield blocks enemy shots but lets allied shots leave the rig", () => {
  const w = lab();
  install(w, "shield");
  w.rig!.update(w, 0, idleControls());
  const s = w.rig!.modules[0];
  const e = w.spawnEnemy("crawler", 520, 586, "gun");
  w.projectiles.push(new Projectile(s.x - 30, s.y, 2000, 0, "player", 12));
  w.updateProjectiles(0.12);
  expect(e.hp).toBeLessThan(e.maxHp);
  w.projectiles.push(new Projectile(s.x + 30, s.y, -2000, 0, "enemy", 12));
  w.updateProjectiles(0.03);
  expect(w.player.hp).toBe(100);
});
it("replacement leaves the previous physical organ and capacity never duplicates mounts", () => {
  const w = lab();
  const first = install(w, "gun");
  const newer = install(w, "gun");
  expect(w.rig!.modules).toHaveLength(1);
  expect(first.mounted).toBe(false);
  expect(first.dead).toBe(false);
  expect(newer.mounted).toBe(true);
  install(w, "thruster");
  install(w, "shield");
  w.rig!.select(0);
  const g = new EnemyModule("grapple", w.player.x + 10, 550);
  w.modules.push(g);
  expect(w.rig!.installNearest(w)).toBe(true);
  expect(w.rig!.modules).toHaveLength(3);
  expect(w.stableQueue.length).toBeLessThanOrEqual(3);
});
it("upgraded capacity supports both synergies and deploying removes only that organ's link", () => {
  const w = lab();
  w.phaseCapacity = 4;
  install(w, "thruster");
  install(w, "gun");
  install(w, "shield");
  const m = install(w, "grapple");
  expect(w.rig!.modules).toHaveLength(4);
  expect(w.rig!.combos).toHaveLength(2);
  w.rig!.select(3);
  expect(w.rig!.deploySelected(w)).toBe(true);
  expect(m.mounted).toBe(false);
  expect(m.stable).toBe(true);
  expect(w.stableQueue).toContain(m);
  expect(w.rig!.combos.map((c) => c.id)).toEqual(["ram"]);
  expect(w.rig!.installNearest(w)).toBe(true);
  expect(w.rig!.modules).toHaveLength(4);
  expect(w.rig!.combos).toHaveLength(2);
});
it("all connected organs travel as the same objects and are cleared on extraction", () => {
  const e = new Expedition();
  e.start(23);
  const w = e.world;
  install(w, "gun");
  install(w, "thruster");
  const organs = [...e.rig.modules];
  const portal=e.zone.portals.find(p=>p.id==="out")!;
  w.player.x = portal.x;
  w.player.y = portal.y;
  e.travelCooldown = 0;
  expect(e.travel("out")).toBe(true);
  expect(e.rig.modules).toEqual(organs);
  for (const m of organs) {
    expect(e.world.modules.filter((n) => n === m)).toHaveLength(1);
    expect(e.areas.get("airlock")!.world.modules).not.toContain(m);
  }
  e.finish("extracted");
  expect(e.rig.modules).toHaveLength(0);
  e.start(24);
  expect(e.rig.modules).toHaveLength(0);
});
