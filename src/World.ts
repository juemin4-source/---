import { Player, type Controls } from "./Player";
import { Projectile } from "./Projectile";
import { W, clamp, distance, rayRect, type Rect } from "./PhysicsHelpers";
import { Enemy } from "./Enemy";
import { EnemyModule, moduleInfo } from "./EnemyModule";
import { updateModules } from "./ModuleSystems";
import type { Effect, EffectKind } from "./Effects";
import { updateEnemies } from "./EnemySystems";
import type { EnemyKind } from "./Enemy";
import { rooms } from "./Levels";
import type { OrganRig } from "./OrganRig";

export class World {
  width = 1280;
  height = 720;
  rig: OrganRig | null = null;
  salvageOnKill = false;
  phaseCapacity = 3;
  shotInterval = 0.11;
  shotDamage = 12;
  damageScale = 1;
  damageNumbers: { slot:number; x:number; y:number; amount:number; style:"hit"|"combo"|"player"|"organ"; life:number }[] = [];
  private damageSlot = 0;
  showDamage(x:number,y:number,amount:number,style:"hit"|"combo"|"player"|"organ"="hit") {
    if (amount <= 0) return;
    const slot = this.damageSlot++ % 48;
    this.damageNumbers = this.damageNumbers.filter(n=>n.slot!==slot);
    this.damageNumbers.push({slot,x:x+((slot%5)-2)*8,y,amount:Number(amount.toFixed(1)),style,life:0.72});
  }
  damageOrgan(m:EnemyModule, amount:number) {
    if (m.dead) return;
    const owned = m.stable && !m.parent;
    const actual = Math.min(m.hp, amount);
    m.damage(amount);
    this.showDamage(m.x,m.y-24,actual,"organ");
    if (m.stable && !m.dead && m.hp <= m.maxHp*0.25 && m.hp + actual > m.maxHp*0.25) this.say(moduleInfo[m.kind].name+"耐久危险 · 寻找替换器官");
    if(m.dead){ this.stats.destroyed++; this.emit("break",m.x,m.y,moduleInfo[m.kind].color); this.say(moduleInfo[m.kind].name+(owned ? "已损坏 · 基础枪仍可使用，寻找新的器官" : "被击毁 · F 震脱可保留完整器官")); this.rig?.sync(this); }
  }
  onEnemyKilled?: (enemy: Enemy) => void;
  onModuleDetached?: (module: EnemyModule) => void;
  player = new Player();
  projectiles: Projectile[] = [];
  time = 0;
  enemies: Enemy[] = [];
  modules: EnemyModule[] = [];
  stableQueue: EnemyModule[] = [];
  phaseCooldown = 0;
  phaseBeam = 0;
  phaseX = 0;
  phaseY = 0;
  held: EnemyModule | null = null;
  effects: Effect[] = [];
  sounds: EffectKind[] = [];
  god = false;
  dead = false;
  complete = false;
  message = "靠近敌人的外置零件，用 F 震脱。";
  messageTime = 5;
  stats = {
    detached: 0,
    destroyed: 0,
    kills: 0,
    phased: 0,
    rams: 0,
    boosted: false,
  };
  roomIndex = 0;
  wave = 0;
  roomTime = 0;
  gateOpen = false;
  waveDelay = -1;
  recoveryTimer = 0;
  checkpointHeld: {
    kind: EnemyModule["kind"];
    stable: boolean;
    hp: number;
    angle: number;
    w: number;
    h: number;
  } | null = null;
  platforms: Rect[] = [
    { x: 640, y: 665, w: 1280, h: 110 },
    { x: 480, y: 510, w: 180, h: 22 },
  ];
  constructor(public campaign = false) {
    if (campaign) this.enterRoom(0);
    else {
      const e = new Enemy("crawler", 850, 585);
      this.enemies.push(e);
      this.modules.push(e.attach("gun", 0, -45));
    }
  }
  get room() {
    return rooms[this.roomIndex];
  }
  enterRoom(index: number, restart = false) {
    if (!restart)
      this.checkpointHeld = this.held
        ? {
            kind: this.held.kind,
            stable: this.held.stable,
            hp: this.held.hp,
            angle: this.held.angle,
            w: this.held.w,
            h: this.held.h,
          }
        : null;
    this.roomIndex = index;
    this.damageNumbers = [];
    this.roomTime = 0;
    this.wave = 0;
    this.waveDelay = -1;
    this.gateOpen = false;
    this.dead = false;
    this.complete = false;
    this.recoveryTimer = 0;
    this.player = new Player();
    this.enemies = [];
    this.modules = [];
    this.projectiles = [];
    this.effects = [];
    this.sounds = [];
    this.stableQueue = [];
    this.held = null;
    this.phaseBeam = 0;
    this.phaseCooldown = 0;
    this.platforms = this.room.platforms.map((p) => ({ ...p }));
    if (this.checkpointHeld) {
      const data = this.checkpointHeld,
        m = new EnemyModule(data.kind, 180, 565);
      Object.assign(m, data);
      m.held = true;
      this.modules.push(m);
      this.held = m;
      if (m.stable) this.stableQueue.push(m);
    }
    for (const s of this.room.supplies) {
      const m = new EnemyModule(s.kind, s.x, s.y);
      m.angle = s.angle;
      m.cooldown = 4;
      this.modules.push(m);
    }
    this.spawnWave();
    this.say(index === 1 ? "高处还有一扇门。" : this.room.hint);
  }
  spawnWave() {
    for (const e of this.room.waves[this.wave])
      this.spawnEnemy(e.kind, e.x, e.y, e.variant);
  }
  reset() {
    if (this.complete) {
      this.stats = {
        detached: 0,
        destroyed: 0,
        kills: 0,
        phased: 0,
        rams: 0,
        boosted: false,
      };
      this.time = 0;
      this.held = null;
      this.enterRoom(0);
    } else this.enterRoom(this.roomIndex, true);
  }
  updateProgress(dt: number) {
    this.roomTime += dt;
    if (!this.enemies.some((e) => !e.dead)) {
      if (this.wave < this.room.waves.length - 1) {
        if (this.waveDelay < 0) {
          this.waveDelay = 1.8;
          this.say("新的星骸正在接近…");
        }
        this.waveDelay -= dt;
        if (this.waveDelay <= 0) {
          this.wave++;
          this.spawnWave();
          this.waveDelay = -1;
        }
      } else if (this.roomIndex === 4) {
        this.complete = true;
        return;
      } else this.gateOpen = true;
    }
    if (this.roomIndex === 1) {
      const thruster = this.modules.some(
        (m) => m.kind === "thruster" && !m.dead,
      );
      this.recoveryTimer = thruster ? 0 : this.recoveryTimer + dt;
      if (this.recoveryTimer > 3) {
        this.spawnEnemy("crawler", 750, 580, "thruster");
        this.recoveryTimer = 0;
        this.gateOpen = false;
        this.say("另一只推进星骸爬入了房间。");
      }
      if (this.roomTime > 35 && this.roomTime - dt <= 35)
        this.say(this.room.hint);
    }
    if (
      this.gateOpen &&
      Math.abs(this.player.x - this.room.exit.x) < 40 &&
      Math.abs(this.player.y - this.room.exit.y) < 62
    )
      this.enterRoom(this.roomIndex + 1);
  }
  spawnEnemy(
    kind: EnemyKind,
    x: number,
    y: number,
    variant?: "gun" | "thruster" | "shield",
  ) {
    const e = new Enemy(kind, x, y);
    this.enemies.push(e);
    const attach = (kind: EnemyModule["kind"], x: number, y: number) =>
      this.modules.push(e.attach(kind, x, y));
    if (kind === "crawler")
      attach(variant ?? (Math.random() < 0.5 ? "gun" : "thruster"), 0, -42);
    if (kind === "floater") {
      attach("gun", -37, 4);
      attach("thruster", 32, 18);
    }
    if (kind === "reclaimer") {
      attach("grapple", -40, -12);
      if (variant === "shield") attach("shield", -66, -24);
    }
    if (kind === "elite") {
      attach("shield", -77, 0);
      attach("gun", -25, -75);
      attach("thruster", 57, -30);
      attach("grapple", 65, 30);
    }
    return e;
  }
  emit(kind: EffectKind, x: number, y: number, color = 0xd4e9d8, angle = 0) {
    const life =
      kind === "detach"
        ? 0.55
        : kind === "phase"
          ? 0.45
          : kind === "shot"
            ? 0.09
            : 0.28;
    this.effects.push({ kind, x, y, color, life, maxLife: life, angle });
    this.sounds.push(kind);
  }
  say(message: string) {
    this.message = message;
    this.messageTime = 3.5;
  }
  stabilize(m: EnemyModule) {
    if (m.dead || m.parent || m.stable) return;
    this.stableQueue = this.stableQueue.filter((v) => v.stable && !v.dead);
    if (this.stableQueue.length >= this.phaseCapacity) {
      this.stableQueue.shift()!.stable = false;
      this.say("定相已替换 · 最早的模块恢复失控");
    } else this.say(`${moduleInfo[m.kind].name} · 定相完成`);
    m.stable = true;
    m.dormant = false;
    m.vx = 0;
    m.vy = 0;
    m.stableAt = this.time;
    this.stableQueue.push(m);
    this.stats.phased++;
    this.rig?.sync(this);
    this.emit("phase", m.x, m.y, 0xa5ffdc);
  }
  damageEnemy(e: Enemy, amount: number, impulse = 0, style: "hit"|"combo" = "hit") {
    if (e.dead) return;
    this.showDamage(e.x, e.y-e.h/2-12, Math.min(e.hp,amount), style);
    e.hp -= amount;
    e.flash = 0.09;
    e.impulseX += impulse;
    if (e.hp <= 0) {
      e.dead = true;
      this.stats.kills++;
      this.onEnemyKilled?.(e);
      this.emit("kill", e.x, e.y, 0xe18b86);
      const intact = e.modules.filter((m) => m.parent === e && !m.dead);
      const salvage = this.salvageOnKill
        ? intact
            .sort(
              (a, b) =>
                (e.salvageKind
                  ? Number(a.kind !== e.salvageKind) -
                    Number(b.kind !== e.salvageKind)
                  : 0) ||
                Number(this.rig?.has(a.kind) ?? false) -
                  Number(this.rig?.has(b.kind) ?? false),
            )
            .slice(0, e.kind === "elite" ? 2 : 1)
        : [];
      for (const m of intact) {
        if (salvage.includes(m)) {
          m.detach();
          m.cooldown = 1.2;
          m.dormant = true;
          m.active = 0;
          this.emit("detach", m.x, m.y, moduleInfo[m.kind].color);
          this.say(moduleInfo[m.kind].name + "可用残留 · 靠近按 E 一键接入");
        } else {
          m.dead = true;
          this.emit("break", m.x, m.y, moduleInfo[m.kind].color);
        }
      }
    }
  }
  hurtPlayer(amount: number, fromX: number) {
    const p = this.player;
    if (this.god || p.invulnerable > 0 || this.dead) return;
    const actual = Math.min(p.hp, amount * this.damageScale);
    p.hp = Math.max(0, p.hp - actual);
    this.showDamage(p.x,p.y-42,actual,"player");
    p.invulnerable = 0.65;
    p.externalX += Math.sign(p.x - fromX) * 900;
    this.emit("hurt", p.x, p.y, 0xff7884);
    if (p.hp <= 0) this.dead = true;
  }
  strike() {
    const p = this.player;
    if (p.meleeCooldown > 0) return;
    p.meleeCooldown = 0.34;
    this.emit("melee", p.x, p.y, 0xf5e1a0, p.aim);
    let found = false;
    for (const m of this.modules)
      if (m.parent && !m.dead && distance(p, m) < 108) {
        const facing =
          (m.x - p.x) * Math.cos(p.aim) + (m.y - p.y) * Math.sin(p.aim);
        if (facing < -18) continue;
        m.connection -= 65;
        m.flash = 0.15;
        found = true;
        if (m.connection <= 0) {
          const parent = m.parent;
          m.detach();
          if (this.salvageOnKill && parent) {
            parent.stun = Math.max(parent.stun, 0.9);
            parent.charge = 0;
          }
          this.stats.detached++;
          this.onModuleDetached?.(m);
          this.emit("detach", m.x, m.y, moduleInfo[m.kind].color);
          this.say(
            moduleInfo[m.kind].name +
              (this.salvageOnKill
                ? "完整脱落 · E 接入 / 右键定相部署"
                : "完整脱落 · 右键定相"),
          );
        }
      }
    if (!found)
      for (const e of this.enemies)
        if (!e.dead && distance(p, e) < 85)
          this.damageEnemy(e, 16, Math.sign(e.x - p.x) * 180);
  }
  grab() {
    if (this.held) {
      const m = this.held;
      if (
        this.platforms.some(
          (r) =>
            Math.abs(m.x - r.x) < (m.w + r.w) / 2 &&
            Math.abs(m.y - r.y) < (m.h + r.h) / 2,
        )
      ) {
        this.say("放置位置被遮挡 · 移动鼠标调整");
        return;
      }
      m.held = false;
      m.vx = this.player.vx * 0.35;
      m.vy = 0;
      this.held = null;
      return;
    }
    const m = this.modules
      .filter(
        (m) =>
          !m.parent && !m.dead && !m.mounted && distance(m, this.player) < 115,
      )
      .sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
    if (m) {
      m.held = true;
      this.held = m;
      this.say(
        this.salvageOnKill
          ? "移动鼠标放置 · Q / 滚轮旋转 · V 放下"
          : "移动鼠标放置 · Q / 滚轮旋转 · E 放下",
      );
    }
  }
  update(dt: number, c: Controls) {
    if (this.dead || this.complete) return;
    this.time += dt;
    for (const n of this.damageNumbers) { n.life -= dt; n.y -= dt * 48; }
    this.damageNumbers = this.damageNumbers.filter(n=>n.life>0);
    this.messageTime -= dt;
    for (const f of this.effects) f.life -= dt;
    this.effects = this.effects.filter((f) => f.life > 0);
    this.rig?.beforePlayerUpdate(this, dt, c);
    this.player.boundsWidth=this.width;
    this.player.update(dt, c, this.platforms);
    if (c.dash && this.player.dashTime > 0)
      this.emit("dash", this.player.x, this.player.y, 0xb0fbdc);
    if (this.player.dashTime > 0 && Math.floor(this.time * 120) % 3 === 0)
      this.effects.push({
        kind: "dash",
        x: this.player.x,
        y: this.player.y,
        color: 0xa5ffdc,
        life: 0.18,
        maxLife: 0.18,
        angle: 0,
      });
    if (c.grab) this.grab();
    if (c.rotate) {
      const m =
        this.held ??
        this.modules.filter(
          (m) =>
            !m.parent &&
            !m.dead &&
            !m.mounted &&
            distance(m, this.player) < 130 &&
            distance(m, { x: c.mx, y: c.my }) < 65,
        )[0];
      if (m) {
        const step = m.kind === "shield" ? Math.PI / 2 : Math.PI / 4;
        m.angle = (Math.round(m.angle / step) + c.rotate) * step;
        if (m.kind === "shield" && Math.abs(c.rotate) % 2 === 1) {
          const oldHeight = m.h;
          [m.w, m.h] = [m.h, m.w];
          if (m.grounded && !m.held) m.y -= (m.h - oldHeight) / 2;
        }
      }
    }
    if (c.melee) this.strike();
    this.phaseCooldown -= dt;
    this.phaseBeam -= dt;
    if (c.phase && this.phaseCooldown <= 0) {
      this.phaseCooldown = 0.22;
      this.phaseBeam = 0.13;
      const p = this.player,
        dx = Math.cos(p.aim) * 360,
        dy = Math.sin(p.aim) * 360;
      let wall = 1;
      for (const r of this.platforms) {
        const t = rayRect(p.x, p.y, dx, dy, r);
        if (t !== null) wall = Math.min(wall, t);
      }
      const hits = this.modules
        .filter((m) => !m.parent && !m.dead && !m.mounted)
        .map((m) => ({ m, t: rayRect(p.x, p.y, dx, dy, m, 12) }))
        .filter((v) => v.t !== null && v.t <= wall)
        .sort((a, b) => a.t! - b.t!);
      const hit = hits[0];
      if (hit) this.stabilize(hit.m);
      this.phaseX = p.x + dx * (hit?.t ?? wall);
      this.phaseY = p.y + dy * (hit?.t ?? wall);
    }
    for (const b of [this.player,...this.enemies,...this.modules]) b.boundsWidth=this.width;
    updateEnemies(this, dt);
    updateModules(this, dt);
    this.rig?.update(this, dt, c);
    if (c.fire && this.player.fireCooldown <= 0) {
      const p = this.player,
        a = p.aim;
      p.fireCooldown = this.shotInterval;
      this.projectiles.push(
        new Projectile(
          p.x + Math.cos(a) * 14,
          p.y + Math.sin(a) * 14,
          Math.cos(a) * 1000,
          Math.sin(a) * 1000,
          "player",
          this.shotDamage,
        ),
      );
      this.emit(
        "shot",
        p.x + Math.cos(a) * 30,
        p.y + Math.sin(a) * 30,
        0xf5efb1,
        a,
      );
    }
    this.updateProjectiles(dt);
    this.stableQueue = this.stableQueue.filter((m) => m.stable && !m.dead);
    if (this.held?.dead) this.held = null;
    if (this.player.y > this.height + 60) this.hurtPlayer(100, this.player.x);
    this.player.x = clamp(this.player.x, 25, this.width - 25);
    if (this.campaign && !this.dead) this.updateProgress(dt);
  }
  updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      const dx = p.vx * dt,
        dy = p.vy * dt;
      const candidates: {
        t: number;
        target: EnemyModule | Enemy | Player | Rect;
        type: "module" | "enemy" | "player" | "wall";
      }[] = [];
      const add = (
        target: EnemyModule | Enemy | Player | Rect,
        type: (typeof candidates)[number]["type"],
      ) => {
        const t = rayRect(p.x, p.y, dx, dy, target, 3);
        if (t !== null) candidates.push({ t, target, type });
      };
      for (const r of this.platforms) add(r, "wall");
      for (const m of this.modules)
        if (!m.dead && p.owner !== -m.id && p.owner !== m.parent?.id) {
          const friendlyShield =
            p.team === "player" &&
            m.kind === "shield" &&
            m.stable &&
            (m.mounted || this.salvageOnKill);
          if (friendlyShield) continue;
          if (
            m.kind === "shield" ||
            (p.team !== "enemy" && m.parent && !this.salvageOnKill) ||
            (this.salvageOnKill && p.team !== "player" && m.stable && !m.parent)
          )
            add(m, "module");
        }
      for (const e of this.enemies)
        if (!e.dead && p.team !== "enemy") add(e, "enemy");
      if (p.team !== "player") add(this.player, "player");
      candidates.sort((a, b) => a.t - b.t);
      const hit = candidates[0];
      if (hit) {
        p.x += dx * hit.t;
        p.y += dy * hit.t;
        p.dead = true;
        this.rig?.onProjectileHit(this, p);
        this.emit("hit", p.x, p.y, p.team === "player" ? 0xe7ebba : 0xff7284);
        if (hit.type === "module") {
          const m = hit.target as EnemyModule;
          if (m.kind === "shield") {
            m.flash = 0.09;
            if (m.parent) this.damageOrgan(m, p.damage * 0.12);
            else {
              m.vx += Math.sign(p.vx) * 10;
              if (m.stable && this.salvageOnKill && p.team !== "player") this.damageOrgan(m, p.damage * this.damageScale);
              else if (!m.stable) this.damageOrgan(m, p.damage * 0.15);
            }
          } else this.damageOrgan(m, p.damage * (p.team === "enemy" ? this.damageScale : 1));
        }
        if (hit.type === "enemy")
          this.damageEnemy(hit.target as Enemy, p.damage, Math.sign(p.vx) * 38);
        if (hit.type === "player")
          this.hurtPlayer(p.damage, p.x - Math.sign(p.vx) * 10);
      } else {
        p.x += dx;
        p.y += dy;
      }
      p.life -= dt;
    }
    this.projectiles = this.projectiles.filter(
      (p) =>
        !p.dead && p.life > 0 && p.x > 0 && p.x < this.width && p.y > -50 && p.y < this.height + 10,
    );
  }
}
