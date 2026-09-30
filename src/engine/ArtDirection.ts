import { drawWeapon } from "./WeaponArt";
import Phaser from "phaser";
import { PaintedAssets } from "./PaintedAssets";
import { facilityPlatform, facilityFixture, facilityAirlock } from "./FacilityArt";
import { SumpBackdrop } from "./SumpBackdrop";
import { PumpRoomArt } from "./PumpRoomArt";
import { HERO_ART_POSES, HERO_ART_SCALE, heroHandOffset } from "./HeroArtSpec";
import type { World } from "./World";
import type { Enemy } from "./Enemy";
import type { Rect } from "./PhysicsHelpers";
import "../styles/art-sample.css";

/** Presentation only. No collision, AI, input or combat state is changed here. */
export class ArtDirection {
  private painted: PaintedAssets;
  private refuge?: Phaser.GameObjects.Image;
  private refugeLoading = false;
  campBackdrop() {
    const key = "refuge-painted-v1";
    if (!this.refuge && this.scene.textures.exists(key))
      this.refuge = this.scene.add.image(0, 12, key).setOrigin(0).setDisplaySize(3240, 840).setDepth(-1);
    if (!this.refuge && !this.refugeLoading) {
      this.refugeLoading = true;
      const image = new Image();
      image.onload = () => {
        if (!this.disposed) this.scene.textures.addImage(key, image);
      };
      image.src = new URL("../assets/refuge-painted-v1.png", import.meta.url).href;
    }
    this.refuge?.setVisible(true);
    return !!this.refuge;
  }
  private sump: SumpBackdrop;
  private pumpRoom: PumpRoomArt;
  private hero?: Phaser.GameObjects.Image;
  private ghosts: Phaser.GameObjects.Image[] = [];
  private weapon: Phaser.GameObjects.Graphics;
  private disposed = false;
  private stride = 0;
  private lastHeroX: number | null = null;
  private source: HTMLImageElement | null = null;
  private key = "eclipse-hero-actions-v1-calibrated";
  get heroReady() {
    return !!this.hero;
  }
  constructor(private scene: Phaser.Scene) {
    this.painted = new PaintedAssets(scene);
    this.sump = new SumpBackdrop(scene);
    this.pumpRoom = new PumpRoomArt(scene);
    this.weapon = scene.add.graphics().setDepth(2);
    const setup = () => {
      if (this.disposed) return;
      this.hero = scene.add.image(0, 0, this.key, "pose-0").setDepth(1);
      this.ghosts = Array.from({ length: 8 }, () =>
        scene.add.image(0, 0, this.key, "pose-5").setDepth(0.5).setVisible(false),
      );
    };
    if (scene.textures.exists(this.key)) setup();
    else {
      const image = new Image();
      this.source = image;
      image.onload = () => {
        if (this.disposed) return;
        const texture = scene.textures.addImage(this.key, image)!;
        HERO_ART_POSES.forEach(({ rect }, i) => {
          texture.add(`pose-${i}`, 0, rect[0], rect[1], rect[2], rect[3]);
        });
        setup();
      };
      image.onerror = () => console.warn("Hero art unavailable; keeping the vector fallback.");
      image.src = new URL("../assets/hero-actions-v1.png", import.meta.url).href;
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.disposed = true;
      if (this.source) this.source.onload = this.source.onerror = null;
    });
  }

  background(g: Phaser.GameObjects.Graphics, w: World) {
    this.pumpRoom.draw(w);
    this.refuge?.setVisible(false);
    this.painted.begin(new Set(w.enemies.filter((e) => !e.dead).map((e) => e.id)));
    if (this.sump.draw(g, w)) return;
    const cam = this.scene.cameras.main,
      sx = cam.scrollX,
      sy = cam.scrollY;
    g.fillStyle(0x141820);
    g.fillRect(0, 0, w.width, w.height);
    // Distant repeating shafts move more slowly than the playable structure.
    const farX = Math.floor((sx * 0.24) / 320) * 320 + sx * 0.76;
    const farY = Math.floor((sy * 0.18) / 440) * 440 + sy * 0.82;
    for (let i = -2; i < 6; i++)
      for (let j = -2; j < 4; j++) {
        const x = farX + i * 320,
          y = farY + j * 440;
        g.fillStyle(0x202630);
        g.fillRect(x + 14, y + 18, 272, 404);
        g.fillStyle(0x292f3a);
        g.fillRect(x + 42, y + 42, 212, 330);
        g.fillStyle(0x232934);
        g.fillTriangle(x + 42, y + 42, x + 254, y + 42, x + 254, y + 260);
        g.fillStyle(0x151b24);
        g.fillRect(x + 104, y + 86, 60, 260);
        g.lineStyle(9, 0x303641);
        g.lineBetween(x + 210, y + 45, x + 210, y + 362);
        g.lineStyle(2, 0x3e444d);
        g.lineBetween(x + 206, y + 45, x + 206, y + 362);
        g.lineStyle(4, 0x1b212a);
        g.lineBetween(x + 34, y + 285, x + 262, y + 140);
        g.fillStyle(0x3d3f42);
        g.fillRect(x + 75, y + 100, 7, 26);
        g.fillStyle(0x7b6e52, 0.35);
        g.fillRect(x + 76, y + 104, 3, 18);
      }
    // World-anchored structural ribs, mechanical panels and inset service lights.
    const startX = Math.floor(sx / 480) * 480;
    const startY = Math.floor(sy / 420) * 420;
    for (let x = startX - 480; x < sx + 1760; x += 480) {
      g.fillStyle(0x0f141c);
      g.fillRect(x + 72, sy - 80, 34, 940);
      g.fillStyle(0x39414a);
      g.fillRect(x + 77, sy - 80, 3, 940);
      g.fillStyle(0x252c34);
      g.fillRect(x + 90, sy - 80, 9, 940);
      for (let y = startY - 420; y < sy + 1140; y += 420) {
        g.fillStyle(0x10151d);
        g.fillRect(x + 68, y + 160, 44, 13);
        g.fillStyle(0x0f141c);
        g.fillRect(x + 132, y + 128, 192, 86);
        g.fillStyle(0x252e39);
        g.fillRect(x + 136, y + 132, 184, 78);
        g.lineStyle(1, 0x434951);
        g.strokeRect(x + 144, y + 140, 168, 62);
        for (let k = 0; k < 4; k++) {
          g.fillStyle(0x121b26);
          g.fillRect(x + 157, y + 151 + k * 10, 84, 4);
        }
        g.fillStyle(0x625b48);
        g.fillRect(x + 263, y + 151, 30, 31);
        g.fillStyle(0xd5b879, 0.6);
        g.fillRect(x + 269, y + 157, 18, 3);
        g.fillStyle(0xf0cc8a, 0.035);
        g.fillTriangle(x + 150, y + 50, x + 286, y + 50, x + 330, y + 180);
        g.fillStyle(0x090f17);
        g.fillRoundedRect(x + 143, y + 44, 146, 12, 3);
        g.fillStyle(0xa18e69);
        g.fillRect(x + 151, y + 49, 130, 3);
      }
    }
    if (w.height > 720) {
      // Recessed central elevator spine is decoration, never a fake platform.
      for (const x of [1460, 1588]) {
        g.fillStyle(0x0d131c);
        g.fillRect(x, 480, 13, 2640);
        g.fillStyle(0x626873);
        g.fillRect(x + 3, 480, 2, 2640);
        for (let y = Math.max(480, startY - 80); y < Math.min(3120, sy + 840); y += 80) {
          g.fillStyle(0x333d48);
          g.fillRect(x - 3, y, 19, 8);
          g.fillStyle(0xbc8d53, 0.55);
          g.fillRect(x + 7, y + 2, 5, 3);
        }
      }
      // Geometric alien deposits contrast with industrial directionality.
      for (const [x, y] of [
        [2140, 2780],
        [2590, 2440],
        [2150, 2050],
        [2510, 1480],
      ]) {
        g.lineStyle(2, 0x696385, 0.45);
        g.strokeCircle(x, y, 44);
        g.strokeCircle(x, y, 31);
        for (let k = 0; k < 5; k++) {
          const a = (k * Math.PI * 2) / 5;
          const ex = x + Math.cos(a) * 85,
            ey = y + Math.sin(a) * 85;
          g.lineBetween(x + Math.cos(a) * 44, y + Math.sin(a) * 44, ex, ey);
          g.fillStyle(0x414254);
          g.fillTriangle(ex - 9, ey + 7, ex + 12, ey, ex - 2, ey - 14);
        }
        g.fillStyle(0x8c85b0, 0.4);
        g.fillCircle(x, y, 4);
      }
    }
  }

  platform(g: Phaser.GameObjects.Graphics, r: Rect) {
    const cam = this.scene.cameras.main;
    if (r.y - r.h / 2 > cam.scrollY + cam.height / cam.zoom + 80 || r.y + r.h / 2 < cam.scrollY - 80) return;
    facilityPlatform(g, r);
  }

  enemy(g: Phaser.GameObjects.Graphics, e: Enemy, time: number, playerX: number) {
    if (this.painted.enemy(e, time, playerX)) return;
    const r = e.w / 2,
      active = e.windup > 0,
      flash = e.flash > 0;
    if (e.kind === "floater" || e.kind === "elite") {
      const spin = time * (active ? 1.5 : 0.35) + e.id,
        core = active ? 0xf9a0b6 : 0xa8a0ed;
      g.fillStyle(0x0f1420);
      g.fillCircle(e.x, e.y, r * 0.83);
      g.lineStyle(4, flash ? 0xffffff : 0x979cae);
      g.strokeCircle(e.x, e.y, r * 0.78);
      g.lineStyle(1.5, core, 0.85);
      g.strokeCircle(e.x, e.y, r * 0.52);
      for (let i = 0; i < 5; i++) {
        const a = spin + (i * Math.PI * 2) / 5;
        const x = e.x + Math.cos(a) * r,
          y = e.y + Math.sin(a) * r;
        g.fillStyle(flash ? 0xffffff : i % 2 ? 0xc0c5cf : 0x747e95);
        g.fillTriangle(
          x + Math.cos(a) * 14,
          y + Math.sin(a) * 14,
          x + Math.cos(a + 1.3) * 12,
          y + Math.sin(a + 1.3) * 12,
          x + Math.cos(a - 1.3) * 12,
          y + Math.sin(a - 1.3) * 12,
        );
        const tx = e.x + Math.cos(a + 0.25) * (r + 22),
          ty = e.y + Math.sin(a + 0.25) * (r + 22);
        g.lineStyle(1, 0x8890b5, 0.8);
        g.lineBetween(x, y, tx, ty);
        g.fillStyle(0x5e6782);
        g.fillTriangle(tx - 4, ty + 5, tx + 6, ty, tx, ty - 6);
        g.fillStyle(core);
        g.fillCircle(tx, ty, 1.5);
      }
      g.fillStyle(core, 0.12);
      g.fillCircle(e.x, e.y, active ? 17 : 11);
      g.fillStyle(core);
      g.fillCircle(e.x, e.y, active ? 6 : 4);
      g.lineStyle(1, 0xdfdcff);
      g.strokeCircle(e.x, e.y, 8);
    } else {
      const face = playerX > e.x ? 1 : -1;
      const step = Math.sin(time * 15 + e.id) * Math.min(5, Math.abs(e.vx) / 28);
      for (const side of [-1, 1]) {
        const hip = e.x + side * r * 0.65,
          knee = hip + side * 7;
        const foot = hip + side * 8 + step * side;
        g.lineStyle(8, 0x111722);
        g.lineBetween(hip, e.y + 2, knee, e.y + 12);
        g.lineBetween(knee, e.y + 12, foot, e.y + e.h / 2 - 4);
        g.lineStyle(3, 0x78818b);
        g.lineBetween(hip, e.y + 2, knee, e.y + 12);
        g.fillStyle(0x252d38);
        g.fillRoundedRect(foot - 8, e.y + e.h / 2 - 6, 16, 6, 2);
        g.fillStyle(0xafb5bb);
        g.fillCircle(hip, e.y + 3, 3);
      }
      g.fillStyle(0x111720);
      g.fillRoundedRect(e.x - r - 3, e.y - 17, e.w + 6, 29, 5);
      g.fillStyle(flash ? 0xffffff : e.kind === "reclaimer" ? 0x9e8261 : 0xb19b6b);
      g.fillRoundedRect(e.x - r, e.y - 16, e.w, 24, 3);
      g.fillStyle(0x5b554b);
      g.fillRect(e.x - r, e.y + 2, e.w, 6);
      g.fillStyle(0x303944);
      g.fillRect(e.x - 8, e.y - 19, 17, 27);
      for (let i = 0; i < 3; i++) {
        g.fillStyle(0x141d28);
        g.fillRect(e.x - 5, e.y - 13 + i * 6, 11, 3);
      }
      g.fillStyle(0x161d27);
      g.fillRoundedRect(e.x + face * 11 - 7, e.y - 24, 14, 12, 2);
      g.fillStyle(active ? 0xffb5a2 : 0xe5797c);
      g.fillRect(e.x + face * 12 - 3, e.y - 21, 6, 4);
      g.lineStyle(8, 0x141b25);
      g.lineBetween(e.x + face * 13, e.y - 8, e.x + face * (r + 14), e.y - 8);
      g.lineStyle(3, 0x7e8792);
      g.lineBetween(e.x + face * 13, e.y - 10, e.x + face * (r + 13), e.y - 10);
      g.fillStyle(0xd9c28d);
      g.fillRect(e.x - r + 5, e.y - 12, 5, 8);
      g.lineStyle(2, 0x373a40);
      g.lineBetween(e.x - r + 14, e.y - 13, e.x - r + 20, e.y - 4);
    }
  }

  fixture(g: Phaser.GameObjects.Graphics, x: number, y: number, kind: string, done: boolean) {
    facilityFixture(g, x, y, kind, done);
  }

  airlock(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    facilityAirlock(g, x, y);
  }

  drawHero(w: World) {
    const h = this.hero,
      g = this.weapon,
      p = w.player;
    g.clear();
    if (!h) return false;
    const extra = w as World & { slamming?: boolean; armory?: { primary: string } };
    const moving = Math.abs(p.vx) > 35;
    const travelled = this.lastHeroX === null ? 0 : Math.abs(p.x - this.lastHeroX);
    this.lastHeroX = p.x;
    if (moving && travelled < 80 && p.dashTime <= 0) this.stride += travelled;
    const onFoot = p.grounded || (p.coyote > 0 && Math.abs(p.vy) < 30);
    const pose = extra.slamming
      ? 6
      : p.dashTime > 0
        ? 5
        : !onFoot
          ? p.vy < -80
            ? 3
            : 4
          : p.squash > 0.06
            ? 7
            : moving
              ? 1 + (Math.floor(this.stride / 27) % 2)
              : 0;
    const anchors = HERO_ART_POSES.map(({ rect, pivot }) => [pivot[0] / rect[2], pivot[1] / rect[3]]);
    const direction = moving ? p.moveFacing : p.facing;
    const anchor = anchors[pose];
    h.setTexture(this.key, `pose-${pose}`)
      .setOrigin(direction < 0 ? 1 - anchor[0] : anchor[0], anchor[1])
      .setPosition(p.x, p.y + p.h / 2)
      .setScale(HERO_ART_SCALE * (1 + p.squash * 0.35), HERO_ART_SCALE * (1 - p.squash * 0.4))
      .setRotation(0)
      .setFlipX(direction < 0);
    h.setAlpha(p.invulnerable > 0 && Math.floor(w.time * 22) % 2 === 0 ? 0.55 : 1);
    this.ghosts.forEach((ghost, i) => {
      const t = p.trails[i];
      ghost.setVisible(!!t);
      if (t)
        ghost
          .setOrigin(p.moveFacing < 0 ? 1 - anchors[5][0] : anchors[5][0], anchors[5][1])
          .setPosition(t.x, t.y + p.h / 2)
          .setScale(HERO_ART_SCALE)
          .setFlipX(p.moveFacing < 0)
          .setTint(0xeaa4ba)
          .setAlpha((t.life / 0.18) * 0.28);
    });
    // Art-only aim rig: separate gun follows aim without flipping the locomotion pose.
    g.save();
    const hand = heroHandOffset(pose, direction, p.squash);
    g.translateCanvas(p.x + hand.x - Math.cos(p.aim) * 10, p.y + p.h / 2 + hand.y - Math.sin(p.aim) * 10);
    g.rotateCanvas(p.aim);
    const primary = extra.armory?.primary ?? "handgun";
    g.lineStyle(4, 0xeee1df);
    g.lineBetween(10, 3, 14, 0);
    if (!this.painted.weapon(primary, p.x + hand.x, p.y + p.h / 2 + hand.y, p.aim))
      drawWeapon(g, primary, w.time, p.fireCooldown > 0);
    g.restore();
    return true;
  }
}
