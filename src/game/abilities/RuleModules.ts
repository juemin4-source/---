import type { RuleAbilities } from "./RuleAbilities";
import type { SliceWorld, Carrier } from "../SliceWorld";
import type { AbilityEvent } from "./AbilityEvents";
/** Organ listeners modify shared events; they do not select or branch on weapon ids. */
export function registerRuleModules(r: RuleAbilities) {
  const w = r.w;
  let lastTarget: Carrier | null = null;
  let pulled = false;
  const count = (id: Parameters<SliceWorld["count"]>[0]) => w.count(id);
  r.events.on("AttackCreated", (e) => {
    if (
      (!r.mirror && !r.volleyMirror) ||
      !count("mirrorEye") ||
      e.tags.has("Copy") ||
      e.tags.has("Child") ||
      e.tags.has("Summon")
    )
      return;
    const m = r.volleyMirror ?? r.mirror!;
    r.mirror = null;
    if (e.projectile)
      r.clone(e.projectile, m.x, m.y, Math.atan2(e.projectile.vy, e.projectile.vx), 0.65, true);
    else if (e.tags.has("Melee"))
      r.w.armory.melee(e.amount * 0.65, e.heavy ?? false, e.radius ?? 100, m, true);
  });
  r.events.on("ProjectileExpire", (e) => {
    if (e.projectile && count("returnMembrane")) r.returnShot(e.projectile);
  });
  const split = (e: AbilityEvent) => {
    const b = e.projectile,
      m = b && r.shots.get(b);
    if (!b || !m || m.split || !count("split") || m.generation >= Math.min(4, 1 + count("split"))) return;
    m.split = true;
    const angle = Math.atan2(b.vy, b.vx) + (e.type === "WallHit" ? Math.PI : 0);
    for (const offset of [-0.48, 0.48]) r.clone(b, e.x, e.y, angle + offset, 0.45, false);
  };
  r.events.on("ProjectileHit", split);
  r.events.on("WallHit", split);
  r.events.on("Dash", (e) => {
    if (count("mirrorEye")) r.mirror = { x: e.x, y: e.y, life: 1.2 + 0.2 * (count("mirrorEye") - 1) };
  });
  r.events.on("BeforeDamage", (e) => {
    if (!e.target) return;
    if (count("debt") || (e.heavy && r.debts.has(e.target))) {
      const debt = r.debts.get(e.target) ?? 0;
      if (e.heavy) {
        e.amount += debt;
        r.debts.delete(e.target);
      } else {
        const part = e.amount * Math.min(0.7, 0.3 + 0.05 * count("debt"));
        r.debts.set(e.target, debt + part);
        e.amount -= part;
      }
    }
    if (count("stitch")) {
      if (lastTarget && lastTarget !== e.target && !lastTarget.dead) {
        r.stitches.push({ a: lastTarget, b: e.target, life: 5 + count("stitch") });
        r.stitches = r.stitches.slice(-8);
      }
      lastTarget = e.target;
    }
  });
  r.events.on("Push", (e) => {
    if (!e.target || !e.amount) return;
    if (count("polarity")) {
      pulled = !pulled;
      if (!pulled) e.amount *= -1 - 0.1 * count("polarity");
    }
    for (const s of r.stitches) {
      const other = s.a === e.target ? s.b : s.b === e.target ? s.a : null;
      if (other && !other.dead)
        other.impulseX = Math.max(-1800, Math.min(1800, other.impulseX - e.amount * 0.65));
    }
  });
  r.events.on("Kill", (e) => {
    if (count("corpse")) {
      r.corpses.push({ x: e.x, y: e.y, life: 3 + count("corpse"), clock: 0 });
      r.corpses = r.corpses.slice(-12);
    }
  });
  r.events.on("ShieldBreak", (e) => {
    if (count("shell")) {
      const b = r.spawn(
        e.x,
        e.y,
        w.player.aim,
        Math.min(100, 15 + e.amount) * count("shell"),
        true,
        "shell",
        0,
      );
      if (b) {
        b.life = 1.5;
        r.w.armory.shots.get(b)!.piercing = true;
      }
    }
  });
}
