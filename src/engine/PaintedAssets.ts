import Phaser from "phaser";
import type { Enemy } from "./Enemy";

const originalFrames: Record<string, number[]> = {
  handgun: [410, 15, 440, 250],
  rifle: [250, 275, 750, 240],
  sniper: [65, 515, 1130, 240],
  dagger: [330, 760, 595, 145],
  hammer: [145, 900, 970, 325],
};
const weaponFrames: Record<string, number[]> = {
  recoil: [55, 60, 680, 230],
  nail: [840, 65, 635, 250],
  harpoon: [50, 385, 750, 250],
  blade: [900, 335, 540, 315],
  gravity: [75, 655, 565, 305],
  rift: [705, 725, 805, 180],
};
const enemyFrames: Record<string, number[]> = {
  crawler: [25, 150, 525, 295],
  sentinel: [565, 5, 405, 440],
  sniper: [990, 5, 540, 440],
  miner: [15, 570, 540, 335],
  floater: [600, 455, 410, 550],
  medic: [1060, 450, 440, 565],
};

export class PaintedAssets {
  private enemies = new Map<number, Phaser.GameObjects.Image>();
  private gun: Phaser.GameObjects.Image;
  private disposed = false;
  constructor(private scene: Phaser.Scene) {
    this.load(
      "painted-originals-v1",
      new URL("../assets/original-weapons-painted-v1.png", import.meta.url).href,
      originalFrames,
    );
    this.gun = scene.add.image(0, 0, "__WHITE").setDepth(2).setVisible(false);
    this.load(
      "painted-weapons-v1",
      new URL("../assets/mechanism-weapons-painted-v1.png", import.meta.url).href,
      weaponFrames,
    );
    this.load(
      "painted-enemies-v1",
      new URL("../assets/enemies-painted-alpha-v1.png", import.meta.url).href,
      enemyFrames,
    );
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.disposed = true;
      this.enemies.clear();
    });
  }
  private load(key: string, url: string, frames: Record<string, number[]>) {
    if (this.scene.textures.exists(key)) return;
    const source = new Image();
    source.onload = () => {
      if (this.disposed) return;
      const texture = this.scene.textures.addImage(key, source)!;
      for (const [name, [x, y, w, h]] of Object.entries(frames)) texture.add(name, 0, x, y, w, h);
    };
    source.src = url;
  }
  begin(alive: ReadonlySet<number>) {
    for (const [id, sprite] of this.enemies) {
      if (!alive.has(id)) {
        sprite.destroy();
        this.enemies.delete(id);
      } else sprite.setVisible(false);
    }
  }
  enemy(e: Enemy, time: number, playerX: number) {
    if (!this.scene.textures.exists("painted-enemies-v1")) return false;
    const role = (e as Enemy & { combatRole?: string }).combatRole;
    const frame = role && enemyFrames[role] ? role : e.kind === "floater" ? "floater" : "crawler";
    let sprite = this.enemies.get(e.id);
    if (!sprite) {
      sprite = this.scene.add.image(e.x, e.y, "painted-enemies-v1", frame).setDepth(0.3);
      this.enemies.set(e.id, sprite);
    }
    const floating = frame === "floater" || frame === "medic";
    const width = frame === "sniper" ? 94 : frame === "sentinel" ? 67 : floating ? 70 : 83;
    const [, , fw, fh] = enemyFrames[frame];
    const scale = (width / fw) * (e.kind === "elite" ? 1.5 : 1);
    sprite
      .setTexture("painted-enemies-v1", frame)
      .setVisible(true)
      .setOrigin(0.5, 1)
      .setPosition(e.x, e.y + e.h / 2 + (floating ? Math.sin(time * 2 + e.id) * 3 : 0))
      .setScale(scale)
      .setFlipX(!floating && playerX < e.x)
      .setRotation(floating ? Math.sin(time * 1.5 + e.id) * 0.035 : 0)
      .setTint(e.flash > 0 ? 0xffb5bf : 0xffffff);
    return true;
  }
  weapon(id: string, x: number, y: number, angle: number) {
    const rect = originalFrames[id] ?? weaponFrames[id];
    const key = originalFrames[id] ? "painted-originals-v1" : "painted-weapons-v1";
    const active = !!rect && this.scene.textures.exists(key);
    this.gun.setVisible(active);
    if (!active) return false;
    const width =
      id === "handgun"
        ? 35
        : id === "dagger"
          ? 40
          : id === "sniper" || id === "hammer"
            ? 72
            : id === "harpoon" || id === "rift"
              ? 65
              : id === "blade"
                ? 49
                : 56;
    this.gun
      .setTexture(key, id)
      .setOrigin(0.18, 0.58)
      .setPosition(x, y)
      .setScale(width / rect[2])
      .setRotation(angle)
      .setFlipY(Math.cos(angle) < 0);
    return true;
  }
}
