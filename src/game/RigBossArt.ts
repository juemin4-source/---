import type { Renderer } from "../engine/Renderer";
import type { RigBoss } from "./RigBoss";

/** Flat painted metal, restrained emission, articulated silhouettes; no gameplay mutations. */
export function drawRigBoss(art: Renderer, boss: RigBoss) {
  const core = boss.core;
  if (!core || boss.phase === "dead") return;
  const g = art.g,
    x = core.x,
    y = core.y;
  const ink = 0x13242e,
    metal = 0x789598,
    light = 0xc2d2cb,
    shade = 0x3b5661;
  const exposed = boss.phase === "exposed",
    accent = exposed ? 0xffb86e : 0x83d8d4;
  const panel = (px: number, py: number, w: number, h: number, color: number) => {
    g.fillStyle(ink);
    g.fillRoundedRect(px - 2, py - 2, w + 4, h + 4, 4);
    g.fillStyle(color);
    g.fillRoundedRect(px, py, w, h, 3);
    g.fillStyle(light, 0.45);
    g.fillRect(px + 3, py + 2, w - 6, 2);
  };
  const joint = (px: number, py: number, radius: number) => {
    g.fillStyle(ink);
    g.fillCircle(px, py, radius + 3);
    g.fillStyle(metal);
    g.fillCircle(px, py, radius);
    g.fillStyle(shade);
    g.fillCircle(px, py, radius * 0.52);
    g.fillStyle(light);
    g.fillRect(px - 3, py - 2, 6, 4);
  };
  const arm = (ax: number, ay: number, bx: number, by: number, width: number) => {
    g.lineStyle(width + 5, ink);
    g.lineBetween(ax, ay, bx, by);
    g.lineStyle(width, shade);
    g.lineBetween(ax, ay, bx, by);
    g.lineStyle(3, light, 0.7);
    g.lineBetween(ax - 3, ay - 2, bx - 3, by - 2);
  };
  // Recessed twin rail and a compact load-bearing carriage.
  panel(5560, 1139, 930, 19, shade);
  g.lineStyle(2, light, 0.45);
  g.lineBetween(5560, 1154, 6490, 1154);
  for (let px = 5590; px < 6490; px += 110) {
    g.fillStyle(ink);
    g.fillRect(px, 1145, 30, 6);
  }
  panel(x - 45, 1134, 90, 31, metal);
  joint(x - 30, 1158, 9);
  joint(x + 30, 1158, 9);
  for (const side of [-1, 1]) {
    arm(x + side * 23, 1170, x + side * 23, y - 37, 7);
    const a = boss.anchors[side === -1 ? 0 : 1];
    if (!a) continue;
    const elbowX = x + side * 95,
      elbowY = y + 22;
    arm(x + side * 43, y + 8, elbowX, elbowY, 20);
    joint(elbowX, elbowY, 13);
    if (!a.dead) {
      arm(elbowX, elbowY, a.x, a.y - 19, 13);
      joint(a.x, a.y - 23, 11);
      panel(a.x - 20, a.y - 25, 40, 48, metal);
      panel(a.x - 27, a.y + 20, 54, 13, shade);
      g.fillStyle(boss.stable > 0 ? 0xf3bd75 : accent);
      g.fillRect(a.x - 4, a.y - 13, 8, 24);
      g.lineStyle(3, ink);
      for (let n = -1; n <= 1; n++) g.lineBetween(a.x + n * 12 - 4, a.y + 22, a.x + n * 12 + 3, a.y + 30);
      g.fillStyle(ink);
      g.fillRect(a.x - 25, a.y + 38, 50, 4);
      g.fillStyle(0xe9bc79);
      g.fillRect(a.x - 25, a.y + 38, (50 * a.hp) / a.maxHp, 4);
    } else {
      arm(elbowX, elbowY, elbowX + side * 12, elbowY + 27, 7);
      g.lineStyle(2, 0xdd9767);
      g.lineBetween(elbowX + side * 12, elbowY + 27, elbowX + side * 5, elbowY + 38);
      panel(a.x - 24, a.y + 23, 48, 9, shade);
    }
  }
  // Ceramic shell opens away from the warm reactor, revealing the damage target.
  panel(x - 54, y - 38, 108, 76, shade);
  g.fillStyle(ink);
  g.fillCircle(x, y, 34);
  g.lineStyle(4, accent, 0.9);
  g.strokeCircle(x, y, exposed ? 29 : 19);
  g.fillStyle(accent, 0.12);
  g.fillCircle(x, y, exposed ? 37 : 22);
  g.fillStyle(accent);
  g.fillCircle(x, y, exposed ? 19 : 10);
  g.fillStyle(0xfff0cc);
  g.fillCircle(x - 4, y - 5, exposed ? 7 : 3);
  for (const side of [-1, 1]) {
    const offset = exposed ? 47 : 31;
    panel(x + side * offset - 14, y - 34, 28, 68, metal);
    g.fillStyle(ink);
    g.fillRect(x + side * offset - 8, y + 16, 16, 4);
    g.fillRect(x + side * offset - 8, y + 24, 16, 3);
  }
  panel(x - 24, y - 45, 48, 12, light);
  art.label("rig-serial", x - 19, y - 42, "RIG / 09", "#263c46", 9);
  if (boss.phase === "moving") {
    g.lineStyle(2, 0xffc68a, 0.5);
    g.lineBetween(x, 1280, boss.moveTo, 1280);
    g.strokeCircle(boss.moveTo, 1280, 16);
  }
  const s = boss.sweep;
  if (s) {
    const targetX = s.left + s.width / 2,
      tipY = s.fired ? s.y : s.y - 100;
    arm(x, y + 30, targetX, tipY, 12);
    joint(targetX, tipY, 10);
    g.lineStyle(7, metal);
    g.lineBetween(targetX - 24, tipY + 4, targetX - 14, tipY + 28);
    g.lineBetween(targetX + 24, tipY + 4, targetX + 14, tipY + 28);
    g.fillStyle(0xff885e, s.fired ? 0.32 : 0.07);
    g.fillRect(s.left, s.y - 65, s.width, 130);
    g.lineStyle(s.fired ? 5 : 2, 0xffbd83, 0.9);
    g.strokeRect(s.left, s.y - 65, s.width, 130);
    const progress = s.fired ? 1 : Math.max(0, 1 - s.remaining / 1.35);
    g.fillStyle(0xffbd83);
    g.fillRect(s.left, s.y + 61, s.width * progress, 4);
  }
  art.label(
    "rig-title",
    x - 150,
    1173,
    `井架回收者 · ${exposed ? "核心暴露" : boss.phase === "moving" ? "轨道换位" : "拆解锚脚"}`,
    "#edcfaa",
    15,
  );
  g.fillStyle(ink);
  g.fillRect(x - 150, 1195, 300, 5);
  g.fillStyle(0xe9bd83);
  g.fillRect(x - 150, 1195, (300 * core.hp) / core.maxHp, 5);
}
