import { enemyBands } from "./CombatBalance";
import { clamp, distance, integrate, overlaps } from "./PhysicsHelpers";
import type { World } from "./World";
import { gun, grapple } from "./ModuleSystems";
export function updateEnemies(w: World, dt: number) {
  for (const e of w.enemies) {
    if (e.dead) {
      if (w.salvageOnKill) {
        e.windup = 0;
        e.charge = 0;
      }
      continue;
    }
    if (w.salvageOnKill && distance(e, w.player) > 1100) continue;
    e.flash = Math.max(0, e.flash - dt);
    e.cooldown -= dt;
    e.ramCooldown -= dt;
    e.impulseX *= Math.exp(-4 * dt);
    if (w.salvageOnKill && e.stun > 0) {
      e.stun = Math.max(0, e.stun - dt);
      e.windup = 0;
      e.charge = 0;
      e.vx = e.impulseX;
      integrate(e, dt, w.platforms, e.kind === "floater" ? 480 : 1650);
      for (const m of e.modules) if (m.parent === e && !m.dead) m.follow();
      continue;
    }
    if (w.salvageOnKill && !e.has("thruster")) {
      e.windup = 0;
      e.charge = 0;
    }
    const speedScale = e.tier >= 0 ? enemyBands[e.tier].speed : 1;
    const p = w.player,
      dir = Math.sign(p.x - e.x),
      d = distance(p, e);
    if (e.kind === "floater" && e.has("thruster")) {
      e.vx = dir * (Math.abs(p.x - e.x) > 290 ? 65 : -22) * speedScale + e.impulseX;
      e.vy = clamp((e.homeY + Math.sin(w.time * 1.7 + e.id) * 38 - e.y) * 3, -150, 150);
      integrate(e, dt, w.platforms, 0);
    } else {
      const speed =
        speedScale *
        (e.kind === "elite" ? 42 : e.kind === "reclaimer" ? 58 : e.kind === "floater" ? 22 : 105);
      if (w.salvageOnKill && e.windup > 0) {
        e.windup = Math.max(0, e.windup - dt);
        e.vx = e.impulseX;
        if (e.windup === 0) {
          e.charge = 0.36;
          e.vy = e.kind === "elite" ? -110 : -290;
          e.vx = e.chargeDirection * (speed + (e.kind === "elite" ? 370 : 260)) + e.impulseX;
        }
      } else {
        const moveDirection = w.salvageOnKill && e.charge > 0 ? e.chargeDirection : dir;
        e.vx = moveDirection * (d > 55 ? speed : 0) + e.impulseX;
        if (e.charge > 0) {
          e.charge -= dt;
          e.vx += moveDirection * (e.kind === "elite" ? 370 : 260);
        }
        if (e.cooldown <= 0 && d < 640 && e.grounded) {
          e.cooldown = e.kind === "elite" ? 3.8 : 2.3;
          if (e.has("thruster")) {
            if (w.salvageOnKill) {
              e.windup = 0.5;
              e.chargeDirection = dir || e.chargeDirection;
              e.vx = e.impulseX;
            } else {
              e.charge = 0.36;
              e.vy = e.kind === "elite" ? -110 : -290;
            }
          } else if (e.kind === "crawler") e.vy = -220;
        }
      }
      integrate(e, dt, w.platforms, e.kind === "floater" ? 480 : 1650);
    }
    for (const m of e.modules)
      if (m.parent === e && !m.dead) {
        m.follow();
        if (m.kind === "gun") gun(w, m);
        if (m.kind === "grapple") grapple(w, m, dt);
      }
    if (overlaps(p, e) && (!w.salvageOnKill || e.windup <= 0)) w.hurtPlayer(e.kind === "elite" ? 19 : 9, e.x);
  }
}
