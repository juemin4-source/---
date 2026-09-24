import { nextBuildTarget } from "./BuildGuide";
import { organs, organIds } from "./config";
import { distance, clamp, type Rect } from "../engine/PhysicsHelpers";
import type { Controls } from "../engine/Player";
import type { Renderer } from "../engine/Renderer";
import type { SliceWorld, Carrier } from "./SliceWorld";
import {
  ascentPlatforms,
  ascentSize,
  districts,
  habitats,
  sites,
  type Habitat,
  type Site,
} from "./AscentMap";

export class Ascent {
  awakened = new Set<number>();
  opened = new Set<string>();
  discovered = new Set<string>();
  homes = new Map<number, Habitat>();
  pressure = 0;
  reinforcements = 0;
  nextIncursion = 24;
  spawnSerial = 0;
  trackedBuild = "";
  riding = "";
  district = "";
  lifts = [
    { id: "lift-low", x: 1480, top: 1860, bottom: 3120, y: 1860, target: 1860, unlocked: false },
    { id: "lift-high", x: 1640, top: 1020, bottom: 1860, y: 1020, target: 1020, unlocked: false },
  ];
  liftPlatforms: Rect[] = [];
  constructor(
    public w: SliceWorld,
    private make: (h: Habitat) => Carrier,
  ) {
    w.width = ascentSize.width;
    w.height = ascentSize.height;
    w.platforms = ascentPlatforms.map((p) => ({ ...p }));
    w.enemies = habitats.map((h) => {
      const e = make(h);
      this.homes.set(e.id, h);
      if (w.unlimited) this.scaleEnemy(e);
      return e;
    });
    w.player.x = 1500;
    w.player.y = 3096;
    w.player.boundsWidth = w.width;
    w.drops = [];
    w.visited.clear();
    w.log = [];
    for (const lift of this.lifts) {
      const p = { x: lift.x, y: lift.y + 8, w: 130, h: 16, oneWay: true };
      this.liftPlatforms.push(p);
      w.platforms.push(p);
    }
    w.say("从沉井向上 · 左泵房 / 右根室 · Tab 查看实地地图");
  }
  get healthScale() {
    return Math.min(500, 1.35 * 1.32 ** this.pressure);
  }
  get damageScale() {
    return Math.min(4, 1.1 + 0.12 * this.pressure);
  }
  scaleEnemy(e: Carrier) {
    e.hp = e.maxHp = Math.round(e.maxHp * this.healthScale);
    e.damageFactor = this.damageScale;
  }
  incursion() {
    const w = this.w;
    if (!w.unlimited || w.player.y > 2820 || this.area?.id === "rest" || this.riding) return 0;
    const anchors = habitats.filter(
      (h) =>
        h.kind !== "elite" &&
        !h.nest &&
        Math.abs(h.floor - 24 - w.player.y) < 220 &&
        Math.abs(h.x - w.player.x) >= 200 &&
        Math.abs(h.x - w.player.x) < 850,
    );
    const room = 36 - w.enemies.filter((e) => !e.dead).length;
    if (!anchors.length || room <= 0) return 0;
    const count = Math.min(room, 2 + Math.floor(this.pressure / 3), 6);
    for (let i = 0; i < count; i++) {
      const anchor = anchors[(this.spawnSerial + i) % anchors.length];
      const serial = this.spawnSerial++,
        h = {
          ...anchor,
          id: `incursion-${serial}`,
          organ: organIds[serial % organIds.length],
          nest: undefined,
          x: anchor.x + (i % 2 ? 32 : -32),
          hp: anchor.hp * (1 + 0.1 * Math.floor(this.reinforcements / 3)),
        };
      const e = this.make(h);
      this.scaleEnemy(e);
      e.spawnGrace = 1.5;
      this.homes.set(e.id, h);
      w.enemies.push(e);
    }
    this.reinforcements++;
    w.record("incursion", `${this.reinforcements};pressure=${this.pressure};count=${count}`);
    w.say(`异变增援 ${this.reinforcements} · ${count} 只 · 新生敌人生命 ×${this.healthScale.toFixed(1)}`);
    return count;
  }
  get area() {
    return districts.find(
      (d) =>
        this.w.player.x > d.x &&
        this.w.player.x < d.x + d.w &&
        this.w.player.y > d.y &&
        this.w.player.y < d.y + d.h,
    );
  }
  get title() {
    return this.area?.name ?? "上行检修井";
  }
  ground(x: number, y: number) {
    return Math.min(
      ...this.w.platforms
        .filter((p) => Math.abs(p.x - x) < p.w / 2 && p.y - p.h / 2 >= y - 12)
        .map((p) => p.y - p.h / 2),
      3120,
    );
  }
  nearby() {
    const w = this.w,
      p = w.player;
    const lift = this.lifts.find(
      (l) => l.unlocked && Math.abs(p.x - l.x) < 90 && Math.abs(p.y - (l.y - 24)) < 70,
    );
    if (lift)
      return {
        type: "site" as const,
        site: {
          id: lift.id + "-ride",
          name: "升降台",
          x: lift.x,
          y: lift.y,
          kind: "lift" as const,
          value: 0,
          note: "",
        },
        label: `E 乘升降台${lift.y < (lift.top + lift.bottom) / 2 ? "下行" : "上行"} · 移动/跳跃可离开`,
      };
    const site = sites.find((s) => !this.opened.has(s.id) && distance(s, p) < 65);
    if (site)
      return {
        type: "site" as const,
        site,
        label: `E ${site.name} · ${site.kind === "core" && w.enemies.some((e) => e.kind === "elite" && !e.dead) ? "母体仍在守护" : site.note}`,
      };
    const drop = w.drops
      .filter((d) => distance(d, p) < 75)
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (drop) return { type: "drop" as const, drop, label: "E 接入地面器官" };
    if (distance(p, { x: 900, y: 3096 }) < 110)
      return { type: "exit" as const, label: "按住 E 两秒 · 从沉井气闸撤离" };
    return null;
  }
  use(site: Site) {
    const w = this.w;
    if (site.id.endsWith("-ride")) {
      const lift = this.lifts.find((l) => site.id === l.id + "-ride")!;
      lift.target = lift.y < (lift.top + lift.bottom) / 2 ? lift.bottom : lift.top;
      this.riding = lift.id;
      w.player.x = lift.x;
      w.player.vx = 0;
      return;
    }
    if (this.opened.has(site.id)) return;
    if (site.kind === "core" && w.enemies.some((e) => e.kind === "elite" && !e.dead)) {
      w.say("核心被母体包裹 · 击败母体后取得");
      return;
    }
    this.opened.add(site.id);
    w.cargo += site.value;
    w.record("site", site.id);
    w.metrics.decisions++;
    if (site.kind === "medical") {
      w.medkits = Math.min(8, w.medkits + 1);
      w.recover(35);
      w.say("补给已用 · 恢复 35 生命 / 医疗针 +1");
    } else if (site.kind === "lift") {
      this.lifts.find((l) => l.id === site.id)!.unlocked = true;
      w.say("升降台已通电 · 站到平台旁按 E 乘坐；本次出行内可往返");
    } else {
      w.say(`${site.name} · 样本 +${site.value}${site.id === "glass-cache" ? " · 守卫苏醒！" : ""}`);
      if (site.organ) {
        const d = { id: w.nextDrop++, x: site.x, y: site.y, organ: site.organ };
        w.drops.push(d);
        w.pendingDrop = d;
        if (w.has(d.organ) || w.unlimited) w.equip();
      }
    }
    if (site.id === "glass-cache")
      for (const e of w.enemies) if (this.homes.get(e.id)?.nest === site.id) e.spawnGrace = 1;
  }
  beforeEnemy(e: Carrier) {
    const h = this.homes.get(e.id);
    if (!h) return true;
    if (h.nest && !this.opened.has(h.nest) && !this.awakened.has(e.id)) return false;
    // Unengaged habitats stay asleep; no offscreen fights, falling mobs, or aggro through floors.
    const vertical = Math.abs(this.w.player.y - e.y);
    if (distance(this.w.player, e) > 900 && e.pushed <= 0) return false;
    if (vertical > 240 && e.windup <= 0 && e.charge <= 0 && e.pushed <= 0) {
      e.cooldown = Math.max(e.cooldown, 0.4);
      return false;
    }
    return true;
  }
  afterEnemy(e: Carrier) {
    const h = this.homes.get(e.id);
    if (!h) return;
    if (e.pushed <= 0 && e.aggro <= 0 && Math.abs(e.x - h.x) > h.patrol) {
      e.vx = 0;
    }
  }
  update(dt: number, c: Controls) {
    const w = this.w,
      area = this.area;
    if (w.unlimited) {
      this.pressure = Math.min(
        40,
        Math.max(this.pressure, Math.floor(w.collectedLayers / 6) + Math.floor(w.time / 90)),
      );
      if (w.time >= this.nextIncursion) {
        this.incursion();
        this.nextIncursion = w.time + Math.max(12, 24 - this.pressure);
      }
      w.enemies = w.enemies.filter((e) => {
        const h = this.homes.get(e.id);
        if (e.dead && h?.id.startsWith("incursion-")) {
          this.homes.delete(e.id);
          this.awakened.delete(e.id);
          return false;
        }
        return true;
      });
    }
    if (area && area.id !== this.district) {
      this.district = area.id;
      this.discovered.add(area.id);
      w.record("district", area.id);
      w.say(`${area.name} · ${area.note}`);
    }
    if (c.jump || c.left || c.right || c.dash) this.riding = "";
    this.lifts.forEach((l, i) => {
      if (!l.unlocked) return;
      l.y += clamp(l.target - l.y, -300 * dt, 300 * dt);
      this.liftPlatforms[i].y = l.y + 8;
      if (this.riding === l.id) {
        w.player.x = l.x;
        w.player.y = l.y - 24;
        w.player.vy = 0;
        w.player.vx = 0;
        w.player.grounded = true;
        if (l.y === l.target) this.riding = "";
      }
    });
  }
  render(art: Renderer) {
    const g = art.g;
    for (const d of districts) {
      g.fillStyle(d.color, 0.055);
      g.fillRect(d.x, d.y, d.w, d.h);
      g.lineStyle(2, d.color, 0.4);
      g.strokeRect(d.x, d.y, d.w, d.h);
      art.label("district-" + d.id, d.x + 20, d.y + 22, d.name, "#91aaa2", 26);
      art.label("district-note-" + d.id, d.x + 22, d.y + 59, d.note, "#76918b", 12);
      // Local machinery and root silhouettes anchor each habitat visually.
      if (["pump", "forge", "cold"].includes(d.id)) {
        g.lineStyle(9, d.color, 0.22);
        g.strokeCircle(d.x + 240, d.y + 190, 90);
        g.lineBetween(d.x + 40, d.y + 190, d.x + 440, d.y + 190);
      }
      if (["roots", "colony", "glass"].includes(d.id))
        for (let i = 0; i < 6; i++) {
          g.lineStyle(7, d.color, 0.23);
          g.lineBetween(d.x + 90 + i * 150, d.y + 100, d.x + 130 + i * 150, d.y + d.h);
          g.strokeCircle(d.x + 90 + i * 150, d.y + 150, 30);
        }
    }
    g.lineStyle(2, 0x82b8a3, 0.3);
    g.lineBetween(1480, 1020, 1480, 3120);
    g.lineBetween(1640, 1020, 1640, 3120);
    for (const site of sites) {
      const done = this.opened.has(site.id),
        color = site.kind === "medical" ? 0x8cc8ac : site.kind === "lift" ? 0x83bbda : 0xe7bb79;
      g.fillStyle(color, done ? 0.12 : 0.6);
      g.fillRoundedRect(site.x - 17, site.y - 12, 34, 32, 4);
      g.lineStyle(2, color, 0.7);
      g.strokeRect(site.x - 17, site.y - 12, 34, 32);
      if (distance(site, this.w.player) < 600)
        art.label(
          "site-" + site.id,
          site.x - 60,
          site.y - 40,
          `${done ? "✓ " : ""}${site.name}`,
          done ? "#66847a" : "#decc9f",
          12,
        );
    }
    for (const l of this.lifts) {
      g.fillStyle(l.unlocked ? 0x88c4a8 : 0x455760);
      g.fillRect(l.x - 65, l.y, 130, 10);
      if (l.unlocked) art.label("lift-" + l.id, l.x - 65, l.y - 62, "E 乘升降台 ↕", "#b8dfc9", 12);
    }
    for (const e of this.w.enemies) {
      const h = this.homes.get(e.id);
      if (!e.dead && h?.nest && !this.opened.has(h.nest) && !this.awakened.has(e.id))
        art.label("nest-" + e.id, e.x - 35, e.y - 75, "休眠守卫", "#c5b68d", 12);
    }
    g.lineStyle(3, 0x9cdec1);
    g.strokeRect(820, 3020, 160, 100);
    art.label("ascent-exit", 800, 2990, "沉井气闸 · 按住 E 撤离", "#b7dfc9", 15);
    if (this.w.extraction > 0) {
      g.fillStyle(0xb7dfc9);
      g.fillRect(820, 3110, 160 * Math.min(1, this.w.extraction / 2), 8);
    }
    const target = nextBuildTarget(this.w, this.trackedBuild);
    if (target) {
      g.lineStyle(3, 0xf3d587, 0.9);
      g.strokeCircle(target.x, target.y, 37);
      art.label(
        "tracked-target",
        target.x - 85,
        target.y - 70,
        `目标：${organs[target.organ].name}`,
        "#f3d587",
        14,
      );
    }
    // A distant light source becomes a destination, not a fullscreen overlay.
    g.lineStyle(2, 0xf1d3a0, 0.35);
    g.strokeCircle(1500, 310, 95);
    art.label("surface-light", 1420, 185, "↑ 地表天光", "#e0c29a", 20);
  }
  mapHTML() {
    const w = this.w;
    return `<div class="slice-eyebrow">泵站剖面 / 固定手工地图 · 当前暂停</div><h1>从沉井向上。</h1><button class="slice-secondary" data-action="recommend">推荐 build · R</button><div class="ascent-map-layout"><svg class="ascent-map" viewBox="0 0 3000 3300" role="img" aria-label="从底部气闸经两侧生态、中庭和货运站登上母巢的地图">${districts.map((d) => `<rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" fill="${this.discovered.has(d.id) ? "#243d35" : "#121f20"}" stroke="#547465" stroke-width="6"/><text x="${d.x + 25}" y="${d.y + 75}" fill="#bfd7c7" font-size="55">${d.name}</text>`).join("")}${ascentPlatforms
      .filter((p) => p.oneWay)
      .map((p) => `<path d="M${p.x - p.w / 2} ${p.y}h${p.w}" stroke="#688b7e" stroke-width="12"/>`)
      .join(
        "",
      )}${this.lifts.map((l) => `<path d="M${l.x} ${l.top}V${l.bottom}" stroke="${l.unlocked ? "#acddb1" : "#647c81"}" stroke-dasharray="22 18" stroke-width="12"/>`).join("")}${sites
      .filter((s) => !this.opened.has(s.id))
      .map(
        (s) =>
          `<rect x="${s.x - 18}" y="${s.y - 18}" width="36" height="36" fill="${s.kind === "medical" ? "#9cd8bd" : "#ebbd7b"}"/>`,
      )
      .join(
        "",
      )}<circle cx="${w.player.x}" cy="${w.player.y}" r="35" fill="#fff1cc" stroke="#111" stroke-width="10"/></svg><div><p>白点：你的位置<br>金色：宝箱 / 开关<br>绿色：补给<br>竖虚线：升降井</p><p>左：泵房 → 锻台<br>右：根室 → 孢囊温床<br>两路在检修中庭交汇。</p><p>中庭以后：冷凝栈道 / 破顶温室 → 货运站 → 可选母体。</p><p>升降台从上方通电后可往返；回到底部气闸，按住 E 两秒撤离。地形无需器官能力就能攀登。</p><p>当前：${this.title}<br>已搜索 ${this.opened.size} / ${sites.length} 处</p></div></div><button class="slice-primary" data-action="resume">继续探索 · Tab / Esc</button>`;
  }
}
