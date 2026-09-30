import type Phaser from "phaser";

/** Authored background landmarks, behind collision geometry. No decorative walkable edges. */
export function expeditionScenery(
  g: Phaser.GameObjects.Graphics,
  sx: number,
  sy: number,
  width: number,
  height: number,
) {
  const rooms = [
    { x: 1000, y: 1390, w: 520, h: 290, kind: "archive" },
    { x: 3600, y: 1400, w: 900, h: 270, kind: "pump" },
    { x: 5640, y: 1120, w: 780, h: 260, kind: "rig" },
  ];
  for (const r of rooms) {
    if (r.x + r.w < sx || r.x > sx + width || r.y + r.h < sy || r.y > sy + height) continue;
    g.fillStyle(0x102330, 0.88);
    g.fillRoundedRect(r.x, r.y, r.w, r.h, 8);
    g.lineStyle(7, 0x263d48);
    g.strokeRect(r.x + 12, r.y + 12, r.w - 24, r.h - 24);
    if (r.kind === "pump") {
      for (const offset of [190, 530]) {
        g.fillStyle(0x1e3742);
        g.fillCircle(r.x + offset, r.y + 137, 89);
        g.lineStyle(9, 0x36515a);
        g.strokeCircle(r.x + offset, r.y + 137, 72);
        g.lineStyle(5, 0x4a6368, 0.6);
        g.strokeCircle(r.x + offset, r.y + 137, 55);
        g.fillStyle(0x102832);
        g.fillCircle(r.x + offset, r.y + 137, 28);
        g.lineStyle(18, 0x29444e);
        g.lineBetween(r.x + offset, r.y + 210, r.x + offset, r.y + r.h);
      }
    } else if (r.kind === "archive") {
      for (const offset of [48, 170, 292, 414]) {
        g.fillStyle(0x273c44);
        g.fillRect(r.x + offset, r.y + 38, 66, 222);
        g.fillStyle(0x112a35);
        g.fillRect(r.x + offset + 8, r.y + 48, 50, 194);
        g.lineStyle(2, 0x42565a);
        for (const yy of [89, 143, 197])
          g.lineBetween(r.x + offset + 8, r.y + yy, r.x + offset + 58, r.y + yy);
      }
    } else {
      g.lineStyle(9, 0x314a53);
      g.lineBetween(r.x + 40, r.y + 20, r.x + r.w - 40, r.y + 20);
      for (const offset of [130, 570]) {
        g.lineStyle(3, 0x3e5860);
        g.lineBetween(r.x + offset, r.y + 25, r.x + offset, r.y + 155);
        g.lineStyle(8, 0x354e57);
        g.beginPath();
        g.arc(r.x + offset + 10, r.y + 165, 16, 0, Math.PI);
        g.strokePath();
      }
    }
    // One light source per landmark, broad low contrast wash rather than particle noise.
    g.fillStyle(0xe4bd84, 0.045);
    g.fillTriangle(r.x + 40, r.y + 20, r.x + 180, r.y + 20, r.x + 340, r.y + r.h);
    g.fillStyle(0xcab68f, 0.65);
    g.fillRect(r.x + 40, r.y + 18, 140, 3);
  }
}
