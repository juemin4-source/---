import { enemyBands } from "./CombatBalance";
import { Body, clamp, distance, integrate, overlaps } from "./PhysicsHelpers";
import type { World } from "./World";
import type { EnemyModule } from "./EnemyModule";
import { Projectile } from "./Projectile";

export function updateModules(w: World, dt: number) {
  for (const m of w.modules) {
    if (m.dead) continue;
    m.flash = Math.max(0, m.flash - dt);
    m.cooldown -= dt;
    m.active = Math.max(0, m.active - dt);
    if (m.mounted) continue;
    if (m.parent) {
      m.follow();
      continue;
    }
    if (m.held) {
      const a = w.player.aim;
      m.x = w.player.x + Math.cos(a) * 57;
      m.y = w.player.y + Math.sin(a) * 45;
      m.vx = 0;
      m.vy = 0;
    } else {
      m.vx *= Math.exp(-(m.kind === "shield" ? 0.9 : 4) * dt);
      integrate(m, dt, w.platforms);
      if (!m.stable && m.kind !== "shield")
        m.angle += Math.sin(w.time * 4 + m.id) * dt * 0.9;
    }
    if (m.dormant) continue;
    if (m.kind === "gun") gun(w, m);
    if (m.kind === "thruster") thruster(w, m, dt);
    if (m.kind === "grapple") grapple(w, m, dt);
  }
  const loose = w.modules.filter(
    (m) => !m.dead && !m.parent && !m.held && !m.mounted,
  );
  for (let i = 0; i < loose.length; i++)
    for (let j = i + 1; j < loose.length; j++) {
      const a = loose[i],
        b = loose[j];
      if (!overlaps(a, b)) continue;
      const dx = (a.w + b.w) / 2 - Math.abs(a.x - b.x),
        dy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
      if (dx < dy) {
        const sign = Math.sign(b.x - a.x) || 1;
        a.x -= (sign * dx * b.mass) / (a.mass + b.mass);
        b.x += (sign * dx * a.mass) / (a.mass + b.mass);
        const momentum = (a.vx * a.mass + b.vx * b.mass) / (a.mass + b.mass);
        a.vx = momentum;
        b.vx = momentum;
      } else {
        const upper = a.y < b.y ? a : b,
          lower = upper === a ? b : a;
        upper.y = lower.y - (upper.h + lower.h) / 2;
        upper.vy = Math.min(0, upper.vy);
        upper.grounded = true;
      }
    }
  for (const m of loose) {
    if (m.kind !== "shield") {
      if (overlaps(m, w.player)) {
        m.vx += Math.sign(m.x - w.player.x) * 200 * dt;
        if (m.kind === "thruster" && !m.stable && Math.abs(m.vx) > 150)
          w.hurtPlayer(5, m.x);
      }
      continue;
    }
    if (overlaps(w.player, m)) {
      const s = Math.sign(w.player.x - m.x) || -1;
      if (
        w.player.y + w.player.h / 2 < m.y - m.h / 2 + 18 &&
        w.player.vy >= 0
      ) {
        w.player.y = m.y - (m.h + w.player.h) / 2;
        w.player.vy = 0;
        w.player.grounded = true;
      } else {
        m.vx -= s * 180 * dt;
        w.player.x = m.x + (s * (m.w + w.player.w)) / 2;
      }
    }
    for (const e of w.enemies)
      if (!e.dead && overlaps(e, m)) {
        const speed = Math.abs(m.vx),
          s = Math.sign(e.x - m.x) || 1;
        e.x = m.x + (s * (m.w + e.w)) / 2;
        e.impulseX += m.vx * 0.5;
        if (speed > 160 && e.ramCooldown <= 0) {
          e.ramCooldown = 0.35;
          w.damageEnemy(e, Math.min(100, speed * 0.15), m.vx * 0.6);
          w.emit("ram", m.x, m.y, 0x8dc7ed);
          w.stats.rams++;
        }
      }
  }
}
export function gun(w: World, m: EnemyModule) {
  if (m.cooldown > 0) return;
  const target = m.parent
    ? w.player
    : m.stable
      ? w.enemies
          .filter((e) => !e.dead && distance(m, e) < 850)
          .sort((a, b) => distance(m, a) - distance(m, b))[0]
      : null;
  if (m.stable && !target) {
    m.cooldown = 0.15;
    return;
  }
  const band = m.parent && m.parent.tier >= 0 ? enemyBands[m.parent.tier] : null;
  m.cooldown = m.parent ? (band?.shotInterval ?? 1.5) : m.stable ? 0.42 : 0.65 + Math.random() * 1.05;
  const a = target ? Math.atan2(target.y - m.y, target.x - m.x) : m.angle;
  m.targetX = m.x + Math.cos(a) * 60;
  m.targetY = m.y + Math.sin(a) * 60;
  m.active = 0.1;
  w.projectiles.push(
    new Projectile(
      m.x + Math.cos(a) * 27,
      m.y + Math.sin(a) * 27,
      Math.cos(a) * (m.stable ? 680 : band?.shotSpeed ?? 370),
      Math.sin(a) * (m.stable ? 680 : band?.shotSpeed ?? 370),
      m.parent ? "enemy" : m.stable ? "player" : "wild",
      m.stable ? 19 : 10,
      m.parent?.id ?? -m.id,
    ),
  );
  w.emit(
    "shot",
    m.x + Math.cos(a) * 27,
    m.y + Math.sin(a) * 27,
    m.stable ? 0x9df5cf : 0xff7284,
    a,
  );
}
function thruster(w: World, m: EnemyModule, dt: number) {
  if (!m.stable && m.cooldown <= 0) {
    m.cooldown = 0.7 + Math.random();
    m.active = 0.35;
    m.angle += (Math.random() - 0.5) * 1.5;
    m.vx -= Math.cos(m.angle) * 155;
    m.vy -= Math.sin(m.angle) * 80;
  }
  if (!m.stable && m.active <= 0) return;
  const dx = Math.cos(m.angle),
    dy = Math.sin(m.angle);
  const targets: Body[] = [
    // A carried jet cannot push its carrier: otherwise aiming down makes a
    // self-following elevator. Place the module to ride its physical jet.
    ...(!m.held ? [w.player] : []),
    ...w.enemies.filter((e) => !e.dead),
    ...w.modules.filter(
      (n) => n !== m && !n.dead && !n.parent && !n.held && !n.mounted,
    ),
  ];
  for (const b of targets) {
    const x = b.x - m.x,
      y = b.y - m.y,
      along = x * dx + y * dy,
      across = Math.abs(x * dy - y * dx);
    if (along < 0 || along > 250 || across > 32 + Math.min(b.w, b.h) / 2)
      continue;
    const force = 4200 / Math.sqrt(b.mass);
    if (b === w.player) {
      w.player.externalX += dx * force * dt * 8;
      if (dy < -0.4) {
        w.player.vy = Math.min(w.player.vy, -930);
        w.stats.boosted = true;
      } else w.player.vy += dy * force * dt;
    } else {
      b.vx = clamp(b.vx + dx * force * dt, -900, 900);
      b.vy = clamp(b.vy + dy * force * dt, -1000, 1000);
      if ("impulseX" in b)
        (b as { impulseX: number }).impulseX += dx * force * dt;
    }
  }
}
export function grapple(w: World, m: EnemyModule, dt: number) {
  if (!m.stable && !m.parent && m.cooldown <= 0) {
    m.cooldown = 1.6;
    m.active = 0.75;
  }
  if (!m.stable && !m.parent && m.active <= 0) return;
  let targets: Body[];
  if (m.parent) {
    const loose = w.modules.filter(
      (n) =>
        !n.dead && !n.parent && !n.held && !n.mounted && distance(m, n) < 420,
    );
    targets = loose.length ? loose : [w.player];
  } else
    targets = [
      ...w.modules.filter(
        (n) => n !== m && !n.dead && !n.parent && !n.held && !n.mounted,
      ),
      ...w.enemies.filter((e) => !e.dead),
      ...(!m.stable ? [w.player] : []),
    ];
  targets = targets.filter(
    (b) => distance(m, b) > 48 && distance(m, b) < (m.parent ? 420 : 340),
  );
  if (m.stable) {
    const dx = Math.cos(m.angle),
      dy = Math.sin(m.angle);
    targets = targets.filter(
      (b) => ((b.x - m.x) * dx + (b.y - m.y) * dy) / distance(m, b) > 0.4,
    );
  }
  const target = targets.sort((a, b) => distance(m, a) - distance(m, b))[0];
  if (!target) return;
  const d = distance(m, target),
    fx = (((m.x - target.x) / d) * 1900) / Math.sqrt(target.mass),
    fy = (((m.y - target.y) / d) * 1900) / Math.sqrt(target.mass);
  if (target === w.player) {
    w.player.externalX += fx * dt * 6;
    w.player.vy += fy * dt;
  } else {
    target.vx = clamp(target.vx + fx * dt, -700, 700);
    target.vy += fy * dt;
    if ("impulseX" in target)
      (target as { impulseX: number }).impulseX += fx * dt;
  }
  m.targetX = target.x;
  m.targetY = target.y;
  m.active = 0.05;
}
