import Phaser from "phaser";
import { SumpBackdrop } from "./SumpBackdrop";
import { HERO_ART_POSES, HERO_ART_SCALE, heroHandOffset } from "./HeroArtSpec";
import type { World } from "./World";
import type { Enemy } from "./Enemy";
import type { Rect } from "./PhysicsHelpers";
import "../styles/art-sample.css";

/** Presentation only. No collision, AI, input or combat state is changed here. */
export class ArtDirection {
  private sump: SumpBackdrop;
  private hero?: Phaser.GameObjects.Image;
  private ghosts: Phaser.GameObjects.Image[] = [];
  private weapon: Phaser.GameObjects.Graphics;
  private disposed = false;
  private source: HTMLImageElement | null = null;
  private key = "eclipse-hero-actions-v1-calibrated";
  get heroReady() {
    return !!this.hero;
  }
  constructor(private scene: Phaser.Scene) {
    this.sump = new SumpBackdrop(scene);
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
    const x = r.x - r.w / 2,
      y = r.y - r.h / 2;
    const cam = this.scene.cameras.main;
    if (y > cam.scrollY + 820 || y + r.h < cam.scrollY - 100) return;
    g.fillStyle(0x111822);
    g.fillRect(x, y, r.w, r.h);
    g.fillStyle(0x3b4148);
    g.fillRect(x, y + 3, r.w, Math.min(r.h - 3, 13));
    g.fillStyle(0x878b8c);
    g.fillRect(x, y, r.w, 3);
    g.fillStyle(0x242a32);
    g.fillRect(x, y + Math.min(16, r.h - 3), r.w, 3);
    const h = Math.min(r.h, 24);
    g.lineStyle(1, 0x555b62);
    g.strokeRect(x, y, r.w, h);
    for (let xx = x + 18; xx < x + r.w - 12; xx += 84) {
      g.fillStyle(0x121821);
      g.fillRect(xx, y + 7, 46, Math.min(7, h - 8));
      g.fillStyle(0xa68c53);
      g.fillRect(xx + 3, y + 8, 11, 3);
      g.fillStyle(0x6b7076);
      g.fillCircle(xx - 7, y + 9, 1.5);
    }
    if (r.w > 95 && r.h < 45)
      for (const xx of [x + 15, x + r.w - 15]) {
        g.fillStyle(0x202833);
        g.fillTriangle(xx, y + r.h, xx + (xx < r.x ? 26 : -26), y + r.h, xx, y + r.h + 26);
        g.lineStyle(1, 0x4c555f);
        g.lineBetween(xx, y + r.h + 2, xx, y + r.h + 22);
      }
  }

  enemy(g: Phaser.GameObjects.Graphics, e: Enemy, time: number, playerX: number) {
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
    const light = done ? 0x526477 : kind === "medical" ? 0x8fcec0 : kind === "lift" ? 0x9bc4e8 : 0xe9b97b;
    const width = kind === "medical" ? 34 : 42;
    g.fillStyle(0x10151e);
    g.fillRoundedRect(x - width / 2 - 3, y - 16, width + 6, 39, 4);
    g.fillStyle(0x454c58);
    g.fillRoundedRect(x - width / 2, y - 13, width, 33, 3);
    g.fillStyle(0x242c39);
    g.fillRect(x - width / 2 + 5, y - 8, width - 10, 23);
    g.lineStyle(1, 0x7e858e);
    g.lineBetween(x - width / 2 + 3, y - 12, x + width / 2 - 3, y - 12);
    g.fillStyle(light);
    g.fillRect(x - width / 2 + 2, y - 5, 3, 17);
    g.fillRect(x + width / 2 - 5, y - 5, 3, 17);
    if (kind === "medical") {
      g.fillRect(x - 2, y - 6, 4, 13);
      g.fillRect(x - 6, y - 2, 12, 4);
    } else if (kind === "lift") {
      g.fillTriangle(x - 6, y + 1, x + 6, y + 1, x, y - 7);
      g.fillRect(x - 1, y, 2, 8);
    } else {
      g.fillStyle(done ? 0x151b25 : 0x303845);
      g.fillRect(x - 13, y - 16 - (done ? 7 : 0), 26, 7);
      g.fillStyle(light);
      g.fillRect(x - 4, y - 1, 8, 6);
    }
    g.fillStyle(0x0b1119);
    g.fillRect(x - width / 2 + 3, y + 20, width - 6, 3);
  }

  airlock(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x0a1018);
    g.fillRect(x - 10, y - 12, 180, 112);
    g.fillStyle(0x4e5660);
    g.fillRect(x, y, 160, 100);
    g.fillStyle(0x232c37);
    g.fillRect(x + 9, y + 5, 142, 95);
    g.fillStyle(0x38434e);
    g.fillRect(x + 15, y + 12, 61, 88);
    g.fillRect(x + 84, y + 12, 61, 88);
    g.lineStyle(2, 0x657480);
    g.lineBetween(x + 78, y + 8, x + 78, y + 100);
    g.fillStyle(0x101921);
    g.fillRect(x + 34, y + 27, 27, 26);
    g.fillRect(x + 99, y + 27, 27, 26);
    g.fillStyle(0x80bcaf);
    g.fillRect(x + 5, y + 4, 150, 3);
    g.fillStyle(0xbda878);
    g.fillRect(x - 6, y + 45, 4, 18);
    g.fillRect(x + 162, y + 45, 4, 18);
    g.fillStyle(0x14221f);
    g.fillRect(x + 111, y + 66, 17, 15);
    g.fillStyle(0xa2d7c2);
    g.fillTriangle(x + 113, y + 73, x + 124, y + 68, x + 124, y + 78);
  }

  drawHero(w: World) {
    const h = this.hero,
      g = this.weapon,
      p = w.player;
    g.clear();
    if (!h) return false;
    const extra = w as World & { slamming?: boolean; armory?: { primary: string } };
    const moving = Math.abs(p.vx) > 35;
    const pose = extra.slamming
      ? 6
      : p.dashTime > 0
        ? 5
        : !p.grounded
          ? p.vy < -80
            ? 3
            : 4
          : p.squash > 0.06
            ? 7
            : moving
              ? 1 + (Math.floor(w.time * 12) % 2)
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
    g.fillStyle(0x171a24);
    g.fillRoundedRect(10, -5, primary === "sniper" ? 35 : primary === "rifle" ? 28 : 20, 9, 2);
    g.fillStyle(0x808899);
    g.fillRect(12, -5, primary === "sniper" ? 30 : 17, 2);
    g.fillStyle(0x9d3c56);
    g.fillRect(15, -2, 7, 3);
    if (primary === "dagger") {
      g.fillStyle(0xd1d9e6);
      g.fillTriangle(13, -3, 39, -1, 17, 4);
    }
    if (primary === "hammer") {
      g.fillStyle(0x919baa);
      g.fillRoundedRect(26, -12, 14, 24, 2);
      g.fillStyle(0xc54d72);
      g.fillRect(28, -10, 3, 20);
    }
    g.restore();
    return true;
  }
}
