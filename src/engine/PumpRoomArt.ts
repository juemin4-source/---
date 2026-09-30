import Phaser from "phaser";
import type { World } from "./World";

/** One authored art sample: recessed wall and collision-aligned material, never new geometry. */
export class PumpRoomArt {
  private wall?: Phaser.GameObjects.Image;
  private surfaces: Phaser.GameObjects.TileSprite[] = [];
  private disposed = false;
  private geometry?: World["platforms"];
  private maskShape: Phaser.GameObjects.Graphics;
  private mask: Phaser.Display.Masks.GeometryMask;

  constructor(private scene: Phaser.Scene) {
    this.maskShape = scene.make.graphics({ x: 0, y: 0 });
    this.maskShape.fillStyle(0xffffff).fillRect(3300, 1388, 1600, 292);
    this.mask = this.maskShape.createGeometryMask();
    this.load("pump-wall-clean-v1", new URL("../assets/pump-wall-clean-v1.png", import.meta.url).href);
    this.load("industrial-fascia-v1", new URL("../assets/industrial-fascia-v1.png", import.meta.url).href);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.disposed = true;
      this.mask.destroy();
      this.maskShape.destroy();
    });
  }

  private load(key: string, url: string) {
    if (this.scene.textures.exists(key)) return;
    const image = new Image();
    image.onload = () => {
      if (!this.disposed && !this.scene.textures.exists(key)) this.scene.textures.addImage(key, image);
    };
    image.onerror = () => console.warn(`Room art unavailable: ${key}; keeping existing scenery.`);
    image.src = url;
  }

  draw(w: World) {
    const active = w.width === 6800 && w.height === 2500;
    const cam = this.scene.cameras.main;
    const visible =
      active &&
      cam.worldView.right > 3300 &&
      cam.worldView.left < 4900 &&
      cam.worldView.bottom > 1360 &&
      cam.worldView.top < 1740;
    if (!this.wall && this.scene.textures.exists("pump-wall-clean-v1")) {
      this.wall = this.scene.add
        .image(4100, 1534, "pump-wall-clean-v1")
        .setDepth(-2.5)
        .setDisplaySize(1720, 1720 / 3)
        .setMask(this.mask);
    }
    this.wall?.setVisible(visible);
    if (visible && this.wall) {
      // Only the recessed wall drifts. The aperture and every landing remain world-anchored.
      const dx = Phaser.Math.Clamp((cam.worldView.centerX - 4100) * 0.025, -35, 35);
      this.wall.setPosition(4100 + dx, 1534);
    }
    if (active && this.geometry !== w.platforms && this.scene.textures.exists("industrial-fascia-v1")) {
      this.surfaces.forEach((s) => s.destroy());
      this.surfaces = [];
      this.geometry = w.platforms;
      for (const p of w.platforms) {
        const left = Math.max(3300, p.x - p.w / 2);
        const right = Math.min(4900, p.x + p.w / 2);
        const top = Math.max(1360, p.y - p.h / 2);
        const bottom = Math.min(1740, p.y + p.h / 2);
        if (right <= left || bottom <= top) continue;
        const sprite = this.scene.add
          .tileSprite(left, top, right - left, bottom - top, "industrial-fascia-v1")
          .setOrigin(0)
          .setDepth(0.05);
        // Native material scale, never stretch one whole beam over a long bridge.
        sprite.setTileScale(0.16, Math.min(0.16, (bottom - top) / 724));
        sprite.setTint(p.oneWay ? 0xc5ced3 : 0x89959f);
        this.surfaces.push(sprite);
      }
    }
    this.surfaces.forEach((s) => s.setVisible(visible));
  }
}
