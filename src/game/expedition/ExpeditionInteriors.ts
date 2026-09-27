import type { Rect } from "../../engine/PhysicsHelpers";
import { stationVoids } from "./PumpStationLayout";
const interiors = stationVoids;

/** Compile the authored empty spaces into solid building mass. This does not design or randomize rooms. */
export function enclosure(width: number, height: number, passages: Rect[]): Rect[] {
  const openings = [
    ...interiors.map(([l, t, r, b]) => ({ x: (l + r) / 2, y: (t + b) / 2, w: r - l, h: b - t })),
    ...passages,
  ];
  const ys = [
    ...new Set([
      0,
      height,
      ...openings.flatMap((r) => [Math.max(0, r.y - r.h / 2), Math.min(height, r.y + r.h / 2)]),
    ]),
  ].sort((a, b) => a - b);
  const solids: Rect[] = [];
  for (let i = 1; i < ys.length; i++) {
    const top = ys[i - 1],
      bottom = ys[i],
      mid = (top + bottom) / 2;
    const spans = openings
      .filter((r) => mid > r.y - r.h / 2 && mid < r.y + r.h / 2)
      .map((r) => [Math.max(16, r.x - r.w / 2), Math.min(width - 16, r.x + r.w / 2)])
      .sort((a, b) => a[0] - b[0]);
    let left = 0;
    for (const [a, b] of spans) {
      if (a > left) solids.push({ x: (left + a) / 2, y: mid, w: a - left, h: bottom - top });
      left = Math.max(left, b);
    }
    if (left < width) solids.push({ x: (left + width) / 2, y: mid, w: width - left, h: bottom - top });
  }
  // Merge vertical strips for stable collision and quiet wall rendering.
  const merged: Rect[] = [];
  for (const r of solids) {
    const above = merged.find(
      (a) => a.x === r.x && a.w === r.w && Math.abs(a.y + a.h / 2 - (r.y - r.h / 2)) < 0.01,
    );
    if (above) {
      const top = above.y - above.h / 2;
      above.h += r.h;
      above.y = top + above.h / 2;
    } else merged.push({ ...r });
  }
  return merged;
}
