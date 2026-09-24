import Phaser from "phaser";
import { Expedition } from "./Expedition";
import { ProfileStore, type Upgrade } from "./Progression";
import { Renderer } from "./Renderer";
import { Synth } from "./Effects";
import { idleControls } from "./Player";
import { ExpeditionUI, type OverlayMode } from "./ExpeditionUI";
import { renderExpedition } from "./ExpeditionArt";
import { EnemyModule, type ModuleKind } from "./EnemyModule";
import { zoneOrder, type ZoneId } from "./ExpeditionMap";

export class ExpeditionScene extends Phaser.Scene {
  expedition!: Expedition;
  art!: Renderer;
  ui!: ExpeditionUI;
  synth = new Synth();
  mode: OverlayMode = "";
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  edges = new Set<string>();
  pending = idleControls();
  wheel = 0;
  accumulator = 0;
  hudClock = 0;
  hitboxes = false;
  debugVisible = false;
  interactPressed = false;
  debug = document.getElementById("debug")!;
  get world() {
    return this.expedition.world;
  }
  pressed(key: string) {
    const value = this.edges.has(key);
    this.edges.delete(key);
    return value;
  }
  create() {
    let store: ProfileStore;
    try {
      store = new ProfileStore(window.localStorage);
    } catch {
      store = new ProfileStore();
      store.available = false;
    }
    this.expedition = new Expedition(store);
    this.art = new Renderer(this);
    this.ui = new ExpeditionUI();
    document.getElementById("app")!.classList.add("expedition");
    this.keys = this.input.keyboard!.addKeys(
      "A,D,S,SPACE,SHIFT,F,E,G,V,Q,W,R,H,ESC,TAB,F1,M,ONE,TWO,THREE,FOUR",
    ) as typeof this.keys;
    for (const [key, value] of Object.entries(this.keys))
      value.on("down", () => this.edges.add(key));
    this.input.mouse!.disableContextMenu();
    this.input.on(
      "wheel",
      (_p: unknown, _o: unknown, _x: number, dy: number) =>
        (this.wheel += Math.sign(dy)),
    );
    this.input.on("pointerdown", () => this.synth.unlock());
    this.ui.overlay.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest("button");
      if (!button) return;
      const action = button.dataset.action;
      if (button.dataset.upgrade)
        this.expedition.buy(button.dataset.upgrade as Upgrade);
      if (action === "depart") {
        this.expedition.start();
        this.mode = "";
        this.synth.unlock();
        this.ui.signature = "";
      }
      if (action === "resume") this.mode = "";
      if (action === "rescue") this.mode = "rescue";
      if (action === "rescue-confirm") {
        this.expedition.finish("rescued");
        this.mode = "";
      }
      this.input.keyboard!.resetKeys();
      this.edges.clear();
      button.blur();
    });
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      if (this.expedition.state === "field") this.mode = "pause";
      this.input.keyboard!.resetKeys();
      this.edges.clear();
      this.expedition.saveActive();
    });
    window.addEventListener("pagehide", () => this.expedition.saveActive());
    this.setupDebug();
    (window as unknown as { blackSun: ExpeditionScene }).blackSun = this;
  }
  setupDebug() {
    this.debug.innerHTML = `<div class="debug-title">EXPEDITION LAB <span>F1 关闭</span></div><small>仅测试 · 无敌 / 跳转会标记调试</small><div class="debug-row">${(["thruster", "gun", "shield", "grapple"] as ModuleKind[]).map((k, i) => `<button data-module="${k}">${["推进囊", "炮腕", "甲壳盾", "牵引腕"][i]}</button>`).join("")}</div><div class="debug-row"><button data-debug="god">无敌</button><button data-debug="hit">Hitbox</button><button data-debug="clear">清敌</button><button data-debug="activity">活化 +20</button></div><small>区域跳转（保留出行资源）</small><div class="debug-row">${zoneOrder.map((id, i) => `<button data-zone="${id}">${i}</button>`).join("")}</div>`;
    this.debug.addEventListener("click", (event) => {
      const b = (event.target as HTMLElement).closest("button");
      if (!b || this.expedition.state !== "field") return;
      this.expedition.debugUsed = true;
      if (b.dataset.module) {
        const m = new EnemyModule(
          b.dataset.module as ModuleKind,
          Math.min(this.world.width - 90, this.world.player.x + 90),
          this.world.player.y - 36,
        );
        m.cooldown = 3;
        this.world.modules.push(m);
      }
      if (b.dataset.debug === "god") this.world.god = !this.world.god;
      if (b.dataset.debug === "hit") this.hitboxes = !this.hitboxes;
      if (b.dataset.debug === "clear")
        this.world.enemies.forEach((e) => this.world.damageEnemy(e, 9999));
      if (b.dataset.debug === "activity")
        this.expedition.activity = Math.min(100, this.expedition.activity + 20);
      if (b.dataset.zone) {
        const p = this.world.player,
          god = this.world.god;
        this.expedition.zoneId = b.dataset.zone as ZoneId;
        this.world.player = p;
        p.x = 130;
        p.y = this.world.height - 134;
        this.world.god = god;
        this.expedition.area.visited = true;
        this.expedition.applyUpgrades(this.world);
      }
      b.blur();
    });
  }
  update(_time: number, delta: number) {
    const e = this.expedition,
      c = this.pending,
      k = this.keys,
      p = this.input.activePointer;
    if (this.pressed("F1")) {
      this.debugVisible = !this.debugVisible;
      this.debug.hidden = !this.debugVisible;
    }
    if (this.pressed("M")) this.synth.muted = !this.synth.muted;
    if (this.pressed("ESC") && e.state === "field")
      this.mode = this.mode ? "" : "pause";
    if (this.pressed("TAB") && e.state === "field")
      this.mode = this.mode === "map" ? "" : "map";
    if (this.pressed("R") && e.state === "field") this.mode = "rescue";
    e.world.player.platformDrop = k.S.isDown;
    c.left = k.A.isDown;
    c.right = k.D.isDown;
    c.jump = this.pressed("SPACE") || c.jump;
    c.jumpHeld = k.SPACE.isDown;
    c.dash = this.pressed("SHIFT") || c.dash;
    c.melee = this.pressed("F") || c.melee;
    c.grab = this.pressed("V") || c.grab;
    const connect = this.pressed("E"),
      deploy = this.pressed("G");
    const selectKeys = ["ONE", "TWO", "THREE", "FOUR"];
    for (let i = 0; i < selectKeys.length; i++)
      if (this.pressed(selectKeys[i]) && e.state === "field" && !this.mode)
        e.rig.select(i);
    if (e.state === "field" && !this.mode) {
      if (connect) e.installOrgan();
      if (deploy) e.rig.deploySelected(e.world);
    }
    c.rotate += this.wheel + (this.pressed("Q") ? 1 : 0);
    this.wheel = 0;
    this.interactPressed = this.pressed("W") || this.interactPressed;
    c.mx = p.x + this.cameras.main.scrollX;
    c.my = p.y + this.cameras.main.scrollY;
    if (this.pressed("H") && !this.mode) e.heal();
    c.fire = p.leftButtonDown();
    c.phase = p.rightButtonDown();
    if (e.state === "field" && !this.mode) {
      this.accumulator += Math.min(delta / 1000, 0.05);
      while (this.accumulator >= 1 / 120) {
        e.update(
          1 / 120,
          c,
          k.W.isDown || this.interactPressed,
          this.interactPressed,
        );
        this.accumulator -= 1 / 120;
        c.jump = false;
        c.dash = false;
        c.melee = false;
        c.grab = false;
        c.rotate = 0;
        this.interactPressed = false;
        if (!e.areas.size) {
          this.mode = "";
          break;
        }
      }
    } else {
      this.accumulator = 0;
      c.jump = false;
      c.dash = false;
      c.melee = false;
      c.grab = false;
      c.rotate = 0;
      this.interactPressed = false;
    }
    for (const sound of e.world.sounds.splice(0)) {
      this.synth.play(sound);
      if (sound === "detach") this.cameras.main.shake(120, 0.003);
      else if (sound === "kill" || sound === "ram")
        this.cameras.main.shake(80, 0.0015);
    }
    const cam = this.cameras.main;
    cam.setBounds(0, 0, e.world.width, e.world.height);
    cam.setScroll(
      Math.max(0, Math.min(e.world.width - 1280, e.world.player.x - 640)),
      Math.max(0, Math.min(e.world.height - 720, e.world.player.y - 470)),
    );
    this.art.render(e.world, this.hitboxes, c.mx, c.my);
    renderExpedition(this.art, e);
    this.hudClock += delta;
    if (this.hudClock > 80) {
      this.ui.render(e, this.mode, this.synth.muted);
      this.hudClock = 0;
    }
  }
}
