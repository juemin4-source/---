import Phaser from "phaser";
import { ArtDirection } from "./ArtDirection";
import { enemyBands } from "./CombatBalance";
import { moduleInfo, type EnemyModule } from "./EnemyModule";
import type { World } from "./World";
import { distance } from "./PhysicsHelpers";

const C = {
  mint: 0xb6f3d3,
  cream: 0xf1e7c8,
  red: 0xff7284,
};
export class Renderer {
  g: Phaser.GameObjects.Graphics;
  skin: ArtDirection;
  private viewWorld?: World;
  labels = new Map<string, Phaser.GameObjects.Text>();
  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.skin = new ArtDirection(scene);
  }
  label(id: string, x: number, y: number, text: string, color = "#69827e", size = 12) {
    const w = this.viewWorld;
    if (w && /^(weapon-|hp-|carrier-)/.test(id)) {
      const reach = id.startsWith("carrier-") ? 600 : 260;
      if (distance(w.player, { x, y }) > reach) return;
    }
    let t = this.labels.get(id);
    if (!t) {
      t = this.scene.add.text(x, y, text, {
        fontFamily: '"Consolas", "Microsoft YaHei", monospace',
        fontSize: size,
        color,
      });
      t.setDepth(3);
      this.labels.set(id, t);
    }
    t.setPosition(x, y).setText(text).setColor(color).setFontSize(size).setVisible(true);
  }
  render(w: World, hitboxes: boolean, mx: number, my: number) {
    this.viewWorld = w;
    for (const t of this.labels.values()) t.setVisible(false);
    const g = this.g;
    g.clear();
    this.skin.background(g, w);
    for (const platform of w.platforms) this.skin.platform(g, platform);
    if (w.roomIndex === 1) {
      g.lineStyle(2, 0xb98e4b, 0.45);
      for (let y = 590; y > 360; y -= 32) {
        g.lineBetween(885, y, 900, y - 12);
        g.lineBetween(900, y - 12, 915, y);
      }
      this.label("ascent", 807, 626, "↑  UPPER ACCESS", "#9d9c70", 11);
    }
    if (w.campaign) {
      const r = w.room.exit,
        color = w.gateOpen ? C.mint : 0x6b7867;
      g.fillStyle(color, 0.06);
      g.fillRect(r.x - 27, r.y - 54, 54, 108);
      g.lineStyle(2, color, w.gateOpen ? 0.85 : 0.3);
      g.strokeRect(r.x - 27, r.y - 54, 54, 108);
      for (let y = r.y - 40; y < r.y + 50; y += 12) {
        g.lineStyle(1, color, 0.2);
        g.lineBetween(r.x - 23, y, r.x + 23, y);
      }
      g.lineStyle(2, color);
      g.lineBetween(r.x - 9, r.y, r.x + 9, r.y);
      g.lineBetween(r.x + 9, r.y, r.x + 2, r.y - 7);
      g.lineBetween(r.x + 9, r.y, r.x + 2, r.y + 7);
      this.label(
        "exit",
        r.x - 27,
        r.y - 74,
        w.gateOpen ? "EXIT →" : "LOCKED",
        w.gateOpen ? "#b6f3d3" : "#667567",
        11,
      );
    }
    // Human engineering and divine radial machines use different visual grammars.
    for (const e of w.enemies)
      if (!e.dead) {
        const radius = e.w / 2,
          color =
            e.tier >= 0
              ? enemyBands[e.tier].color
              : e.kind === "elite"
                ? 0xbd866c
                : e.kind === "reclaimer"
                  ? 0x9b83b4
                  : 0xa86c75;
        this.skin.enemy(g, e, w.time, w.player.x);
        if (e.hp < e.maxHp) {
          g.fillStyle(0x1a2728);
          g.fillRect(e.x - radius, e.y + radius + 22, radius * 2, 3);
          g.fillStyle(color);
          g.fillRect(e.x - radius, e.y + radius + 22, (radius * 2 * e.hp) / e.maxHp, 3);
        }
        if (e.charge > 0) {
          g.lineStyle(2, 0xffbc70, 0.6);
          g.strokeCircle(e.x, e.y, radius + 12);
        }
        if (hitboxes) {
          g.lineStyle(1, 0xff4444);
          g.strokeRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
        }
      }
    for (const m of w.modules) if (!m.dead) this.module(w, m, hitboxes);
    const p = w.player;
    for (const trail of this.skin.heroReady ? [] : p.trails) {
      g.fillStyle(C.mint, (trail.life / 0.18) * 0.3);
      g.fillRoundedRect(trail.x - 12, trail.y - 25, 24, 48, 8);
      g.fillCircle(trail.x, trail.y - 18, 12);
      g.lineStyle(2, C.mint, (trail.life / 0.18) * 0.5);
      g.lineBetween(trail.x - p.moveFacing * 32, trail.y, trail.x, trail.y);
    }
    if (!p.grounded && p.vy > 850) {
      g.lineStyle(2, C.mint, 0.65);
      for (const offset of [-18, 18]) g.lineBetween(p.x + offset, p.y - 55, p.x + offset, p.y + 8);
    }
    for (const f of w.effects)
      if (f.kind === "dash" && !this.skin.heroReady) {
        g.fillStyle(f.color, (f.life / f.maxLife) * 0.22);
        g.fillRoundedRect(f.x - 12, f.y - 23, 24, 47, 5);
      }
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(p.x, w.height > 720 ? p.y + 25 : 608, 40, 7);
    if (!this.skin.drawHero(w)) {
      g.save();
      g.translateCanvas(p.x, p.y + 24);
      g.rotateCanvas(p.dashTime > 0 ? p.moveFacing * 0.2 : p.vx / 4200);
      g.scaleCanvas(1 + p.squash, 1 - p.squash);
      g.translateCanvas(-p.x, -p.y - 24);
      const blink = p.invulnerable > 0 && Math.floor(w.time * 24) % 2 === 0;
      g.fillStyle(blink ? 0xffffff : C.cream);
      g.fillRoundedRect(p.x - 10, p.y - 7, 20, 24, 4);
      g.fillCircle(p.x, p.y - 16, 12);
      g.fillStyle(C.cream);
      g.fillRoundedRect(p.x - 8, p.y - 39, 5, 18, 2);
      g.fillRoundedRect(p.x + 2, p.y - 35, 5, 14, 2);
      g.fillStyle(0x2b4140);
      g.fillRect(p.x + (p.facing > 0 ? 0 : -11), p.y - 20, 11, 5);
      g.lineStyle(5, 0xd4d2b6);
      const walk = p.grounded ? Math.sin(w.time * 19) * Math.min(7, Math.abs(p.vx) / 45) : 4;
      g.lineBetween(p.x - 5, p.y + 14, p.x - 5 + walk, p.y + 24);
      g.lineBetween(p.x + 5, p.y + 14, p.x + 5 - walk, p.y + 24);
      g.lineStyle(3, C.mint);
      g.lineBetween(p.x - 9, p.y + 2, p.x + 9, p.y + 2);
      const ax = Math.cos(p.aim),
        ay = Math.sin(p.aim);
      g.lineStyle(8, 0x566761);
      g.lineBetween(p.x + ax * 9, p.y + ay * 9, p.x + ax * 28, p.y + ay * 28);
      g.lineStyle(2, C.cream);
      g.lineBetween(p.x + ax * 17, p.y + ay * 17, p.x + ax * 32, p.y + ay * 32);
      g.restore();
    }
    if (!p.grounded && p.airJumpAvailable) {
      g.fillStyle(0xbcefff, 0.85);
      g.fillCircle(p.x, p.y + 34, 2.5);
    }
    if (p.dashCooldown > 0) {
      g.lineStyle(2, 0xa4d7c8, 0.6);
      g.beginPath();
      g.arc(p.x, p.y + 31, 8, Math.PI, Math.PI + Math.PI * (1 - p.dashCooldown / 0.48));
      g.strokePath();
    }
    if (w.held) {
      g.lineStyle(1, C.mint, 0.55);
      g.lineBetween(p.x, p.y, w.held.x, w.held.y);
    }
    for (const b of w.projectiles) {
      const color = b.team === "player" ? 0xf0efaf : 0xff7181;
      g.lineStyle(3, color, 0.4);
      g.lineBetween(b.x - b.vx * 0.018, b.y - b.vy * 0.018, b.x, b.y);
      g.fillStyle(color);
      g.fillCircle(b.x, b.y, b.team === "player" ? 3 : 5);
    }
    if (w.phaseBeam > 0) {
      g.lineStyle(12, C.mint, 0.08);
      g.lineBetween(p.x, p.y, w.phaseX, w.phaseY);
      g.lineStyle(2, C.mint, 0.9);
      g.lineBetween(p.x, p.y, w.phaseX, w.phaseY);
    }
    for (const f of w.effects) {
      if (f.kind === "dash") continue;
      const t = 1 - f.life / f.maxLife;
      if (f.kind === "melee") {
        g.lineStyle(4, C.cream, 1 - t);
        g.beginPath();
        g.arc(f.x, f.y, 35 + t * 72, f.angle - 0.95, f.angle + 0.95, false);
        g.strokePath();
      } else if (f.kind === "shot") {
        g.fillStyle(f.color, 1 - t);
        g.fillCircle(f.x, f.y, 5 + 4 * t);
      } else {
        g.lineStyle(f.kind === "detach" ? 3 : 1, f.color, 1 - t);
        g.strokeCircle(f.x, f.y, 7 + t * (f.kind === "detach" ? 65 : 36));
        for (let j = 0; j < (f.kind === "detach" ? 14 : 6); j++) {
          const a = j * 2.399 + f.x;
          g.fillStyle(f.color, 1 - t);
          g.fillRect(f.x + Math.cos(a) * t * 65, f.y + Math.sin(a) * t * 65 + t * t * 20, 3, 3);
        }
      }
    }
    const hover = w.modules
      .filter((m) => !m.dead && !m.mounted && distance(m, { x: mx, y: my }) < 50)
      .sort((a, b) => distance(a, { x: mx, y: my }) - distance(b, { x: mx, y: my }))[0];
    if (hover) {
      const status = hover.parent
        ? "F 震脱"
        : w.salvageOnKill
          ? "E 一键接入 · V 搬运"
          : hover.stable
            ? "已定相 · E 搬运"
            : "右键定相 · E 搬运";
      this.label(
        "hover",
        Math.min(hover.x - 50, 1080),
        hover.y - hover.h / 2 - 34,
        `${moduleInfo[hover.kind].name} / ${status}`,
        "#d5e9d7",
        12,
      );
    }
    for (const n of w.damageNumbers) {
      const color =
        n.style === "player"
          ? "#ff7b83"
          : n.style === "organ"
            ? "#8cdbff"
            : n.style === "combo"
              ? "#d4a6ff"
              : "#fff0c9";
      const text = (n.style === "player" ? "−" : "") + n.amount;
      this.label("damage-" + n.slot, n.x, n.y, text, color, n.style === "combo" ? 21 : 17);
      this.labels
        .get("damage-" + n.slot)!
        .setOrigin(0.5, 1)
        .setAlpha(Math.min(1, n.life / 0.22))
        .setStroke("#0a1117", 3)
        .setDepth(8);
    }
    g.lineStyle(1, C.cream, 0.8);
    g.strokeCircle(mx, my, 8);
    g.lineBetween(mx - 13, my, mx - 5, my);
    g.lineBetween(mx + 5, my, mx + 13, my);
    g.lineBetween(mx, my - 13, mx, my - 5);
    g.lineBetween(mx, my + 5, mx, my + 13);
  }
  module(w: World, m: EnemyModule, hitboxes: boolean) {
    const g = this.g,
      base = moduleInfo[m.kind].color,
      color = m.flash > 0 ? 0xffffff : base;
    const jitter = !m.stable && !m.parent ? Math.sin(w.time * 37 + m.id) * 1.5 : 0,
      x = m.x + jitter,
      y = m.y;
    if (m.parent) {
      g.lineStyle(3, m.connection < 60 ? 0xff624e : base, 0.55);
      g.lineBetween(m.parent.x, m.parent.y, x, y);
      g.fillStyle(m.connection < 60 ? 0xff624e : base);
      g.fillCircle((m.parent.x + x) / 2, (m.parent.y + y) / 2, 4);
    }
    if (m.stable) {
      g.fillStyle(C.mint, 0.07);
      g.fillCircle(x, y, Math.max(m.w, m.h) / 2 + 9);
      g.lineStyle(1, C.mint, 0.45);
      g.strokeCircle(x, y, Math.max(m.w, m.h) / 2 + 5);
    }
    const a = m.angle,
      dx = Math.cos(a),
      dy = Math.sin(a);
    if (m.kind === "thruster") {
      if ((m.stable || m.active > 0) && !m.parent && (!m.mounted || m.active > 0)) {
        const len = 210 + Math.sin(w.time * 26) * 15;
        g.lineStyle(35, base, 0.035);
        g.lineBetween(x + dx * 20, y + dy * 20, x + dx * len, y + dy * len);
        for (let i = 0; i < 8; i++) {
          const d = 25 + ((w.time * 290 + i * 29) % 220);
          g.lineStyle(1.5, base, (1 - d / 260) * 0.75);
          g.lineBetween(x + dx * d - dy * 8, y + dy * d + dx * 8, x + dx * (d + 9), y + dy * (d + 9));
          g.lineBetween(x + dx * d + dy * 8, y + dy * d - dx * 8, x + dx * (d + 9), y + dy * (d + 9));
        }
      }
      g.fillStyle(0x493e2c);
      g.fillCircle(x, y, 17);
      g.lineStyle(2, color);
      g.strokeCircle(x, y, 17);
      g.strokeCircle(x, y, 10);
      g.lineStyle(5, color);
      g.lineBetween(x + dx * 8, y + dy * 8, x + dx * 22, y + dy * 22);
    } else if (m.kind === "gun") {
      const ga = m.parent
        ? Math.atan2(w.player.y - y, w.player.x - x)
        : m.stable && m.targetX
          ? Math.atan2(m.targetY - y, m.targetX - x)
          : a;
      g.fillStyle(0x49313b);
      g.fillRoundedRect(x - 16, y - 13, 32, 26, 4);
      g.lineStyle(2, color);
      g.strokeRoundedRect(x - 16, y - 13, 32, 26, 4);
      g.lineStyle(9, color);
      g.lineBetween(x, y, x + Math.cos(ga) * 27, y + Math.sin(ga) * 27);
      g.fillStyle(0x201e28);
      g.fillCircle(x, y, 6);
    } else if (m.kind === "shield") {
      g.fillStyle(0x283c4b);
      g.fillRoundedRect(x - m.w / 2, y - m.h / 2, m.w, m.h, 5);
      g.lineStyle(2, color);
      g.strokeRoundedRect(x - m.w / 2, y - m.h / 2, m.w, m.h, 5);
      g.lineStyle(1, color, 0.5);
      if (m.h > m.w) for (let v = -30; v <= 30; v += 15) g.lineBetween(x - 7, y + v, x + 7, y + v + 6);
      else for (let v = -30; v <= 30; v += 15) g.lineBetween(x + v, y - 7, x + v + 6, y + 7);
    } else {
      if (m.active > 0) {
        g.lineStyle(2, color, 0.65);
        g.lineBetween(x, y, m.targetX, m.targetY);
        g.strokeCircle(m.targetX, m.targetY, 9);
      }
      g.fillStyle(0x3a304b);
      g.fillCircle(x, y, 17);
      g.lineStyle(2, color);
      g.beginPath();
      g.arc(x, y, 17, a + 0.5, a + Math.PI * 2 - 0.5, false);
      g.strokePath();
      g.lineBetween(x + dx * 4, y + dy * 4, x + dx * 24, y + dy * 24);
      g.fillStyle(color);
      g.fillCircle(x, y, 5);
    }
    if (m.hp < m.maxHp * 0.55) {
      g.lineStyle(2, 0xffbdb0);
      g.lineBetween(x - 8, y - 10, x + 1, y - 2);
      g.lineBetween(x + 1, y - 2, x - 4, y + 4);
      g.lineBetween(x - 4, y + 4, x + 8, y + 10);
    }
    if (!m.parent && !m.stable) {
      g.fillStyle(base, 0.4 + Math.sin(w.time * 12) * 0.3);
      g.fillCircle(x, y + m.h / 2 + 8, 2);
    }
    if (hitboxes) {
      g.lineStyle(1, 0x72edff);
      g.strokeRect(m.x - m.w / 2, m.y - m.h / 2, m.w, m.h);
    }
  }
}
