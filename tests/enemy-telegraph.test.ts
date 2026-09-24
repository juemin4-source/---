import { describe, expect, it } from "vitest";
import { World } from "../src/engine/World";
import { updateEnemies } from "../src/engine/EnemySystems";
import { idleControls } from "../src/engine/Player";

const dt = 1 / 120;
function encounter(exploration = true) {
  const w = new World();
  w.salvageOnKill = exploration;
  w.enemies = [];
  w.modules = [];
  w.platforms = w.platforms.slice(0, 1);
  w.player.x = 400;
  w.player.y = 586;
  const enemy = w.spawnEnemy("crawler", 600, 586, "thruster");
  enemy.grounded = true;
  enemy.cooldown = 0;
  return { w, enemy };
}

describe("exploration enemy telegraphs", () => {
  it("gives a nearby player time to leave the announced charge lane", () => {
    const { w, enemy } = encounter();
    w.player.x = 560;
    const controls = idleControls();
    w.update(dt, controls);
    expect(enemy.windup).toBe(0.5);
    expect(enemy.charge).toBe(0);

    controls.left = true;
    for (let i = 0; i < 54; i++) w.update(dt, controls);
    expect(enemy.windup).toBeGreaterThan(0);
    expect(enemy.x).toBeCloseTo(600);
    expect(enemy.x - w.player.x).toBeGreaterThan(150);
    expect(w.player.hp).toBe(100);
  });

  it("commits to the warning direction when the player crosses behind it", () => {
    const { w, enemy } = encounter();
    updateEnemies(w, dt);
    expect(enemy.chargeDirection).toBe(-1);
    w.player.x = 800;
    for (let i = 0; i < 61; i++) updateEnemies(w, dt);
    expect(enemy.charge).toBeGreaterThan(0);
    expect(enemy.x).toBeLessThan(600);
    expect(enemy.vx).toBeLessThan(0);
    updateEnemies(w, dt);
    expect(enemy.vx).toBeLessThan(0);
    expect(enemy.chargeDirection).toBe(-1);
  });

  it("cancels a pending charge when propulsion is detached or the enemy dies", () => {
    const { w, enemy } = encounter();
    updateEnemies(w, dt);
    enemy.modules.find((m) => m.kind === "thruster")!.detach();
    for (let i = 0; i < 70; i++) updateEnemies(w, dt);
    expect(enemy.windup).toBe(0);
    expect(enemy.charge).toBe(0);

    const dead = w.spawnEnemy("crawler", 900, 586, "thruster");
    dead.windup = 0.4;
    dead.charge = 0.2;
    dead.dead = true;
    updateEnemies(w, dt);
    expect(dead.windup).toBe(0);
    expect(dead.charge).toBe(0);
  });

  it("stun cancels attacks while gravity, knockback and another enemy continue", () => {
    const { w } = encounter();
    w.enemies = [];
    w.modules = [];
    const stunned = w.spawnEnemy("elite", 600, 300);
    const other = w.spawnEnemy("crawler", 250, 350, "gun");
    for (const m of w.modules) m.cooldown = 0;
    w.player.x = 600;
    w.player.y = 300;
    stunned.stun = 0.9;
    stunned.windup = 0.3;
    stunned.charge = 0.3;
    stunned.impulseX = 120;
    updateEnemies(w, 0.1);

    expect(stunned.stun).toBeCloseTo(0.8);
    expect(stunned.windup).toBe(0);
    expect(stunned.charge).toBe(0);
    expect(stunned.x).toBeGreaterThan(600);
    expect(stunned.y).toBeGreaterThan(300);
    expect(stunned.impulseX).toBeGreaterThan(0);
    expect(stunned.impulseX).toBeLessThan(120);
    expect(w.projectiles.some((p) => p.owner === stunned.id)).toBe(false);
    expect(w.projectiles.some((p) => p.owner === other.id)).toBe(true);
    expect(w.player.hp).toBe(100);
    expect(w.player.externalX).toBe(0);
    expect(w.player.vy).toBe(0);
    for (const m of stunned.modules) expect(m.x).toBeCloseTo(stunned.x + m.ox);
  });

  it("resumes contact damage and organ fire after stun expires", () => {
    const { w } = encounter();
    w.enemies = [];
    w.modules = [];
    const enemy = w.spawnEnemy("crawler", 600, 586, "gun");
    enemy.stun = 0.2;
    enemy.cooldown = 2;
    enemy.modules[0].cooldown = 0;
    w.player.x = 600;
    for (let i = 0; i < 24; i++) updateEnemies(w, dt);
    expect(w.player.hp).toBe(100);
    expect(w.projectiles).toHaveLength(0);
    for (let i = 0; i < 2; i++) updateEnemies(w, dt);
    expect(enemy.stun).toBe(0);
    expect(w.player.hp).toBeLessThan(100);
    expect(w.projectiles.some((p) => p.owner === enemy.id)).toBe(true);
  });

  it("keeps immediate, tracking charges in the original combat mode", () => {
    const { w, enemy } = encounter(false);
    updateEnemies(w, dt);
    expect(enemy.windup).toBe(0);
    expect(enemy.charge).toBeGreaterThan(0);
    expect(enemy.vy).toBeLessThan(0);
    w.player.x = 800;
    updateEnemies(w, dt);
    expect(enemy.vx).toBeGreaterThan(0);
  });
});
