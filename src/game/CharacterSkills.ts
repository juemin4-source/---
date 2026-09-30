import type { SliceWorld } from "./SliceWorld";
import type { CampaignProgress } from "./meta/CampaignProgress";
import type { Renderer } from "../engine/Renderer";
import { distance } from "../engine/PhysicsHelpers";
export interface EchoAction {
  at: number;
  kind: "shot" | "melee";
  damage: number;
  heavy: boolean;
  range: number;
  angle: number;
  piercing: boolean;
}
export class CharacterSkills {
  hero: CampaignProgress["hero"] = "meng";
  partner: CampaignProgress["partner"] = "none";
  branch: CampaignProgress["trees"]["meng"] = null;
  level = 0;
  cooldown = 0;
  supportCooldown = 0;
  active = 0;
  recording = false;
  replaying = false;
  overflow = 0;
  uses = 0;
  haste = 0;
  field: { x: number; y: number; life: number } | null = null;
  moon: { life: number; lost: number } | null = null;
  echo: EchoAction[] = [];
  playback: EchoAction[] = [];
  private elapsed = 0;
  private replayClock = 0;
  private overheatCredited = false;
  private summons: { id: number; expires: number }[] = [];
  constructor(private w: SliceWorld) {}
  configure(p: CampaignProgress) {
    this.hero = p.hero;
    this.partner = p.partner;
    this.branch = p.trees[p.hero];
    this.level = p.skillLevel[p.hero];
  }
  get burning() {
    return this.hero === "rabbit" && this.active > 0;
  }
  get speed() {
    return this.haste > 0 ? 1.3 : 1;
  }
  get move() {
    return this.haste > 0 ? 1.25 : 1;
  }
  get damage() {
    return this.burning
      ? 1 +
          Math.min(
            this.branch === "force" ? 1 : 0.75,
            this.overflow * (this.branch === "force" ? 0.015 : 0.01),
          )
      : 1;
  }
  get protection() {
    return this.field && distance(this.field, this.w.player) < 180 ? 0.65 : 1;
  }
  activate() {
    if (this.w.result) return;
    if (this.hero === "meng" && this.recording) {
      this.play();
      return;
    }
    if (this.cooldown > 0) {
      this.w.say(`技能冷却 ${Math.ceil(this.cooldown)} 秒`);
      return;
    }
    this.cooldown = (24 - this.level * 3) * (this.branch === "flow" ? 0.75 : 1);
    this.active = (this.hero === "meng" ? 6 : 8) + this.level + (this.branch === "growth" ? 3 : 0);
    this.overflow = 0;
    this.overheatCredited = false;
    if (this.hero === "meng") {
      this.recording = true;
      this.echo = [];
      this.elapsed = 0;
      this.w.say("回响记录中 · 再按 G 复演，或窗口结束自动复演");
    } else {
      this.w.overheated = false;
      this.w.say("三昧真火 · 过热不停火，溢出热量转伤害");
    }
    this.w.record("skill_start", this.hero);
  }
  capture(action: Omit<EchoAction, "at">) {
    if (this.recording && !this.replaying && this.echo.length < 80)
      this.echo.push({ ...action, at: this.elapsed });
  }
  private play() {
    this.recording = false;
    this.active = 0;
    this.playback = this.echo.map((e) => ({ ...e }));
    this.replayClock = 0;
    if (this.playback.length) {
      this.uses++;
      this.w.record("skill_complete", "meng");
    }
    this.echo = [];
    this.w.say(`回响复演 · ${this.playback.length} 个动作`);
  }
  addHeat(amount: number) {
    if (this.burning) {
      this.overflow += Math.max(0, this.w.heat + amount - 100);
      if (this.overflow > 0 && !this.overheatCredited) {
        this.uses++;
        this.overheatCredited = true;
      }
    }
    this.w.heat = Math.min(100, this.w.heat + amount);
  }
  support() {
    if (this.partner === "none" || this.supportCooldown > 0 || this.w.result) return;
    this.supportCooldown = 28;
    const w = this.w;
    if (this.partner === "cheng") {
      const id = w.armory.nextUnit++;
      w.armory.units.push({
        id,
        type: "turret",
        x: w.player.x,
        y: w.player.y + 7,
        hp: 100,
        cooldown: 0,
        invulnerable: 0,
      });
      this.summons.push({ id, expires: w.time + 12 });
    }
    if (this.partner === "qiao") this.haste = 6;
    if (this.partner === "lu") this.field = { x: w.player.x, y: w.player.y, life: 8 };
    if (this.partner === "du") this.moon = { life: 6, lost: 0 };
    w.record("support", this.partner);
    w.say("支援技能已发动");
  }
  update(dt: number) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.supportCooldown = Math.max(0, this.supportCooldown - dt);
    this.haste = Math.max(0, this.haste - dt);
    if (this.active > 0) {
      this.active = Math.max(0, this.active - dt);
      this.elapsed += dt;
      if (!this.active && this.recording) this.play();
    }
    if (this.playback.length) {
      this.replayClock += dt;
      while (this.playback[0] && this.playback[0].at <= this.replayClock) {
        const e = this.playback.shift()!;
        const aim = this.w.player.aim;
        this.replaying = true;
        this.w.player.aim = e.angle;
        const damage = e.damage * (this.branch === "force" ? 1.2 : 0.8);
        if (e.kind === "shot") this.w.armory.shoot(damage, e.heavy, e.piercing);
        else this.w.armory.melee(damage, e.heavy, e.range);
        this.w.player.aim = aim;
        this.replaying = false;
      }
    }
    if (this.field && (this.field.life -= dt) <= 0) this.field = null;
    if (this.moon && (this.moon.life -= dt) <= 0) {
      this.w.recover(this.moon.lost * 0.6);
      this.moon = null;
    }
    for (const s of this.summons)
      if (s.expires <= this.w.time) this.w.armory.units = this.w.armory.units.filter((u) => u.id !== s.id);
    this.summons = this.summons.filter((s) => s.expires > this.w.time);
  }
  render(art: Renderer) {
    const g = art.g,
      p = this.w.player;
    if (this.field) {
      g.fillStyle(0x9bc2b4, 0.09);
      g.fillCircle(this.field.x, this.field.y, 180);
      g.lineStyle(2, 0x9bc2b4, 0.55);
      g.strokeCircle(this.field.x, this.field.y, 180);
    }
    if (this.active || this.moon || this.haste) {
      g.lineStyle(2, this.burning ? 0xe99868 : 0x98bad9, 0.8);
      g.strokeCircle(p.x, p.y, 36);
    }
  }
}
