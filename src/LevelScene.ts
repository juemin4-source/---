import Phaser from "phaser";
import { World } from "./World";
import { idleControls, type Controls } from "./Player";
import { Renderer } from "./Renderer";
import { Synth } from "./Effects";
import { DebugTools } from "./DebugTools";
import { moduleInfo } from "./EnemyModule";

export class LevelScene extends Phaser.Scene {
  world = new World(true);
  art!: Renderer;
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  accumulator = 0;
  started = false;
  paused = false;
  synth = new Synth();
  debugTools!: DebugTools;
  overlay = document.getElementById("overlay")!;
  hud = document.getElementById("hud")!;
  overlayState = "";
  hudClock = 0;
  wheel = 0;
  pending = idleControls();
  edges = new Set<string>();
  pressed(name: string) {
    const value = this.edges.has(name);
    this.edges.delete(name);
    return value;
  }
  create() {
    this.art = new Renderer(this);
    this.debugTools = new DebugTools(() => this.world);
    this.keys = this.input.keyboard!.addKeys(
      "A,D,SPACE,SHIFT,F,E,R,Q,ESC,F1,M",
    ) as typeof this.keys;
    for (const [name, key] of Object.entries(this.keys))
      key.on("down", () => this.edges.add(name));
    this.input.mouse!.disableContextMenu();
    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _x: number, dy: number) => {
        this.wheel += Math.sign(dy);
      },
    );
    this.input.on("pointerdown", () => this.synth.unlock());
    this.hud.innerHTML = `<div class="topbar"><div class="brand"><b class="sigil">◉</b><b>BLACK SUN</b><span>二十八宿：黑日</span><small>PLAYABLE STUDY / 0.1</small></div><div class="topmeta"><i></i> LOCAL SIMULATION <span id="clock">00:00</span></div></div><div class="room-info"><span id="chapter"></span><h2 id="room-title"></h2><div class="steps">${[1, 2, 3, 4, 5].map((i) => `<i data-step="${i - 1}"></i>`).join("")}</div></div><div class="status"><div class="health-label">房日兔 <span id="hp-number">100</span></div><div class="health"><i id="hp-fill"></i></div><div class="phase-label">定相链路 <span id="stable-count">0 / 3</span></div><div id="stable-slots"></div><div id="cooldown"></div></div><div id="toast"></div><div class="bottom"><div class="keys"><span><kbd>A</kbd><kbd>D</kbd>移动</span><span><kbd>Space</kbd>跳跃</span><span><kbd>Shift</kbd>冲刺</span><span><kbd>左键</kbd>射击</span><span><kbd>右键</kbd>定相</span><span><kbd>F</kbd>震脱</span><span><kbd>E</kbd>搬运</span><span><kbd>Q / 滚轮</kbd>旋转</span></div><div class="bottom-meta"><span id="objective"></span><span>R 重试 · Esc 暂停 · M 声音 · F1 调试</span></div></div>`;
    this.overlay.addEventListener("click", (e) => {
      const action = (e.target as HTMLElement).closest("button")?.dataset
        .action;
      if (action === "start" || action === "resume") {
        this.started = true;
        this.paused = false;
        this.synth.unlock();
        this.input.keyboard!.resetKeys();
      }
      if (action === "restart") {
        this.world.reset();
        this.paused = false;
        this.started = true;
      }
    });
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      if (this.started && !this.world.dead && !this.world.complete)
        this.paused = true;
      this.input.keyboard?.resetKeys();
      this.edges.clear();
    });
    // Small development inspection surface for repeatable browser acceptance checks.
    (window as unknown as { blackSun: LevelScene }).blackSun = this;
  }
  update(_time: number, delta: number) {
    const c: Controls = this.pending,
      k = this.keys,
      p = this.input.activePointer;
    if (this.pressed("F1")) this.debugTools.toggle();
    if (this.pressed("ESC") && this.started) this.paused = !this.paused;
    if (this.pressed("M")) this.synth.muted = !this.synth.muted;
    if (this.pressed("R")) {
      this.world.reset();
      this.started = true;
      this.paused = false;
    }
    c.left = k.A.isDown;
    c.right = k.D.isDown;
    c.jump = this.pressed("SPACE") || c.jump;
    c.jumpHeld = k.SPACE.isDown;
    c.dash = this.pressed("SHIFT") || c.dash;
    c.melee = this.pressed("F") || c.melee;
    c.grab = this.pressed("E") || c.grab;
    c.rotate += this.wheel + (this.pressed("Q") ? 1 : 0);
    this.wheel = 0;
    c.fire = p.leftButtonDown();
    c.phase = p.rightButtonDown();
    c.mx = p.x;
    c.my = p.y;
    if (this.started && !this.paused) {
      this.accumulator += Math.min(delta / 1000, 0.05);
      while (this.accumulator >= 1 / 120) {
        this.world.update(1 / 120, c);
        c.jump = false;
        c.dash = false;
        c.melee = false;
        c.grab = false;
        c.rotate = 0;
        this.accumulator -= 1 / 120;
      }
    } else {
      this.accumulator = 0;
      c.jump = false;
      c.dash = false;
      c.melee = false;
      c.grab = false;
      c.rotate = 0;
    }
    const sounds = this.world.sounds.splice(0);
    for (const sound of sounds) {
      this.synth.play(sound);
      if (sound === "detach") this.cameras.main.shake(120, 0.003);
      else if (sound === "kill" || sound === "ram")
        this.cameras.main.shake(80, 0.0015);
    }
    this.art.render(this.world, this.debugTools.hitboxes, c.mx, c.my);
    this.hudClock += delta;
    if (this.hudClock > 80) {
      this.refreshHUD();
      this.hudClock = 0;
    }
    this.refreshOverlay();
  }
  refreshHUD() {
    const w = this.world,
      p = w.player,
      set = (id: string, text: string) => {
        document.getElementById(id)!.textContent = text;
      };
    set("chapter", w.room.subtitle);
    set("room-title", w.room.name);
    set("hp-number", String(Math.ceil(p.hp)));
    document.getElementById("hp-fill")!.style.width = `${p.hp}%`;
    set(
      "clock",
      `${String(Math.floor(w.time / 60)).padStart(2, "0")}:${String(Math.floor(w.time % 60)).padStart(2, "0")}`,
    );
    set("stable-count", `${w.stableQueue.length} / 3`);
    document.getElementById("stable-slots")!.innerHTML = [0, 1, 2]
      .map((i) => {
        const m = w.stableQueue[i];
        return `<span class="slot ${m ? "filled" : ""}">${m ? moduleInfo[m.kind].name : "—"}</span>`;
      })
      .join("");
    set(
      "cooldown",
      `${p.dashCooldown > 0 ? "冲刺恢复中" : "冲刺就绪"}${w.god ? " · 无敌 ON" : ""}${this.synth.muted ? " · 静音" : ""}`,
    );
    set("toast", w.messageTime > 0 ? w.message : "");
    set(
      "objective",
      w.gateOpen
        ? "通路已开启 → 手持模块可带入下一房间"
        : `区域 ${w.roomIndex + 1} / 5  ·  活跃星骸 ${w.enemies.filter((e) => !e.dead).length}  ·  波次 ${w.wave + 1} / ${w.room.waves.length}`,
    );
    this.hud
      .querySelectorAll<HTMLElement>("[data-step]")
      .forEach(
        (e) =>
          (e.className = Number(e.dataset.step) <= w.roomIndex ? "lit" : ""),
      );
  }
  refreshOverlay() {
    const state = !this.started
      ? "intro"
      : this.world.complete
        ? "complete"
        : this.world.dead
          ? "dead"
          : this.paused
            ? "pause"
            : "";
    if (state === this.overlayState) return;
    this.overlayState = state;
    this.overlay.hidden = !state;
    if (!state) return;
    if (state === "intro")
      this.overlay.innerHTML = `<div class="intro"><div class="intro-main"><span class="eyebrow">二十八宿 / 玩法验证原型</span><h1>BLACK<br><em>SUN.</em></h1><p class="intro-lead">把敌人拆成玩具。<br>用它的零件，改变战场。</p><button data-action="start">进入试验场 <span>↗</span></button><small>5 个房间 · 键盘 + 鼠标 · 约 5–10 分钟</small></div><div class="intro-notes"><span class="eyebrow">FIELD MANUAL / 001</span><div><b>01</b><p><strong>射核心，或拆零件</strong><br>左键快速击杀。靠近外置器官，<br>按 F 两次，保留它的完整功能。</p></div><div><b>02</b><p><strong>它掉下来，还活着</strong><br>失控喷流、乱射炮腕。<br>瞄准零件，右键「定相」。</p></div><div><b>03</b><p><strong>没有预设的组合</strong><br>E 搬运，Q / 滚轮改变方向。<br>让喷流、盾板和牵引自己相遇。</p></div><footer>同时维持 3 个定相模块<br>第 4 个会解除最早的定相。</footer></div></div>`;
    else if (state === "complete") {
      const s = this.world.stats;
      this.overlay.innerHTML = `<div class="result"><span class="eyebrow">ALL SECTORS CLEARED</span><h1>PROTOTYPE<br><em>COMPLETE</em></h1><p>黑日试验结束。你带走了多少敌人的身体？</p><div class="results"><span><b>${s.detached}</b>完整拆件</span><span><b>${s.phased}</b>定相次数</span><span><b>${s.rams}</b>盾板冲撞</span></div><button data-action="restart">重新开始 <span>R ↗</span></button></div>`;
    } else
      this.overlay.innerHTML = `<div class="result"><span class="eyebrow">${state === "dead" ? "SIGNAL LOST" : "SIMULATION HELD"}</span><h1>${state === "dead" ? "链路中断" : "已暂停"}<em>.</em></h1><p>${state === "dead" ? "房间会完整重置，再试一种拆解方式。" : "继续试验，或重新布置这一间战场。"}</p>${state === "pause" ? '<button data-action="resume">继续 <span>Esc ↗</span></button>' : ""}<button class="secondary" data-action="restart">重试当前房间 <span>R ↗</span></button></div>`;
  }
}
