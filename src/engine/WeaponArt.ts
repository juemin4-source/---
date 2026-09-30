import type Phaser from "phaser";

/** Local hand coordinates; silhouettes remain legible at the gameplay camera scale. */
export function drawWeapon(g: Phaser.GameObjects.Graphics, id: string, time: number, firing: boolean) {
  const dark = 0x18232e,
    steel = 0x9fb4bd,
    red = 0xc6657c,
    cyan = 0x90dcdf;
  const block = (x: number, y: number, w: number, h: number, color = steel) => {
    g.fillStyle(dark);
    g.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 2);
    g.fillStyle(color);
    g.fillRoundedRect(x, y, w, h, 1);
  };
  block(12, 1, 6, 10, dark);
  if (id === "dagger" || id === "rift") {
    block(9, -2, 12, 5, dark);
    block(20, -7, 3, 14, red);
    g.fillStyle(id === "rift" ? 0xbdaae8 : steel);
    g.fillTriangle(23, -5, id === "rift" ? 53 : 43, -2, 25, 5);
    g.lineStyle(1, 0xecf5ef);
    g.lineBetween(24, -4, id === "rift" ? 51 : 41, -2);
  } else if (id === "hammer") {
    block(10, -2, 28, 5, dark);
    block(32, -17, 16, 34);
    block(30, -14, 5, 28, red);
    block(43, -12, 6, 24, dark);
  } else if (id === "blade") {
    block(12, -5, 15, 10, dark);
    g.lineStyle(6, steel);
    g.beginPath();
    g.arc(31, 0, 14, -1.9, 1.9);
    g.strokePath();
    g.lineStyle(2, cyan);
    g.beginPath();
    g.arc(31, 0, 17, -1.6, 1.6);
    g.strokePath();
  } else if (id === "gravity") {
    block(10, -7, 21, 14, dark);
    g.lineStyle(4, steel);
    g.beginPath();
    g.arc(32, 0, 11, 0.55, Math.PI * 2 - 0.55);
    g.strokePath();
    g.fillStyle(0xb4a4e8, firing ? 0.7 : 0.3);
    g.fillCircle(32, 0, firing ? 7 + Math.sin(time * 9) : 5);
    g.fillStyle(cyan);
    g.fillCircle(32, 0, 3);
  } else if (id === "harpoon") {
    block(10, -6, 27, 12, dark);
    block(17, -7, 20, 3);
    g.lineStyle(3, steel);
    g.lineBetween(25, 0, 54, 0);
    g.fillStyle(steel);
    g.fillTriangle(55, 0, 44, -6, 44, 6);
    g.lineStyle(2, red);
    g.strokeCircle(21, 6, 7);
  } else if (id === "nail") {
    block(10, -8, 25, 15);
    block(27, -5, 18, 3, dark);
    block(27, 3, 18, 3, dark);
    block(15, 5, 11, 10, dark);
    block(13, -6, 7, 3, cyan);
    g.lineStyle(2, cyan, 0.8);
    g.lineBetween(33, -2, 40, 2);
  } else if (id === "recoil") {
    block(9, -8, 24, 16, dark);
    block(22, -7, 22, 6);
    block(22, 1, 22, 6);
    block(20, 7, 16, 4, red);
    block(41, -9, 6, 18, dark);
    g.fillStyle(0xe2bf83);
    g.fillCircle(18, 0, 4);
  } else {
    const length = id === "sniper" ? 45 : id === "rifle" ? 34 : 21;
    block(10, -5, length, 10, dark);
    block(12, -5, length - 4, 3);
    block(16, -1, 8, 3, red);
    if (id === "sniper") {
      block(21, -11, 16, 5, dark);
      block(38, -2, 21, 3);
    }
    if (id === "rifle") {
      block(25, 5, 7, 12, dark);
      block(39, -3, 8, 6);
    }
  }
}
