export const W = 1280,
  H = 720,
  GRAVITY = 1650;
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  oneWay?: boolean;
}
export class Body implements Rect {
  boundsWidth = W;
  platformDrop = false;
  vx = 0;
  vy = 0;
  grounded = false;
  mass = 1;
  constructor(
    public x: number,
    public y: number,
    public w: number,
    public h: number,
  ) {}
}
export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export const overlaps = (a: Rect, b: Rect) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
  Math.abs(a.y - b.y) < (a.h + b.h) / 2;
export function integrate(
  b: Body,
  dt: number,
  platforms: Rect[],
  gravity = GRAVITY,
) {
  const previousBottom = b.y + b.h / 2;
  b.grounded = false;
  b.vy = clamp(b.vy + gravity * dt, -1200, 1100);
  b.x += b.vx * dt;
  for (const p of platforms)
    if (!p.oneWay && overlaps(b, p)) {
      b.x = p.x + (Math.sign(b.vx || b.x - p.x) * -(p.w + b.w)) / 2;
      b.vx = 0;
    }
  b.y += b.vy * dt;
  for (const p of platforms)
    if (
      overlaps(b, p) &&
      (!p.oneWay ||
        (!b.platformDrop && b.vy >= 0 && previousBottom <= p.y - p.h / 2 + 2))
    ) {
      if (b.vy >= 0) {
        b.y = p.y - (p.h + b.h) / 2;
        b.grounded = true;
      } else b.y = p.y + (p.h + b.h) / 2;
      b.vy = 0;
    }
  b.x = clamp(b.x, b.w / 2 + 12, b.boundsWidth - b.w / 2 - 12);
  if (b.y < b.h / 2 + 12) {
    b.y = b.h / 2 + 12;
    b.vy = Math.max(0, b.vy);
  }
}
// Swept segment versus an expanded AABB: fast projectiles cannot tunnel through thin shields.
export function rayRect(
  x: number,
  y: number,
  dx: number,
  dy: number,
  r: Rect,
  pad = 0,
): number | null {
  let lo = 0,
    hi = 1;
  for (const [p, d, c, s] of [
    [x, dx, r.x, r.w / 2 + pad],
    [y, dy, r.y, r.h / 2 + pad],
  ]) {
    if (Math.abs(d) < 1e-8) {
      if (p < c - s || p > c + s) return null;
    } else {
      let a = (c - s - p) / d,
        b = (c + s - p) / d;
      if (a > b) [a, b] = [b, a];
      lo = Math.max(lo, a);
      hi = Math.min(hi, b);
      if (lo > hi) return null;
    }
  }
  return lo;
}
