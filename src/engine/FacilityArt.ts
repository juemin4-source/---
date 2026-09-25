import type Phaser from "phaser";
import type { Rect } from "./PhysicsHelpers";
type Graphics = Phaser.GameObjects.Graphics;

/** Shared industrial materials; geometry here is decorative only. */
export function facilityPlatform(g: Graphics, r: Rect) {
  const x = r.x - r.w / 2,
    y = r.y - r.h / 2;
  const h = Math.min(22, r.h);
  g.fillStyle(0x0a1520);
  g.fillRect(x, y, r.w, r.h);
  g.fillStyle(0x314657);
  g.fillRect(x, y + 3, r.w, Math.max(0, h - 3));
  g.fillStyle(0x9cabb0);
  g.fillRect(x, y, r.w, Math.min(2, h));
  g.fillStyle(0x576d77);
  g.fillRect(x, y + 2, r.w, Math.min(3, Math.max(0, h - 2)));
  g.fillStyle(0x142633);
  g.fillRect(x, y + h - 4, r.w, 4);
  if (r.w < 65 || h < 12) return;
  // Large recessed panels instead of a luminous stripe on every small segment.
  for (let xx = x + 18; xx < x + r.w - 25; xx += 112) {
    const width = Math.min(82, x + r.w - xx - 14);
    g.fillStyle(0x152a39);
    g.fillRect(xx, y + 7, width, h - 12);
    g.lineStyle(1, 0x435c6b);
    g.lineBetween(xx, y + h - 5, xx + width, y + h - 5);
    g.fillStyle(0x839399);
    g.fillCircle(xx - 7, y + 10, 1.4);
  }
  for (const end of [x + 4, x + r.w - 18]) {
    g.fillStyle(0xc1a16b);
    g.fillRect(end, y + 5, 12, 3);
    g.fillStyle(0x172533);
    g.fillTriangle(end + 2, y + 5, end + 6, y + 5, end + 4, y + 8);
  }
}

export function facilityFixture(g: Graphics, x: number, y: number, kind: string, done: boolean) {
  const medical = kind === "medical",
    lift = kind === "lift";
  const w = medical ? 38 : lift ? 30 : 46;
  const top = lift ? -29 : -20;
  const light = done ? 0x576775 : medical ? 0x9edbc6 : lift ? 0xa8d2e7 : 0xe4bd80;
  g.fillStyle(0x07121c);
  g.fillRoundedRect(x - w / 2 - 3, y + top - 3, w + 6, 26 - top, 4);
  g.fillStyle(0x3c5262);
  g.fillRoundedRect(x - w / 2, y + top, w, 20 - top, 3);
  g.fillStyle(0x71858d);
  g.fillRect(x - w / 2 + 3, y + top, w - 6, 2);
  g.fillStyle(0x172c3b);
  g.fillRect(x - w / 2 + 5, y + top + 6, w - 10, 10 - top);
  if (medical) {
    g.fillStyle(0x334e58);
    g.fillRect(x - 10, y - 13, 20, 25);
    g.fillStyle(light);
    g.fillRect(x - 2, y - 8, 4, 14);
    g.fillRect(x - 7, y - 3, 14, 4);
    g.fillStyle(0x91a2a8);
    g.fillRect(x + 13, y - 3, 2, 9);
    if (done) {
      g.fillStyle(0x0c1c28);
      g.fillRect(x - 11, y + 9, 22, 3);
    }
  } else if (lift) {
    g.fillStyle(0x0a1d29);
    g.fillRect(x - 9, y - 21, 18, 17);
    g.fillStyle(light);
    g.fillTriangle(x - 5, y - 11, x + 5, y - 11, x, y - 17);
    g.fillRect(x - 1, y - 11, 2, 4);
    g.fillCircle(x - 4, y + 5, 2);
    g.fillCircle(x + 4, y + 5, 2);
  } else {
    g.fillStyle(done ? 0x081722 : 0x536a76);
    g.fillRect(x - 18, y - 17, 36, 10);
    if (done) {
      g.lineStyle(4, 0x647c87);
      g.lineBetween(x - 19, y - 20, x + 16, y - 28);
    }
    g.fillStyle(light);
    g.fillRect(x - 4, y - 5, 8, 9);
    g.fillStyle(0x192e3d);
    g.fillRect(x - 1, y - 3, 2, 5);
  }
  g.fillStyle(light);
  g.fillRect(x - w / 2 + 3, y + 15, w - 6, 2);
  g.fillStyle(0x09151f);
  g.fillRect(x - w / 2 + 3, y + 20, 8, 3);
  g.fillRect(x + w / 2 - 11, y + 20, 8, 3);
}

export function facilityAirlock(g: Graphics, x: number, y: number) {
  // Chamfered pressure bulkhead, two layered leaves and mechanical locking wheel.
  g.fillStyle(0x08131e);
  g.fillRoundedRect(x - 18, y - 24, 196, 124, 10);
  g.fillStyle(0x445b68);
  g.fillRoundedRect(x - 10, y - 16, 180, 116, 8);
  g.fillStyle(0x8a9696);
  g.fillRect(x + 3, y - 15, 154, 3);
  g.fillStyle(0x172c3a);
  g.fillRect(x, y, 160, 100);
  for (const dx of [8, 84]) {
    g.fillStyle(0x354c5b);
    g.fillRect(x + dx, y + 6, 68, 90);
    g.fillStyle(0x4e6570);
    g.fillTriangle(x + dx, y + 6, x + dx + 68, y + 6, x + dx, y + 60);
    g.lineStyle(2, 0x71858a);
    g.lineBetween(x + dx + 3, y + 7, x + dx + 3, y + 92);
    g.fillStyle(0x112432);
    g.fillRoundedRect(x + dx + 17, y + 18, 32, 24, 4);
    g.fillStyle(0x6e827e);
    g.fillRect(x + dx + 20, y + 21, 26, 3);
    g.fillStyle(0x253c49);
    g.fillRect(x + dx + 12, y + 66, 44, 16);
  }
  g.lineStyle(4, 0x0b1c28);
  g.lineBetween(x + 80, y + 5, x + 80, y + 100);
  g.lineStyle(3, 0x9aa6a4);
  g.strokeCircle(x + 80, y + 58, 12);
  g.lineBetween(x + 68, y + 58, x + 92, y + 58);
  g.lineBetween(x + 80, y + 46, x + 80, y + 70);
  g.fillStyle(0x172c39);
  g.fillRect(x + 48, y - 24, 64, 14);
  g.fillStyle(0xe4bf86);
  g.fillRect(x + 53, y - 20, 54, 5);
  g.fillStyle(0x0a1b27);
  g.fillRoundedRect(x + 173, y + 35, 20, 38, 3);
  g.fillStyle(0x9edbc6);
  g.fillRect(x + 177, y + 40, 12, 12);
  g.fillStyle(0x163e3b);
  g.fillTriangle(x + 179, y + 46, x + 186, y + 42, x + 186, y + 50);
  for (const xx of [x - 9, x + 160])
    for (const yy of [y + 8, y + 83]) {
      g.fillStyle(0xc0a474);
      g.fillRect(xx, yy, 8, 12);
      g.lineStyle(2, 0x263743);
      g.lineBetween(xx, yy + 8, xx + 8, yy + 2);
    }
}
