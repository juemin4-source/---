import Phaser from "phaser";
import type { World } from "./World";

/** Background-only scenery. All walkable edges still come from World.platforms. */
export class SumpBackdrop {
  private image?: Phaser.GameObjects.Image;
  private foreground: Phaser.GameObjects.Graphics;
  private source?: HTMLImageElement;
  private disposed = false;
  constructor(private scene: Phaser.Scene) {
    this.foreground = scene.add.graphics().setDepth(4);
    const key = "sump-depth-v1";
    const ready = () => {
      if (!this.disposed) this.image = scene.add.image(0, 0, key).setOrigin(0).setDepth(-3).setVisible(false);
    };
    if (scene.textures.exists(key)) ready();
    else {
      const source = (this.source = new Image());
      source.onload = () => {
        if (!this.disposed) {
          scene.textures.addImage(key, source);
          ready();
        }
      };
      source.onerror = () => console.warn("Sump background unavailable; using procedural fallback.");
      source.src = new URL("../assets/sump-depth-v1.png", import.meta.url).href;
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.disposed = true;
      if (this.source) this.source.onload = this.source.onerror = null;
    });
  }

  draw(g: Phaser.GameObjects.Graphics, w: World) {
    const cam = this.scene.cameras.main,
      sx = cam.scrollX,
      sy = cam.scrollY;
    const active = w.height === 3300 && w.width === 3000 && !!this.image;
    this.image?.setVisible(active);
    this.foreground.clear();
    if (!active) return false;
    // Overscan is larger than the maximum parallax travel: no tiling or exposed edges.
    const viewW = cam.width / cam.zoom,
      viewH = cam.height / cam.zoom;
    const scale = Math.max((viewW + 320) / this.image!.width, (viewH + 190) / this.image!.height);
    this.image!.setScale(scale)
      .setPosition(sx - 50 - sx * 0.12, sy - 30 - sy * 0.045)
      .setTint(0xa4b2c4);
    g.fillStyle(0x101a29, 0.22);
    g.fillRect(sx, sy, viewW, viewH);

    // Near service piers: larger, darker and differently spaced from the distant architecture.
    for (const x of [620, 1415, 1660, 2445]) {
      g.fillStyle(0x0e1b29, 0.88);
      g.fillRect(x, 400, 28, 2740);
      g.fillStyle(0x425466, 0.75);
      g.fillRect(x + 2, 400, 3, 2740);
      g.fillStyle(0x1f3041);
      g.fillRect(x + 15, 400, 7, 2740);
      for (
        let y = Math.max(480, Math.floor(sy / 220) * 220);
        y < Math.min(3140, sy + viewH + 220);
        y += 220
      ) {
        g.fillStyle(0x0a1420);
        g.fillRect(x - 5, y, 38, 14);
        g.fillStyle(0x5e6e76);
        g.fillRect(x - 2, y + 2, 31, 2);
      }
    }
    // Recessed pump station at the entrance; quiet centre is reserved for combat.
    for (const [x, y, width] of [
      [660, 2870, 420],
      [1880, 2700, 440],
    ]) {
      g.fillStyle(0x0d1c2a, 0.86);
      g.fillRoundedRect(x, y, width, 230, 8);
      g.lineStyle(5, 0x263e50);
      g.strokeRect(x + 12, y + 12, width - 24, 208);
      for (let k = 0; k < 3; k++) {
        g.fillStyle(0x233748);
        g.fillRoundedRect(x + 38 + k * 112, y + 50, 75, 146, 15);
        g.lineStyle(4, 0x415968);
        g.lineBetween(x + 75 + k * 112, y + 58, x + 75 + k * 112, y + 182);
        g.fillStyle(0x152431);
        g.fillRect(x + 40 + k * 112, y + 112, 71, 12);
      }
      g.fillStyle(0xcba671, 0.12);
      g.fillTriangle(x + 70, y + 25, x + 200, y + 25, x + 285, y + 215);
      g.fillStyle(0xd6b47d);
      g.fillRect(x + 65, y + 24, 140, 3);
    }
    // Support actual platforms rather than inventing decorative ledges players cannot use.
    for (const p of w.platforms) {
      if (p.y < 2400 || p.y > 3100 || p.w < 100 || p.h > 45 || Math.abs(p.y - (sy + viewH / 2)) > viewH)
        continue;
      g.lineStyle(6, 0x263c4b);
      const left = p.x - p.w / 2;
      g.lineBetween(left + 12, p.y, left + 48, p.y + 68);
      g.lineBetween(left + p.w - 12, p.y, left + p.w - 48, p.y + 68);
      g.lineStyle(1, 0x52616b);
      g.lineBetween(left + 12, p.y + 4, left + 48, p.y + 70);
    }
    // Warm airlock pool has a real source at the existing door, not a full-screen wash.
    g.fillStyle(0xe8b47a, 0.045);
    g.fillEllipse(900, 3080, 520, 250);
    g.fillStyle(0xe8b47a, 0.06);
    g.fillEllipse(900, 3075, 300, 180);
    // Ground below the actual 3120 walkway becomes a dark sump, not a second fake floor.
    g.fillStyle(0x08121e);
    g.fillRect(0, 3140, w.width, 160);
    for (let k = 0; k < 18; k++) {
      const x = 650 + k * 115 + Math.sin(w.time * 0.45 + k) * 5;
      g.lineStyle(1, k < 3 ? 0x9e815c : 0x486b81, 0.24);
      g.lineBetween(x, 3160 + (k % 4) * 15, x + 38 + (k % 3) * 16, 3160 + (k % 4) * 15);
    }
    // Foreground is world anchored and confined outside the traversable entrance.
    const fg = this.foreground;
    for (const x of [270, 2750]) {
      fg.fillStyle(0x070e18);
      fg.fillRect(x, 2780, 54, 520);
      fg.fillStyle(0x1b2b37);
      fg.fillRect(x + 6, 2780, 5, 520);
      for (const y of [2840, 2990, 3200]) {
        fg.fillStyle(0x060c13);
        fg.fillRect(x - 8, y, 70, 20);
      }
    }
    return true;
  }
}
