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
    // The parallax image is a backdrop for any large scrollable map, not just the 0.9 tower: it is
    // overscanned and positioned from the camera, so it works at any world size. Only the small
    // fixed-size arena/zone maps opt out.
    const bigMap = w.width >= 2000 && w.height >= 2000;
    const active = bigMap && !!this.image;
    // Tower-only props are authored against the tower's exact geometry, so they must not be drawn
    // on the expedition map where those coordinates mean nothing.
    const tower = w.width === 3000 && w.height === 3300;
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
    for (const x of tower ? [620, 1415, 1660, 2445] : []) {
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
    for (const [x, y, width] of tower
      ? ([
          [660, 2870, 420],
          [1880, 2700, 440],
        ] as const)
      : []) {
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
      if (
        !tower ||
        p.y < 2400 ||
        p.y > 3100 ||
        p.w < 100 ||
        p.h > 45 ||
        Math.abs(p.y - (sy + viewH / 2)) > viewH
      )
        continue;
      const pier = [634, 1429, 1674, 2459].reduce((best, x) =>
        Math.abs(x - p.x) < Math.abs(best - p.x) ? x : best,
      );
      const edge = p.x + (pier > p.x ? p.w / 2 - 12 : -p.w / 2 + 12);
      const top = p.y + p.h / 2;
      g.lineStyle(7, 0x1b3040);
      g.lineBetween(edge, top, pier, top + 78);
      g.lineStyle(2, 0x4b6471);
      g.lineBetween(edge, top + 2, pier, top + 80);
      g.fillStyle(0x101f2d);
      g.fillRect(pier - 18, top + 66, 36, 20);
      g.fillStyle(0x677e88);
      g.fillCircle(pier, top + 76, 3);
    }

    // Warm airlock pool and the tower's own sump waterline: tower-authored coordinates.
    if (tower) {
      g.fillStyle(0xe8b47a, 0.045);
      g.fillEllipse(900, 3080, 520, 250);
      g.fillStyle(0xe8b47a, 0.06);
      g.fillEllipse(900, 3075, 300, 180);
      // Ground below the actual 3120 walkway becomes a dark sump, not a second fake floor.
      g.fillStyle(0x08121e);
      g.fillRect(0, 3140, w.width, 160);
    }
    if (tower)
      for (let k = 0; k < 18; k++) {
        const x = 650 + k * 115 + Math.sin(w.time * 0.45 + k) * 5;
        g.lineStyle(1, k < 3 ? 0x9e815c : 0x486b81, 0.24);
        g.lineBetween(x, 3160 + (k % 4) * 15, x + 38 + (k % 3) * 16, 3160 + (k % 4) * 15);
      }
    // Foreground is world anchored and confined outside the traversable entrance.
    const fg = this.foreground;
    // Reflections sit on top of the solid floor's dark fascia, below all landing edges.
    if (tower) {
      for (let k = 0; k < 14; k++) {
        const x = 650 + k * 120 + Math.sin(w.time * 0.45 + k) * 4;
        fg.lineStyle(1, k < 3 ? 0xb29665 : 0x58788a, 0.22);
        fg.lineBetween(x, 3158 + (k % 3) * 17, x + 30 + (k % 4) * 12, 3158 + (k % 3) * 17);
      }
      for (const x of [270, 2750]) {
        const alpha = Math.abs(w.player.x - (x + 27)) < 95 && w.player.y > 2720 ? 0.12 : 1;
        fg.fillStyle(0x070e18, alpha);
        fg.fillRect(x, 2780, 54, 520);
        fg.fillStyle(0x1b2b37, alpha);
        fg.fillRect(x + 6, 2780, 5, 520);
        for (const y of [2840, 2990, 3200]) {
          fg.fillStyle(0x060c13, alpha);
          fg.fillRect(x - 8, y, 70, 20);
        }
      }
    }
    return true;
  }
}
