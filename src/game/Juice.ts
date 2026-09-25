/**
 * 打击感导演（Feel Director）。
 *
 * 只负责"战斗事件 → 感官反馈"：顿帧、慢动作、镜头震动/后坐/推近、全屏闪光、粒子、连杀与狂热。
 * 两条时间线：
 * - 模拟时间 `update(dt)`：连杀计时，随暂停和顿帧一起停止，保证可测。
 * - 真实时间 `updateReal(dt)`：顿帧、镜头、粒子，即便世界冻结也继续播放。
 * 狂热只给小幅度加成（攻速/移速/伤害），数值集中在 `feel` 常量里。
 */

export type Beat =
  | "shot"
  | "hit"
  | "heavy"
  | "kill"
  | "eliteKill"
  | "blast"
  | "wallSlam"
  | "shatter"
  | "stagger"
  | "perfect"
  | "parry"
  | "hurt"
  | "slam";

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  gravity: number;
  kind: "spark" | "chunk" | "ring" | "streak";
}

export interface Banner {
  id: number;
  text: string;
  sub: string;
  life: number;
  maxLife: number;
  tier: number;
}

/** A dying body that keeps moving after the kill, so deaths read as impact rather than deletion. */
export interface Corpse {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  life: number;
  maxLife: number;
  radius: number;
  color: number;
}

export const feel = {
  /** 击杀连锁：击杀后多久内再杀一个才能延续。 */
  streakWindow: 4,
  /** 受伤扣掉的连锁剩余时间（秒）。 */
  hurtPenalty: 1,
  /** 进入第 n 档狂热所需连杀数。 */
  tiers: [0, 3, 7, 13, 22],
  tierNames: ["", "连杀", "狂热", "屠宰", "永蚀"],
  /** 每档狂热的攻速 / 移速 / 伤害加成。狂热必须"感觉得到"，所以给到两位数。 */
  tierSpeed: 0.12,
  tierMove: 0.08,
  tierPower: 0.15,
  /** 狂热中每次击杀返还的体力。 */
  killStamina: 10,
  /** 多杀判定窗口。 */
  multiWindow: 0.35,
  /** 处决线：敌人生命低于该比例时受到的伤害倍率。 */
  executeAt: 0.28,
  executeBonus: 0.6,
  /** 僵直：普通/精英的韧性上限与每秒恢复，单次直接命中/重击的削韧值。 */
  poiseNormal: 30,
  poiseElite: 80,
  poiseRegen: 6,
  poiseHit: 7,
  poiseHeavy: 30,
  /** 破韧后的硬直时长与易伤加成，以及不可再次破韧的间隔。 */
  staggerTime: 1.15,
  staggerEliteTime: 0.7,
  staggerVulnerable: 0.45,
  staggerCooldown: 1.6,
  /** 狂热每档增加的削韧倍率。 */
  tierPoise: 0.25,
};

const hitstopFor: Partial<Record<Beat, number>> = {
  hit: 0.012,
  heavy: 0.075,
  kill: 0.055,
  eliteKill: 0.24,
  blast: 0.03,
  wallSlam: 0.09,
  shatter: 0.11,
  stagger: 0.09,
  parry: 0.12,
  slam: 0.07,
  hurt: 0.06,
};
const traumaFor: Partial<Record<Beat, number>> = {
  shot: 0.035,
  hit: 0.03,
  heavy: 0.22,
  kill: 0.2,
  eliteKill: 0.8,
  blast: 0.28,
  wallSlam: 0.32,
  shatter: 0.38,
  stagger: 0.3,
  parry: 0.25,
  slam: 0.38,
  hurt: 0.42,
};

const minorBeats = new Set<Beat>(["hit", "kill", "blast"]);

export class Juice {
  // ── real-time presentation ──
  hitstop = 0;
  sinceStop = 1;
  slowmo = 0;
  slowScale = 1;
  trauma = 0;
  kickX = 0;
  kickY = 0;
  zoom = 0;
  flash = 0;
  flashColor = 0xffffff;
  hurtVignette = 0;
  particles: Particle[] = [];
  corpses: Corpse[] = [];
  banners: Banner[] = [];
  private nextBanner = 1;
  private seed = 7;
  // ── simulated combat state ──
  streak = 0;
  streakTimer = 0;
  best = 0;
  totalKills = 0;
  multi = 0;
  multiTimer = 0;
  /** Sound cues produced this frame, drained by the scene. */
  cues: { beat: Beat; pitch: number }[] = [];

  get tier() {
    let t = 0;
    for (let i = 1; i < feel.tiers.length; i++) if (this.streak >= feel.tiers[i]) t = i;
    return t;
  }
  get tierName() {
    return feel.tierNames[this.tier];
  }
  /** Multiplier applied to attack speed. */
  get speed() {
    return 1 + this.tier * feel.tierSpeed;
  }
  get move() {
    return 1 + this.tier * feel.tierMove;
  }
  get power() {
    return 1 + this.tier * feel.tierPower;
  }
  /** Extra damage against a target already past the execution line. */
  executeScale(hp: number, maxHp: number) {
    return maxHp > 0 && hp / maxHp <= feel.executeAt ? 1 + feel.executeBonus : 1;
  }
  /** Poise damage multiplier — frenzy makes it progressively easier to bully enemies. */
  get poisePower() {
    return 1 + this.tier * feel.tierPoise;
  }
  get streakRatio() {
    return this.streak ? Math.max(0, this.streakTimer / feel.streakWindow) : 0;
  }

  private rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  beat(kind: Beat, x = 0, y = 0, color = 0xfff0c9, angle = 0) {
    const stop = hitstopFor[kind] ?? 0;
    // Hitstops never stack additively (strongest wins), and minor beats respect a short cooldown so
    // fast weapons and big fights never feel sticky.
    if (stop && (!minorBeats.has(kind) || this.sinceStop >= 0.09)) {
      this.hitstop = Math.min(0.3, Math.max(this.hitstop, stop));
      this.sinceStop = 0;
    }
    this.trauma = Math.min(1, this.trauma + (traumaFor[kind] ?? 0));
    const tierPitch = 1 + this.tier * 0.06;
    this.cues.push({ beat: kind, pitch: tierPitch });
    if (kind === "shot") {
      this.kickX -= Math.cos(angle) * 3;
      this.kickY -= Math.sin(angle) * 3;
      this.spray(x, y, 3, color, angle, 0.5, 260, "spark");
    } else if (kind === "hit") {
      this.spray(x, y, 5, color, angle, 0.9, 320, "spark");
    } else if (kind === "heavy") {
      this.kickX += Math.cos(angle) * 9;
      this.kickY += Math.sin(angle) * 9;
      this.spray(x, y, 12, color, angle, 1.1, 560, "spark");
      this.ring(x, y, color, 0.22, 70);
    } else if (kind === "kill" || kind === "eliteKill") {
      const big = kind === "eliteKill";
      this.spray(x, y, big ? 60 : 22, color, -Math.PI / 2, Math.PI, big ? 780 : 520, "chunk");
      this.spray(x, y, big ? 40 : 14, 0xffffff, 0, Math.PI, big ? 900 : 620, "streak");
      this.ring(x, y, color, big ? 0.6 : 0.3, big ? 360 : 120);
      this.zoom = Math.min(0.12, this.zoom + (big ? 0.1 : 0.025));
      this.flash = Math.max(this.flash, big ? 0.55 : 0.08);
      this.flashColor = big ? 0xffe3b0 : 0xffffff;
      if (big) {
        this.slowmo = 0.9;
        this.slowScale = 0.2;
      }
    } else if (kind === "blast" || kind === "slam") {
      this.ring(x, y, color, 0.35, 170);
      this.spray(x, y, 18, color, -Math.PI / 2, Math.PI, 600, "chunk");
    } else if (kind === "wallSlam") {
      this.spray(x, y, 16, color, 0, Math.PI, 480, "chunk");
      this.ring(x, y, color, 0.25, 90);
    } else if (kind === "stagger") {
      this.spray(x, y, 20, color, -Math.PI / 2, Math.PI, 620, "chunk");
      this.ring(x, y, color, 0.35, 160);
      this.flash = Math.max(this.flash, 0.12);
      this.flashColor = color;
    } else if (kind === "shatter") {
      this.spray(x, y, 34, 0xc5f1ff, -Math.PI / 2, Math.PI, 700, "chunk");
      this.ring(x, y, 0xc5f1ff, 0.4, 220);
      this.flash = Math.max(this.flash, 0.18);
      this.flashColor = 0xc5f1ff;
    } else if (kind === "perfect" || kind === "parry") {
      this.slowmo = kind === "parry" ? 0.45 : 0.4;
      this.slowScale = 0.25;
      this.ring(x, y, kind === "parry" ? 0x9cdfff : 0xb6f3d3, 0.45, 150);
      this.flash = Math.max(this.flash, 0.22);
      this.flashColor = kind === "parry" ? 0x9cdfff : 0xb6f3d3;
      this.zoom = Math.min(0.12, this.zoom + 0.04);
    } else if (kind === "hurt") {
      this.hurtVignette = 1;
      this.spray(x, y, 10, 0xff7884, -Math.PI / 2, Math.PI, 380, "spark");
    }
  }

  /** Register a kill in simulated time. Returns true when a new tier was reached. */
  kill(elite = false) {
    const before = this.tier;
    this.streak++;
    this.totalKills++;
    this.best = Math.max(this.best, this.streak);
    this.streakTimer = feel.streakWindow + (elite ? 2 : 0);
    this.multi = this.multiTimer > 0 ? this.multi + 1 : 1;
    this.multiTimer = feel.multiWindow;
    const after = this.tier;
    if (this.multi >= 2) {
      const names = ["", "", "双杀", "三杀", "四杀", "五杀"];
      this.banner(names[this.multi] ?? `${this.multi} 连斩`, "", Math.min(4, this.multi - 1), 0.9);
    }
    if (after > before) {
      this.banner(
        feel.tierNames[after],
        after >= 2
          ? `攻速 +${Math.round((this.speed - 1) * 100)}% · 伤害 +${Math.round((this.power - 1) * 100)}%`
          : "",
        after,
        1.5,
      );
      this.flash = Math.max(this.flash, 0.12 + after * 0.05);
      this.flashColor = after >= 3 ? 0xff9a7a : 0xffd599;
    }
    return after > before;
  }

  hurt() {
    if (this.streak) this.streakTimer -= feel.hurtPenalty;
  }

  /** Launch a dying body so the kill has a physical aftermath. */
  corpse(x: number, y: number, vx: number, vy: number, radius: number, color: number, elite = false) {
    this.corpses.push({
      x,
      y,
      vx,
      vy,
      angle: 0,
      spin: (vx >= 0 ? 1 : -1) * (elite ? 1.2 : 2.4),
      life: elite ? 1.5 : 0.9,
      maxLife: elite ? 1.5 : 0.9,
      radius,
      color,
    });
    if (this.corpses.length > 40) this.corpses.shift();
  }

  banner(text: string, sub: string, tier: number, life: number) {
    this.banners = this.banners.filter((b) => b.text !== text).slice(-3);
    this.banners.push({ id: this.nextBanner++, text, sub, tier, life, maxLife: life });
  }

  /** Simulated time: streak bookkeeping. */
  update(dt: number) {
    this.multiTimer = Math.max(0, this.multiTimer - dt);
    if (this.streak) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) {
        if (this.streak >= feel.tiers[2]) this.banner(`连杀中断 · ${this.streak}`, "", 0, 1.1);
        this.streak = 0;
        this.streakTimer = 0;
      }
    }
  }

  /**
   * Real time: presentation decay. Returns the simulation time scale for this frame
   * (0 during hitstop, slow-motion scale, or 1).
   */
  updateReal(dt: number) {
    let scale = 1;
    this.sinceStop += dt;
    if (this.hitstop > 0) {
      this.hitstop = Math.max(0, this.hitstop - dt);
      scale = 0;
    } else if (this.slowmo > 0) {
      this.slowmo = Math.max(0, this.slowmo - dt);
      // Ease back to real speed during the last third.
      const t = Math.min(1, this.slowmo / 0.25);
      scale = 1 - (1 - this.slowScale) * t;
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    const k = Math.exp(-dt * 18);
    this.kickX *= k;
    this.kickY *= k;
    this.zoom *= Math.exp(-dt * 6);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.hurtVignette = Math.max(0, this.hurtVignette - dt * 2.2);
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      const drag = p.kind === "chunk" ? Math.exp(-dt * 1.5) : Math.exp(-dt * 6);
      p.vx *= drag;
      p.vy *= p.kind === "chunk" ? 1 : drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const c of this.corpses) {
      c.life -= dt;
      c.vy += 1500 * dt;
      c.vx *= Math.exp(-dt * 2.2);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.angle += c.spin * dt;
    }
    this.corpses = this.corpses.filter((c) => c.life > 0);
    for (const b of this.banners) b.life -= dt;
    this.banners = this.banners.filter((b) => b.life > 0);
    return scale;
  }

  /** Camera offset from trauma (squared for a punchy falloff) plus recoil kick. */
  shake(time: number) {
    const s = this.trauma * this.trauma * 18;
    return {
      x: Math.sin(time * 71.3) * s + Math.sin(time * 23.1) * s * 0.5 + this.kickX,
      y: Math.cos(time * 67.7) * s * 0.8 + this.kickY,
      angle: Math.sin(time * 41.9) * this.trauma * this.trauma * 0.012,
    };
  }

  drainCues() {
    return this.cues.splice(0);
  }

  /** Movement feedback has no hitstop: traversal must keep responding. */
  motion(kind: "jump" | "airJump" | "land", x: number, y: number, strength = 1) {
    if (kind === "airJump") {
      this.ring(x, y, 0xbcefff, 0.28, 130);
      this.spray(x, y, 12, 0xbcefff, Math.PI / 2, 1.2, 210, "streak");
      return;
    }
    const power = Math.min(1.3, Math.max(0.3, strength));
    this.spray(
      x,
      y,
      kind === "jump" ? 5 : Math.round(10 * power),
      0xa4d7c8,
      -Math.PI / 2,
      1.4,
      110 + 90 * power,
      "spark",
    );
    if (kind === "land") {
      this.ring(x, y, 0xa4d7c8, 0.2, 75 * power);
      this.trauma = Math.min(1, this.trauma + 0.06 * power);
    }
  }

  private ring(x: number, y: number, color: number, life: number, radius: number) {
    this.particles.push({
      x,
      y,
      vx: radius,
      vy: 0,
      life,
      maxLife: life,
      size: 0,
      color,
      gravity: 0,
      kind: "ring",
    });
  }

  private spray(
    x: number,
    y: number,
    n: number,
    color: number,
    angle: number,
    spread: number,
    speed: number,
    kind: Particle["kind"],
  ) {
    for (let i = 0; i < n; i++) {
      const a = angle + (this.rand() * 2 - 1) * spread,
        v = speed * (0.35 + this.rand() * 0.65),
        life = kind === "chunk" ? 0.5 + this.rand() * 0.5 : 0.14 + this.rand() * 0.2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life,
        maxLife: life,
        size: kind === "chunk" ? 2 + this.rand() * 4 : 1 + this.rand() * 2,
        color,
        gravity: kind === "chunk" ? 1400 : 0,
        kind,
      });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  }
}
