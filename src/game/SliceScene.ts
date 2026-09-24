import Phaser from "phaser";
import { enemyModuleHints } from "./EnemyCombat";
import { districts } from "./AscentMap";
import { guideHTML, nextBuildTarget, fieldBuilds } from "./BuildGuide";
import { Renderer } from "../engine/Renderer";
import { Synth } from "../engine/Effects";
import { idleControls } from "../engine/Player";
import { SliceWorld, freshSave, parseSave, SAVE_KEY, type Save } from "./SliceWorld";
import {
  organs,
  organIds,
  weapons,
  secondaries,
  zones,
  type OrganId,
  type WeaponId,
  type SecondaryId,
} from "./config";
import { trainingPanel, stackEffect, number } from "./TrainingUI";
import "../styles/slice.css";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export class SliceScene extends Phaser.Scene {
  world = new SliceWorld();
  art!: Renderer;
  synth = new Synth();
  keys!: Record<string, Phaser.Input.Keyboard.Key>;
  edges = new Set<string>();
  save: Save = freshSave();
  started = false;
  paused = false;
  mapOpen = false;
  helpOpen = false;
  guideOpen = false;
  benchOpen = false;
  benchStacks = 1;
  settled = false;
  storageWarning = "";
  interrupted = false;
  overlayKey = "";
  accumulator = 0;
  hudClock = 0;
  hud = document.getElementById("hud")!;
  overlay = document.getElementById("overlay")!;
  pending = idleControls();
  lastReward = 0;
  feedback = "";
  damageFlash = -1;
  muted = false;
  create() {
    document.getElementById("app")!.classList.add("slice-app");
    document.title = "永蚀 · 沉井上行 / 0.9";
    try {
      this.save = parseSave(localStorage.getItem(SAVE_KEY));
    } catch {
      this.storageWarning = "浏览器无法保存进度，本次仍可完整试玩。";
    }
    this.interrupted = this.save.active;
    this.save.active = false;
    this.persist();
    this.world = new SliceWorld(this.save.shortcut, this.save.trips + 1);
    this.art = new Renderer(this);
    this.keys = this.input.keyboard!.addKeys(
      "A,D,S,SPACE,SHIFT,E,Q,H,F,B,R,TAB,ESC,M,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE",
    ) as typeof this.keys;
    for (const [name, key] of Object.entries(this.keys)) key.on("down", () => this.edges.add(name));
    this.input.keyboard!.addCapture(["TAB", "SPACE"]);
    this.input.mouse!.disableContextMenu();
    this.input.on("pointerdown", () => this.synth.unlock());
    this.overlay.addEventListener("click", (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
      if (!button || button.disabled) return;
      this.act(button.dataset.action!, button.dataset.slot);
    });
    this.overlay.addEventListener("input", (e) => {
      if ((e.target as HTMLElement).id === "slice-feedback")
        this.feedback = (e.target as HTMLTextAreaElement).value;
      if ((e.target as HTMLElement).id === "grant-stacks")
        this.benchStacks = Math.max(1, Math.min(100, Number((e.target as HTMLInputElement).value) || 1));
    });
    this.game.events.on(Phaser.Core.Events.BLUR, () => {
      if (this.started && !this.world.result) this.paused = true;
      this.resetInput();
    });
    this.game.events.on(Phaser.Core.Events.HIDDEN, () => {
      if (this.started && !this.world.result) this.paused = true;
      this.resetInput();
    });
    this.refreshHUD();
    this.refreshOverlay();
    (window as unknown as { eclipseSlice: SliceScene }).eclipseSlice = this;
  }
  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
    } catch {
      this.storageWarning = "无法写入本地进度；可在结算时导出试玩记录。";
    }
  }
  resetInput() {
    this.input.keyboard?.resetKeys();
    this.edges.clear();
    const p = this.input.activePointer,
      x = p.x,
      y = p.y;
    p.reset();
    p.position.set(x, y);
    this.world.armory.previousFire = false;
    this.world.armory.previousQ = false;
    this.world.armory.charge = 0;
    this.world.armory.grenadeCharge = 0;
    this.world.armory.blocking = false;
    this.accumulator = 0;
    this.pending = idleControls();
  }
  pressed(name: string) {
    const v = this.edges.has(name);
    this.edges.delete(name);
    return v;
  }
  start(training = false, unlimited = false) {
    this.world = new SliceWorld(this.save.shortcut, this.save.trips + 1, training, !training, unlimited);
    this.started = true;
    this.paused = false;
    this.cameras.main.setBounds(0, 0, this.world.width, this.world.height);
    this.cameras.main.setScroll(
      training ? 0 : this.world.player.x - 640,
      training ? 0 : this.world.player.y - 400,
    );
    this.guideOpen = false;
    this.benchOpen = training;
    this.mapOpen = false;
    this.helpOpen = false;
    this.settled = false;
    this.feedback = "";
    this.save.active = !training;
    this.persist();
    this.synth.unlock();
    this.resetInput();
    this.overlayKey = "";
  }
  applyBench() {
    const w = this.world,
      value = (id: string) =>
        (document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null)?.value;
    const primary = value("bench-primary") as WeaponId,
      secondary = value("bench-secondary") as SecondaryId;
    if (primary) w.armory.switchPrimary(primary);
    if (secondary) w.armory.switchSecondary(secondary);
    if (w.training) {
      w.trainingWeapon = (value("bench-enemy-weapon") || "auto") as typeof w.trainingWeapon;
      w.trainingSecondary = (value("bench-enemy-secondary") || "none") as typeof w.trainingSecondary;
      w.trainingKind = (value("bench-kind") || "mixed") as typeof w.trainingKind;
      w.trainingHealth = Math.max(1, Math.min(1000, Number(value("bench-health")) || 3));
      w.trainingCount = Math.max(1, Math.min(24, Number(value("bench-count")) || 5));
      w.wave = Math.max(1, Math.min(100, Number(value("bench-wave")) || 1));
      w.trainingOrgan = (value("bench-organ") || "cycle") as typeof w.trainingOrgan;
      w.trainingAuto = (document.getElementById("bench-auto") as HTMLInputElement).checked;
    }
  }
  act(action: string, slot?: string) {
    const scroll = this.overlay.querySelector(".slice-panel")?.scrollTop ?? 0;
    if (action === "start") this.start(false, this.started && this.world.unlimited);
    if (action === "start-six") this.start();
    if (action === "start-unlimited") this.start(false, true);
    if (action === "train") this.start(true, this.started && this.world.training && this.world.unlimited);
    if (action === "train-unlimited") this.start(true, true);
    if (action === "recommend") {
      this.guideOpen = true;
      this.mapOpen = false;
      this.benchOpen = false;
      this.paused = false;
    }
    if (action === "track-build" && slot && this.world.ascent && fieldBuilds[slot]) {
      this.world.ascent.trackedBuild = slot;
      this.guideOpen = false;
      this.paused = false;
    }
    if (action === "resume") {
      this.guideOpen = false;
      this.paused = false;
      this.helpOpen = false;
      this.mapOpen = false;
      this.benchOpen = false;
    }
    if (action === "bench") {
      if (this.world.result && this.world.training) {
        this.world.reviveTraining();
        this.settled = false;
      }
      this.benchOpen = true;
      this.paused = false;
    }
    if (action === "revive") {
      this.world.reviveTraining();
      this.settled = false;
    }
    if (action === "apply-bench") this.applyBench();
    if (action === "spawn-bench") {
      this.applyBench();
      this.world.spawnTraining();
    }
    if (action === "next-wave") {
      this.applyBench();
      this.world.startWave();
    }
    if (action === "resupply") this.world.resupply();
    if (action === "clear-enemies") {
      this.world.enemies.length = 0;
      this.world.projectiles = [];
      this.world.drops.length = 0;
    }
    if (action === "grant" && slot) this.world.grant(slot as OrganId, this.benchStacks);
    if (action === "preset" && slot) this.world.useBuild(slot, this.benchStacks);
    if (action === "remove-organ") {
      const id = this.world.slots[Number(slot)];
      this.world.slots.splice(Number(slot), 1);
      if (id) delete this.world.stackCounts[id];
      this.world.syncStats();
    }
    if (action === "clear-build") {
      this.world.slots = [];
      this.world.stackCounts = {};
      this.world.syncStats();
    }
    if (action === "map") {
      if (this.world.training) this.benchOpen = true;
      else this.mapOpen = true;
      this.paused = false;
    }
    if (action === "help") {
      this.helpOpen = true;
      this.paused = false;
    }
    if (action === "skip") this.world.pendingDrop = null;
    if (action === "equip") this.world.equip(Number(slot));
    if (action === "export") {
      this.exportRun();
      return;
    }
    this.resetInput();
    this.overlayKey = "";
    this.refreshOverlay();
    if (this.benchOpen && !this.world.pendingDrop)
      this.overlay.querySelector(".slice-panel")!.scrollTop = scroll;
  }
  settle() {
    if (this.settled || !this.world.result) return;
    this.settled = true;
    if (this.world.training) {
      this.resetInput();
      return;
    }
    this.save.trips++;
    this.save.active = false;
    this.lastReward = this.world.result === "extracted" ? this.world.cargo : 0;
    if (this.world.result === "extracted") {
      this.save.bank += this.lastReward;
      this.save.research = [...new Set([...this.save.research, ...this.world.slots])];
      if (this.world.relay) this.save.shortcut = true;
    }
    this.persist();
    this.resetInput();
  }
  exportRun() {
    const data = {
      version: "0.9",
      unlimited: this.world.unlimited,
      collectedLayers: this.world.collectedLayers,
      pressure: this.world.ascent?.pressure,
      reinforcements: this.world.ascent?.reinforcements,
      map: this.world.ascent ? "handcrafted-ascent" : "training",
      trackedBuild: this.world.ascent?.trackedBuild,
      openedSites: this.world.ascent ? [...this.world.ascent.opened] : [],
      training: this.world.training,
      wave: this.world.wave,
      weapon: this.world.armory.primary,
      secondary: this.world.armory.secondary,
      stacks: this.world.stackCounts,
      exportedAt: new Date().toISOString(),
      result: this.world.result,
      seed: this.world.seed,
      seconds: this.world.time,
      cargo: this.world.cargo,
      hp: this.world.player.hp,
      organs: this.world.slots,
      shortcutAtStart: this.world.shortcut,
      metrics: this.world.metrics,
      events: this.world.log,
      feedback: this.feedback,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `永蚀-试玩-${this.save.trips}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  update(_time: number, delta: number) {
    if (!this.keys) return;
    if (this.pressed("M")) this.synth.muted = !this.synth.muted;
    if (this.pressed("ESC") && this.started && !this.world.result) {
      if (this.world.pendingDrop) this.world.pendingDrop = null;
      else if (this.mapOpen || this.helpOpen || this.benchOpen || this.guideOpen) {
        this.mapOpen = false;
        this.helpOpen = false;
        this.benchOpen = false;
        this.guideOpen = false;
      } else this.paused = !this.paused;
      this.resetInput();
    }
    if (this.pressed("TAB") && this.started && !this.world.result && !this.world.pendingDrop) {
      this.guideOpen = false;
      if (this.world.training) this.benchOpen = !this.benchOpen;
      else {
        this.mapOpen = !this.mapOpen;
        this.benchOpen = false;
      }
      this.paused = false;
      this.helpOpen = false;
      this.resetInput();
    }
    if (this.pressed("B") && this.started && !this.world.result && !this.world.pendingDrop) {
      this.guideOpen = false;
      this.benchOpen = !this.benchOpen;
      this.mapOpen = false;
      this.helpOpen = false;
      this.paused = false;
      this.resetInput();
    }
    if (
      this.pressed("R") &&
      this.started &&
      this.world.ascent &&
      !this.world.result &&
      !this.world.pendingDrop
    ) {
      this.guideOpen = !this.guideOpen;
      this.mapOpen = false;
      this.benchOpen = false;
      this.paused = false;
      this.resetInput();
    }
    const active =
      this.started &&
      !this.paused &&
      !this.mapOpen &&
      !this.helpOpen &&
      !this.benchOpen &&
      !this.guideOpen &&
      !this.world.result &&
      !this.world.pendingDrop;
    const mouse = this.input.activePointer;
    if (active) {
      const c = this.pending;
      c.left = this.keys.A.isDown;
      c.right = this.keys.D.isDown;
      c.jump = this.pressed("SPACE") || c.jump;
      c.jumpHeld = this.keys.SPACE.isDown;
      c.dash = this.pressed("SHIFT") || c.dash;
      c.fire = mouse.leftButtonDown();
      c.mx = mouse.x + this.cameras.main.scrollX;
      c.my = mouse.y + this.cameras.main.scrollY;
      c.phase = mouse.rightButtonDown();
      c.grab = this.keys.Q.isDown;
      c.melee = this.pressed("F") || c.melee;
      ["ONE", "TWO", "THREE", "FOUR", "FIVE"].forEach((key, i) => {
        if (this.pressed(key)) this.world.armory.switchPrimary((Object.keys(weapons) as WeaponId[])[i]);
      });
      ["SIX", "SEVEN", "EIGHT", "NINE"].forEach((key, i) => {
        if (this.pressed(key))
          this.world.armory.switchSecondary((Object.keys(secondaries) as SecondaryId[])[i]);
      });
      this.world.player.platformDrop = this.keys.S.isDown;
      if (this.pressed("H")) this.world.heal();
      if (this.pressed("E")) {
        this.world.interact();
        if (this.world.pendingDrop) this.resetInput();
      }
      this.accumulator += Math.min(delta / 1000, 0.05);
      while (this.accumulator >= 1 / 120) {
        this.world.update(1 / 120, c, this.keys.E.isDown);
        c.jump = false;
        c.dash = false;
        c.melee = false;
        this.accumulator -= 1 / 120;
      }
    } else {
      this.accumulator = 0;
      this.edges.clear();
      this.pending = idleControls();
    }
    this.settle();
    for (const sound of this.world.sounds.splice(0)) {
      this.synth.play(sound);
      if (sound === "ram" || sound === "hurt") this.cameras.main.shake(80, 0.002);
    }
    if (this.world.ascent) {
      const cam = this.cameras.main,
        p = this.world.player;
      cam.scrollX = Phaser.Math.Linear(
        cam.scrollX,
        Phaser.Math.Clamp(p.x - 640, 0, this.world.width - 1280),
        0.14,
      );
      cam.scrollY = Phaser.Math.Linear(
        cam.scrollY,
        Phaser.Math.Clamp(p.y - 400, 0, this.world.height - 720),
        0.14,
      );
    }
    this.renderWorld(mouse.x + this.cameras.main.scrollX, mouse.y + this.cameras.main.scrollY);
    this.hudClock += delta;
    if (this.hudClock > 90) {
      this.refreshHUD();
      this.hudClock = 0;
    }
    this.refreshOverlay();
  }
  renderWorld(mx: number, my: number) {
    const w = this.world,
      g = this.art.g;
    this.art.render(w, false, mx, my);
    this.art.labels.get("roommark")?.setVisible(false);
    this.art.labels.get("sector")?.setVisible(false);
    this.art.labels.get("ascent")?.setVisible(false);
    for (const portal of w.ascent ? [] : w.zone.portals) {
      const locked = portal.shortcut && !w.shortcut,
        color = locked ? 0x526463 : portal.to === "core" ? 0xef9290 : 0xa4d7c8;
      g.fillStyle(color, 0.08);
      g.fillRect(portal.x - 24, 526, 48, 84);
      g.lineStyle(2, color, 0.7);
      g.strokeRect(portal.x - 24, 526, 48, 84);
      this.art.label(
        `door-${portal.to}`,
        Math.max(18, Math.min(1055, portal.x - 62)),
        499,
        locked ? "回路图带回后修复" : portal.label,
        locked ? "#70847e" : "#bde0d3",
        12,
      );
    }
    if (!w.ascent && w.zoneId === "hub") {
      g.fillStyle(0x9edcc3, 0.07);
      g.fillRect(110, 475, 140, 136);
      g.lineStyle(2, 0x9edcc3, 0.8);
      g.strokeRect(110, 475, 140, 136);
      this.art.label("safe-exit", 115, 448, "撤离气闸 · 按住 E", "#bde4cc", 14);
      if (w.extraction > 0) {
        g.fillStyle(0xc9e5c5);
        g.fillRect(113, 596, 134 * Math.min(1, w.extraction / 2), 9);
      }
      this.art.label("hub-map", 426, 325, "← 西线：撞墙充能       东线：印记传导 →", "#90aaa2", 16);
      this.art.label("hub-tip", 426, 358, "Tab 查看猎取路线；拿到收获后，可沿原路撤回。", "#90aaa2", 13);
    }
    const chest = w.ascent ? undefined : w.zone.chest;
    if (chest && !w.areas[w.zoneId].searched) {
      g.fillStyle(0x303e37);
      g.fillRoundedRect(chest.x - 18, 574, 36, 36, 3);
      g.lineStyle(2, 0xc8c590);
      g.strokeRect(chest.x - 18, 574, 36, 36);
      this.art.label("slice-chest", chest.x - 55, 551, `${chest.name} +${chest.value}`, "#d5d4aa", 12);
    }
    for (const e of w.enemies)
      if (!e.dead) {
        const o = organs[e.organ],
          c = parseInt(o.color.slice(1), 16);
        g.fillStyle(c);
        g.fillCircle(e.x + 24, e.y - 17, 7);
        g.lineStyle(2, c, 0.7);
        g.lineBetween(e.x + 15, e.y - 8, e.x + 24, e.y - 17);
        this.art.label(`carrier-${e.id}`, e.x - 49, e.y - e.h / 2 - 28, o.name, o.color, 13);
        const ek = w.hostile.kit(e);
        this.art.label(
          `weapon-${e.id}`,
          e.x - 55,
          e.y - e.h / 2 - 63,
          `${weapons[e.weapon].name.split(" ").at(-1)}${e.secondary ? " / " + secondaries[e.secondary].name.split(" ").at(-1) : ""}`,
          "#f1b899",
          10,
        );
        const facing = e.windup > 0 ? e.chargeDirection : Math.sign(w.player.x - e.x) || 1;
        g.lineStyle(e.weapon === "hammer" ? 7 : 4, 0xdfa884, 0.8);
        g.lineBetween(e.x, e.y, e.x + facing * (e.weapon === "sniper" ? 65 : 35), e.y - 5);
        if (ek.blocking) {
          g.lineStyle(5, 0x91d1eb, 0.8);
          g.lineBetween(e.x + facing * 45, e.y - 30, e.x + facing * 45, e.y + 30);
        }
        if (ek.shield > 0) {
          g.lineStyle(2, 0x91d1eb, 0.7);
          g.strokeCircle(e.x, e.y, e.w / 2 + 9);
        }
        if (Math.hypot(w.player.x - e.x, w.player.y - e.y) < 240)
          this.art.label(
            `ability-${e.id}`,
            e.x - 80,
            e.y + e.h / 2 + 18,
            enemyModuleHints[e.organ],
            "#c7b5a3",
            10,
          );
        this.art.label(
          `hp-${e.id}`,
          e.x - 35,
          e.y - e.h / 2 - 43,
          `${number(e.hp)} / ${number(e.maxHp)}`,
          "#c2c4ad",
          10,
        );
        if (e.spawnGrace > 0) this.art.label(`spawn-${e.id}`, e.x - 22, e.y - 4, "苏醒…", "#e4d2a8", 13);
        if (e.mark > 0) {
          g.lineStyle(2, 0xc8b0ff);
          g.strokeCircle(e.x, e.y, e.w / 2 + 11);
          this.art.label(`marked-${e.id}`, e.x - 22, e.y - 9, "印记", "#eadbff", 12);
        }
        if (e.frozen > 0) {
          g.fillStyle(0x83d6ff, 0.25);
          g.fillRect(e.x - e.w / 2 - 5, e.y - e.h / 2 - 5, e.w + 10, e.h + 10);
          g.lineStyle(2, 0xc5f1ff, 0.8);
          g.strokeRect(e.x - e.w / 2 - 5, e.y - e.h / 2 - 5, e.w + 10, e.h + 10);
        }
        if (e.vulnerable > 0) {
          g.lineStyle(2, 0xff818c);
          g.lineBetween(e.x - 9, e.y - 9, e.x + 9, e.y + 9);
          g.lineBetween(e.x + 9, e.y - 9, e.x - 9, e.y + 9);
        }
        if (e.stun > 0) this.art.label(`stun-${e.id}`, e.x - 18, e.y - 50, "眩晕", "#ffd599", 12);
        if (e.windup > 0) {
          g.lineStyle(2, 0xff8992, 0.65);
          if (["handgun", "rifle", "sniper"].includes(e.weapon)) g.lineBetween(e.x, e.y, e.aimX, e.aimY);
          else {
            g.lineBetween(e.x, e.y + 25, e.x + e.chargeDirection * 170, e.y + 25);
            g.strokeTriangle(
              e.x + e.chargeDirection * 170,
              e.y + 25,
              e.x + e.chargeDirection * 150,
              e.y + 15,
              e.x + e.chargeDirection * 150,
              e.y + 35,
            );
          }
        }
      }
    for (const d of w.drops) {
      const color = parseInt(organs[d.organ].color.slice(1), 16),
        y = d.y + Math.sin(w.time * 4 + d.id) * 3;
      g.fillStyle(color, 0.12);
      g.fillCircle(d.x, y, 20);
      g.lineStyle(2, color);
      g.strokeCircle(d.x, y, 10);
      g.fillStyle(color);
      g.fillCircle(d.x, y, 4);
      this.art.label(
        `drop-${d.id}`,
        Math.min(1130, Math.max(10, d.x - 38)),
        y - 30,
        organs[d.organ].name + ((d.stacks ?? 1) > 1 ? ` ×${d.stacks}` : ""),
        organs[d.organ].color,
        12,
      );
    }
    for (const b of w.beams) {
      g.lineStyle(4, 0xc5a5ff, Math.min(1, b.life * 4));
      g.lineBetween(b.x, b.y, b.tx, b.ty);
    }
    for (const grenade of w.grenades) {
      g.fillStyle(0xedb76c);
      g.fillCircle(grenade.x, grenade.y, 7);
    }
    for (const a of w.areaFlashes) {
      g.lineStyle(2, 0xffd599, a.life * 2);
      g.strokeCircle(a.x, a.y, a.radius * (1 - a.life * 0.4));
    }
    const p = w.player,
      a = w.armory,
      ax = Math.cos(p.aim),
      ay = Math.sin(p.aim);
    if (a.primary === "rifle" || a.primary === "sniper") {
      g.lineStyle(a.primary === "rifle" ? 7 : 4, a.primary === "rifle" ? 0x91b3a2 : 0x97bfcd);
      g.lineBetween(
        p.x + ax * 18,
        p.y + ay * 18,
        p.x + ax * (a.primary === "rifle" ? 50 : 68),
        p.y + ay * (a.primary === "rifle" ? 50 : 68),
      );
    }
    if (a.primary === "hammer") {
      g.lineStyle(5, 0xc6b19a);
      g.lineBetween(p.x, p.y, p.x + ax * 40, p.y + ay * 40);
      g.fillStyle(0x9bafb1);
      g.fillRect(p.x + ax * 40 - 13, p.y + ay * 40 - 16, 26, 32);
    }
    if (a.primary === "dagger") {
      g.lineStyle(4, 0xe1d9bd);
      g.lineBetween(p.x + ax * 15, p.y + ay * 15, p.x + ax * 45, p.y + ay * 45);
    }
    if (a.swing.life > 0) {
      g.lineStyle(a.swing.heavy ? 6 : 3, a.swing.heavy ? 0xffc680 : 0xe8efd4, a.swing.life * 4);
      g.beginPath();
      g.arc(p.x, p.y, a.swing.radius, a.swing.angle - 1, a.swing.angle + 1, false);
      g.strokePath();
    }
    if (a.blocking) {
      g.lineStyle(7, 0x97d9ec, 0.85);
      g.beginPath();
      g.arc(p.x, p.y, 42, p.aim - 1.2, p.aim + 1.2, false);
      g.strokePath();
    }
    if (w.shield > 0) {
      g.lineStyle(2, 0x97d9ec, 0.5);
      g.strokeEllipse(p.x, p.y, 48, 70);
    }
    if (a.charge > 0) {
      g.lineStyle(2, 0xa6d2ec, 0.4 + a.charge * 0.3);
      g.lineBetween(p.x, p.y, p.x + ax * 1000, p.y + ay * 1000);
    }
    if (a.grenadeCharge > 0) {
      const power = 0.5 + a.grenadeCharge / 1.2,
        vx = (Math.max(-360, Math.min(360, mx - p.x)) * power) / 0.65,
        vy = Math.max(-160, Math.min(120, my - p.y)) / 0.65 - 190 * power;
      g.fillStyle(0xffcf8b, 0.8);
      for (let t = 0.06; t <= 0.65; t += 0.06) g.fillCircle(p.x + vx * t, p.y - 10 + vy * t + 290 * t * t, 2);
    }
    for (const u of a.units) {
      g.fillStyle(u.type === "drone" ? 0x83b8c2 : 0xb9b788);
      g.fillRoundedRect(u.x - 15, u.y - 12, 30, 24, 4);
      g.lineStyle(2, 0xd4e5d5);
      g.strokeCircle(u.x, u.y, 8);
      if (u.type === "drone") {
        g.lineBetween(u.x - 25, u.y - 14, u.x + 25, u.y - 14);
        g.lineBetween(u.x, u.y - 22, u.x, u.y + 20);
      } else {
        g.lineBetween(u.x - 12, u.y + 12, u.x - 22, u.y + 23);
        g.lineBetween(u.x + 12, u.y + 12, u.x + 22, u.y + 23);
      }
      this.art.label(
        `unit-${u.id}`,
        u.x - 30,
        u.y - 34,
        `${u.type === "drone" ? "UAV" : "SGT"} ${number(u.hp)}`,
        "#b6d8d6",
        10,
      );
    }
    for (const u of w.hostile.units) {
      g.fillStyle(0xd57e72);
      g.fillRect(u.x - 14, u.y - 12, 28, 24);
      this.art.label(
        `hostile-unit-${u.id}`,
        u.x - 25,
        u.y - 30,
        `${u.type === "drone" ? "敌 UAV" : "敌炮台"} ${Math.ceil(u.hp)}`,
        "#eea798",
        10,
      );
    }
    for (const b of w.hostile.bombs) {
      g.fillStyle(0xff967e);
      g.fillCircle(b.x, b.y, 7);
      g.lineStyle(1, 0xff967e, 0.35);
      g.strokeCircle(b.x, b.y, 135);
    }
    for (const a of w.hostile.warnings) {
      g.lineStyle(3, 0xff7c6e, Math.min(1, a.life * 4));
      g.strokeCircle(a.x, a.y, a.radius);
    }
    const ps = w.hostile.playerStatus;
    if (ps.frozen > 0) {
      g.fillStyle(0x9cdfff, 0.4);
      g.fillRect(w.player.x - 18, w.player.y - 30, 36, 60);
    }
    if (ps.mark > 0) {
      g.lineStyle(2, 0xc7a8ff);
      g.strokeCircle(w.player.x, w.player.y, 37);
    }
    w.ascent?.render(this.art);
    if (this.art.labels.size > 450)
      for (const [key, label] of this.art.labels)
        if (!label.visible) {
          label.destroy();
          this.art.labels.delete(key);
        }
  }
  slotCard(id: OrganId | undefined, index: number, button = false) {
    const tag = button ? "button" : "div",
      info = id ? organs[id] : null;
    return `<${tag} class="slice-slot ${id ? "filled" : ""}" ${button ? `data-action="equip" data-slot="${index}"` : ""} style="--organ:${info?.color ?? "#5e7671"}" title="${info?.description ?? "空槽"}"><small>0${index + 1}</small><b>${info?.name ?? "空槽"}${id ? ` ×${this.world.count(id)}` : ""}</b><span>${id ? stackEffect(id, this.world.count(id)) : "等待接入"}</span>${button && info ? `<p>${info.description}</p>` : ""}</${tag}>`;
  }
  refreshHUD() {
    const w = this.world,
      p = w.player,
      n = w.nearby(),
      t = `${Math.floor(w.time / 60)
        .toString()
        .padStart(2, "0")}:${Math.floor(w.time % 60)
        .toString()
        .padStart(2, "0")}`;
    const a = w.armory;
    const target = w.ascent ? nextBuildTarget(w, w.ascent.trackedBuild) : null;
    const guide = w.ascent
      ? `<div class="build-tracker">${w.ascent.trackedBuild ? `<b>${fieldBuilds[w.ascent.trackedBuild].name}</b><br>${target ? `${target.y < p.y - 80 ? "↑" : target.y > p.y + 80 ? "↓" : target.x < p.x ? "←" : "→"} ${organs[target.organ].name} · ${target.label}` : "核心组合已齐 / 当前无可获取来源"}` : "R 推荐 build · 选择猎取目标"}</div>`
      : "";
    const weaponStatus =
      a.primary === "sniper"
        ? `蓄力 ${Math.round((a.charge / 1.3) * 100)}% · 松开释放`
        : a.primary === "rifle"
          ? w.overheated
            ? "过热锁定 · 散热中"
            : w.heat >= 60
              ? "高热：每发重击"
              : "持续开火进入高热"
          : a.primary === "dagger"
            ? `${a.rhythmFeedback} · +${a.rhythmStacks * 20}% · 节拍 ${a.rhythmRemaining.toFixed(2)}s`
            : a.primary === "hammer"
              ? `连段 ${a.combo + 1}/3 · 第三段重击`
              : `${"▰".repeat(w.ammo)}${"▱".repeat(5 - w.ammo)} 第五发重击`;
    this.hud.innerHTML = `<header class="slice-top"><div><b>永蚀<span>EVER ECLIPSE</span></b><small>${w.training ? (w.unlimited ? "无限槽训练 / 0.9" : "六槽训练 / 0.9") : w.unlimited ? "无限收集 / 0.9" : "六槽探索 / 0.9"}</small></div><div class="slice-cargo">${w.training ? "累计击杀" : "携带样本"} <strong>${w.training ? w.stats.kills : w.cargo}</strong><small>${w.training ? "B 训练台 · 1–9 武器" : "死亡全部丢失"}</small></div><div class="slice-clock">${t}<small>${this.synth.muted ? "声音关闭" : "M 静音"} · Esc 暂停</small></div></header>
      <div class="slice-zone"><small>${w.ascent ? "沉井 → 地表 / 上行探索" : w.zone.subtitle}</small><h2>${w.training ? `第 ${w.wave} 波 · 持续增压` : (w.ascent?.title ?? w.zone.name)}</h2><span>${w.training ? `敌人生命 ×${number(w.enemyHealthScale())} · 场上 ${w.enemies.filter((e) => !e.dead).length}` : w.ascent ? `已上行 ${Math.max(0, Math.round((3096 - p.y) / 40))}m · Tab 剖面地图` : w.zone.risk ? "危险 " + "◆".repeat(w.zone.risk) : "安全区"}</span><p class="combat-readout">5 秒 DPS <b>${number(w.dps)}</b><br>撞墙 ${w.metrics.wallCharges} · 传导 ${w.metrics.transmissions}<br>冻结 ${w.metrics.freezes} · 碎冰 ${w.metrics.shatters}${w.unlimited ? `<br>异变等级 ${w.ascent?.pressure ?? 0} · 增援 ${w.ascent?.reinforcements ?? 0}<br>新生敌人生命 ×${w.ascent?.healthScale.toFixed(1)} / 伤害 ×${w.ascent?.damageScale.toFixed(1)}` : ""}</p></div>
      ${guide}<div class="slice-vitals"><div>生命 <b>${Math.ceil(p.hp)} / ${p.maxHp} ${w.shield > 0 ? `＋盾 ${number(w.shield)}` : ""}</b></div><div class="slice-health"><i style="width:${(p.hp / p.maxHp) * 100}%"></i></div><div>充能 <b>${w.energy} / ${w.energyMax}</b></div><small>体质 ${w.vitalityLevel} · 下一级 ${6 - (w.collectedLayers % 6)} 层 · 回生膜 +${10 * w.count("leech")} 生命</small><small>体力 ${Math.round(w.stamina)} / 100　热量 ${Math.round(w.heat)} / 100</small><div class="resource-meter"><i style="width:${w.heat}%;background:${w.overheated ? "#ff687d" : "#d5a86b"}"></i></div><small>${weapons[a.primary].name}</small><small>${weaponStatus}</small><small>${secondaries[a.secondary].name} · ${w.grenadeCooldown > 0 ? w.grenadeCooldown.toFixed(1) + "s" : "就绪"}</small><small>H 治疗 ×${w.medkits} ${a.secondary === "drone" ? ` · 无人机储备 ${a.droneStock}` : ""}</small></div>
      <div class="slice-message">${w.messageTime > 0 ? escape(w.message) : ""}</div><div class="slice-prompt">${n?.label ?? ""}</div>
      <footer class="slice-bottom">${w.unlimited ? `<div class="collection-count">${w.slots.length} 种 · ${w.totalLayers} 层 · 靠近自动接入 · B 查看全部效果</div>` : ""}<div class="slice-slots ${w.unlimited ? "unlimited-slots" : ""}">${Array.from({ length: w.unlimited ? Math.max(1, w.slots.length) : 6 }, (_, i) => this.slotCard(w.slots[i], i)).join("")}</div><div class="slice-controls">A D 移动 · Space 跳 · Shift 冲刺 · F 下砸 | 左键主武器 · Q 副武器 · 右键盾 · H 治疗 | 1–9 换武器 · B 配装台 · E 接入</div></footer>`;
  }
  panel(body: string, wide = false) {
    return `<section class="slice-panel ${wide ? "wide" : ""}">${body}</section>`;
  }
  mapHTML() {
    if (this.world.ascent) return this.panel(this.world.ascent.mapHTML(), true);
    const positions: Record<string, [number, number]> = {
      hub: [0, 1],
      west: [1, 0],
      forge: [2, 0],
      junction: [3, 1],
      core: [4, 1],
      east: [1, 2],
      choir: [2, 2],
    };
    const lines =
      '<path d="M90 140 L295 40 L500 40 L705 140 L910 140 M90 140 L295 240 L500 240 L705 140" fill="none" stroke="#668875" stroke-width="2" />';
    const shortcut = `<path d="M90 140 L705 140" fill="none" stroke="${this.world.shortcut ? "#c7c197" : "#526354"}" stroke-width="2" stroke-dasharray="6 7"/><text x="395" y="130" text-anchor="middle" fill="#a1af91" font-size="11">${this.world.shortcut ? "运输捷径已修复" : "运输捷径 · 尚未修复"}</text>`;
    const nodes = Object.entries(positions)
      .map(([id, [col, row]]) => {
        const z = zones[id];
        return `<div class="slice-map-node ${id === this.world.zoneId ? "current" : ""}" style="left:${col * 20.5}%;top:${((row * 100) / 280) * 100}%"><small>${id === this.world.zoneId ? "你在这里" : this.world.visited.has(id) ? "已探索" : "未探索"} · ${z.risk ? "◆".repeat(z.risk) : "安全"}</small><b>${z.name}</b><span>${[...new Set(z.spawns.map((s) => organs[s.organ].name))].join(" / ") || "可随时撤离"}</span></div>`;
      })
      .join("");
    return this.panel(
      `<div class="slice-eyebrow">固定地图 / 当前暂停</div><h1>决定下一步。</h1><p>西线沿墙作战，东线利用群体。两路在运输枢纽交汇，可以绕另一侧返回。</p><div class="slice-map-canvas"><svg viewBox="0 0 1000 280" preserveAspectRatio="none" aria-hidden="true">${lines}${shortcut}</svg>${nodes}</div><p class="slice-muted">切换区域需走近对应门按 E。母巢不是撤离条件。<br>气闸 ↔ 枢纽捷径：${this.world.shortcut ? "已修复" : "把枢纽的运输回路图活着带回后修复"}。</p><div class="slice-equipped">${this.world.slots.map((id) => `<div><b style="color:${organs[id].color}">${organs[id].name}</b><span>${organs[id].description}</span></div>`).join("") || "六槽尚未接入模块。击杀标有器官名称的敌人，靠近掉落按 E。"}</div><button class="slice-primary" data-action="resume">返回猎场 <span>Tab / Esc</span></button>`,
      true,
    );
  }
  refreshOverlay() {
    const w = this.world;
    const state = !this.started
      ? "intro"
      : w.result
        ? w.result
        : w.pendingDrop
          ? `drop-${w.pendingDrop.id}`
          : this.guideOpen
            ? "guide"
            : this.benchOpen
              ? "bench"
              : this.mapOpen
                ? "map"
                : this.helpOpen
                  ? "help"
                  : this.paused
                    ? "pause"
                    : "";
    // Visibility must update even when a handler has invalidated the cached signature to "".
    this.overlay.hidden = !state;
    if (state === this.overlayKey) return;
    this.overlayKey = state;
    if (!state) return;
    if (state === "intro") {
      this.overlay.innerHTML = this.panel(
        `<div class="slice-eyebrow">EVER ECLIPSE / UNLIMITED 08</div><h1 class="slice-title">永蚀<span>器官猎场</span></h1><p class="slice-lead">猎取敌人的能力。<br>拼出你的组合，决定何时带它们回家。</p><div class="slice-intro-grid"><div><small>01 / 猎取</small><b>看清携带者</b><p>敌人头顶标出器官。击杀后按 E 查看，接入六个槽位。</p></div><div><small>02 / 组合</small><b>改变战斗方式</b><p>撞墙积攒充能，或用印记连接敌群。同类靠近自动叠层。无限版可同时接入所有类型；六槽版保留取舍。</p></div><div><small>03 / 撤离</small><b>活着带回收获</b><p>任何时候都能返回气闸。死亡丢失本局收获；从上方接通升降台，缩短回程。</p></div></div><button class="slice-primary" data-action="start-unlimited">无限收集 · 进入沉井<span>∞</span></button><button class="slice-secondary" data-action="start-six">六槽探索 · 对照版本<span>↑</span></button><p class="slice-muted">无限版：所有地面器官靠近自动接入，包含有代价的模块；本地增援持续掉落 28 种模块，随收集与时间变强。六槽版：仅已装的同类自动拾取。</p><button class="slice-secondary" data-action="train-unlimited">无尽训练 · 无限槽<span>∞</span></button><button class="slice-secondary" data-action="train">无尽训练 · 六槽<span>↗</span></button><p class="slice-muted">A D 移动 · Space 跳跃 · 左键射击 · Shift 冲刺 · E 交互 · Tab 地图 · R 推荐 build<br>九件武器 · R 推荐 build · B 武器配装台 · 当前档案：${this.save.research.length}/${organIds.length} 器官 · 已带回 ${this.save.bank} 样本 · 上方通电解锁本趟升降台</p>${this.interrupted ? '<p class="slice-notice">上一趟出行中断，未结算收获已丢失。已带回的进度仍保留。</p>' : ""}<p class="slice-notice">${this.storageWarning}</p><a class="slice-legacy" href="?legacy">旧版房宿灰盒 ↗</a>`,
        true,
      );
    } else if (w.result && w.training) {
      this.overlay.innerHTML = this.panel(
        `<div class="slice-eyebrow">TRAINING REPORT</div><h1>第 ${w.wave} 波 · 训练结束</h1><p>击杀 ${w.stats.kills} · 累计伤害 ${number(w.metrics.dealt)} · 冻结 ${w.metrics.freezes} · 碎冰 ${w.metrics.shatters}<br>你的武器和叠层保留，可以调整配置后继续打。</p><div class="slice-actions"><button class="slice-primary" data-action="revive">保留构筑继续训练</button><button class="slice-secondary" data-action="bench">调整配置再战</button><button class="slice-secondary" data-action="train">重新开始训练</button><button class="slice-secondary" data-action="export">导出训练记录</button></div>`,
        true,
      );
    } else if (w.result) {
      const win = w.result === "extracted",
        m = w.metrics;
      this.overlay.innerHTML = this.panel(
        `<div class="slice-eyebrow">${win ? "EXTRACTION COMPLETE" : "SIGNAL LOST"}</div><h1>${win ? "带回来了。" : "这次，没能回来。"}</h1><p>${win ? `本次带回 ${this.lastReward} 样本，已接入的器官记入研究档案。下次六槽重新开始。` : `本局 ${w.cargo} 样本与器官已失去，之前带回的进度保留。`}</p>${win && w.relay ? '<p class="slice-notice">运输回路图已归档：下一趟可从气闸直达运输枢纽。</p>' : ""}<div class="slice-results"><div><b>${Math.floor(w.time / 60)}:${Math.floor(
          w.time % 60,
        )
          .toString()
          .padStart(
            2,
            "0",
          )}</b><span>出行时间</span></div><div><b>${w.stats.kills}</b><span>击杀</span></div><div><b>${m.wallCharges} / ${m.chargedHits}</b><span>撞墙充能 / 放电命中</span></div><div><b>${m.transmissions} / ${m.spreads}</b><span>传导 / 传播目标</span></div><div><b>${m.swaps}</b><span>六槽替换</span></div></div><p class="slice-muted">路线：${w.log
          .filter((e) => e.event === "route" || e.event === "district")
          .map((e) =>
            e.event === "district"
              ? districts.find((d) => d.id === e.detail)?.name
              : zones[e.detail.split(";")[0]]?.name,
          )
          .join(
            " → ",
          )}<br>当前档案 ${this.save.research.length}/${organIds.length} · 累计带回 ${this.save.bank} 样本（本轮用作收益记录，尚无商店）</p><label class="slice-feedback-label" for="slice-feedback">这次为什么撤离 / 死亡？哪个模块改变了打法？还想再来一局吗？</label><textarea id="slice-feedback" placeholder="记录你的真实感受；导出时与路线、触发次数一起保存。"></textarea><div class="slice-actions"><button class="slice-primary" data-action="start">再出发 <span>↗</span></button><button class="slice-secondary" data-action="export">导出本局试玩记录</button></div><p class="slice-notice">${this.storageWarning}</p>`,
        true,
      );
    } else if (w.pendingDrop) {
      const o = organs[w.pendingDrop.organ],
        duplicate = w.has(w.pendingDrop.organ);
      this.overlay.innerHTML = this.panel(
        `<div class="slice-eyebrow">器官接入 / 当前暂停</div><h1 style="color:${o.color}">${o.name}</h1><p class="slice-lead">${o.tag}</p><p>${o.description}</p><p class="slice-muted">${duplicate ? "同类器官叠加效果，不占用新槽位。" : w.slots.length < w.slotLimit ? "接入空槽后立即生效，本次出行内有效。" : "六槽已满。选择一个器官替换，被换下的器官会留在地面。"}</p>${duplicate ? `<button class="slice-primary" data-action="equip" data-slot="0">叠加到 ×${w.count(w.pendingDrop.organ) + (w.pendingDrop.stacks ?? 1)}</button>` : w.slots.length < w.slotLimit ? `<button class="slice-primary" data-action="equip" data-slot="${w.slots.length}">接入第 ${w.slots.length + 1} 槽 <span>＋</span></button>` : `<div class="slice-swap-grid">${w.slots.map((id, i) => this.slotCard(id, i, true)).join("")}</div>`}<button class="slice-secondary" data-action="skip">暂时留下 / 返回 <span>Esc</span></button>`,
        true,
      );
    } else if (state === "guide") this.overlay.innerHTML = this.panel(guideHTML(w), true);
    else if (state === "bench") this.overlay.innerHTML = this.panel(trainingPanel(w, this.benchStacks), true);
    else if (state === "map") this.overlay.innerHTML = this.mapHTML();
    else if (state === "help")
      this.overlay.innerHTML = this.panel(
        `<div class="slice-eyebrow">战地手册 / 当前暂停</div><h1>把组合打出来。</h1><p>1–5 切换手炮、热负荷步枪、贯穿狙击、节律匕首、重锤。鼠标瞄准，左键攻击；狙击按住蓄力松开射击，匕首跟随 HUD 节拍点按。</p><p>西线：冲撞腺让 Shift 撞人 → 压电骨从撞墙得到充能 → 放电髓强化第五发。Q 手雷也能帮助撞墙。</p><p>东线：刻印眼连续三击挂印 → 共鸣索把伤害传给其他印记目标 → 播种囊让印记从死亡目标向外扩散。</p><p>6–9 切换盾、手雷、无人机、炮台。盾按住右键；其余按 Q，手雷松开时投掷。H 治疗；Space 跳跃，S 下落，F 空中下砸。B 打开配装台；训练场 Tab 也打开训练台，探索时 Tab 查看地图。</p><p>去母巢不是撤离条件。回到底部沉井气闸，按住 E 两秒即可结算。中庭和货运站的开关开启本次出行的实体升降台；R 查看推荐组合和来源。</p><button class="slice-primary" data-action="resume">返回猎场</button>`,
      );
    else
      this.overlay.innerHTML = this.panel(
        `<div class="slice-eyebrow">EXPEDITION PAUSED</div><h1>已暂停。</h1><p>本次收获 ${w.cargo} 样本。刷新或关闭页面会丢失未结算收获；成功撤离可保存。</p><button class="slice-primary" data-action="resume">继续 <span>Esc</span></button><div class="slice-actions"><button class="slice-secondary" data-action="map">猎取地图与模块说明</button><button class="slice-secondary" data-action="bench">训练与配装台</button><button class="slice-secondary" data-action="help">战地手册</button><button class="slice-secondary" data-action="export">导出当前记录</button></div>`,
      );
  }
}
