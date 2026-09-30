import { Carrier, type SliceWorld } from "../SliceWorld";
import { distance } from "../../engine/PhysicsHelpers";
import type { Renderer } from "../../engine/Renderer";
import { people, type PersonId } from "../meta/CampaignContent";
import type { CampaignProgress } from "../meta/CampaignProgress";
import { lootDefs, nextUid, cargoAdd, type LootItem } from "./LootSystem";
import type { DistrictId } from "./ExpeditionMap";

export class ExpeditionObjectives {
  packing = false;
  availableBeds = 3;
  permanentStars: string[] = [];
  newStars: string[] = [];
  rescue: {
    id: PersonId;
    x: number;
    y: number;
    hp: number;
    following: boolean;
    lock: number;
    trail: { x: number; y: number }[];
  }[] = [];
  stars = [
    { id: "star-1", x: 1210, y: 1308 },
    { id: "star-2", x: 4400, y: 1116 },
    { id: "star-3", x: 6090, y: 1340 },
  ];
  chests: {
    x: number;
    y: number;
    name: string;
    district: DistrictId;
    state: "sleep" | "fight" | "open";
    body?: Carrier;
    stored: LootItem[];
  }[] = [
    { x: 1440, y: 1586, name: "旧档案吞财箱", district: "cargo", state: "sleep", stored: [] },
    { x: 3100, y: 1799, name: "滤水站吞财箱", district: "bed", state: "sleep", stored: [] },
    { x: 5900, y: 1370, name: "吊装间吞财箱", district: "spine", state: "sleep", stored: [] },
  ];
  private nextMeal = 0;
  constructor(private w: SliceWorld) {}
  configure(p: CampaignProgress) {
    this.availableBeds = (p.built.includes("housing") ? 8 : 3) - p.residents.length;
    this.permanentStars = [...p.stars];
    this.rescue = (Object.keys(people) as PersonId[])
      .filter((id) => !p.residents.some((r) => r.id === id))
      .map((id) => ({ id, x: people[id].x, y: people[id].y, hp: 70, following: false, lock: 0, trail: [] }));
  }
  prompt(): string | null {
    const p = this.w.player;
    if (this.rescue.some((r) => r.hp > 0 && !r.following && distance(p, r) < 65))
      return "E · 救援幸存者（沿你的路线跟随，需一起抵达撤离点）";
    if (this.stars.some((s) => !this.permanentStars.includes(s.id) && distance(p, s) < 65))
      return "E · 收集星骸（永久收集，获得养成点）";
    const chest = this.chests.find((c) => c.state === "sleep" && distance(p, c) < 75);
    return chest ? `E · 唤醒${chest.name}，击败后取得腹内财物` : null;
  }
  interact() {
    const w = this.w,
      p = w.player;
    const r = this.rescue.find((r) => r.hp > 0 && !r.following && distance(p, r) < 65);
    if (r) {
      if (this.rescue.filter((r) => r.following && r.hp > 0).length >= this.availableBeds) {
        w.say("据点安置已满，先扩建居住区");
        return true;
      }
      r.following = true;
      w.record("rescue_start", r.id);
      w.say(`${people[r.id].name}开始跟随，回程时留意其生命与距离`);
      return true;
    }
    const s = this.stars.find((s) => !this.permanentStars.includes(s.id) && distance(p, s) < 65);
    if (s) {
      this.permanentStars.push(s.id);
      this.newStars.push(s.id);
      w.record("star_found", s.id);
      w.say("星骸已永久收集 · 养成点 +1");
      return true;
    }
    const c = this.chests.find((c) => c.state === "sleep" && distance(p, c) < 75);
    if (c) {
      c.body = new Carrier("reclaimer", c.x, c.y, ["ram", "armor"], 1);
      c.body.y = c.y;
      c.body.homeY = c.y;
      c.body.boundsWidth = w.width;
      c.body.hp = c.body.maxHp =
        230 +
        Math.min(
          120,
          c.stored.reduce((n, i) => n + i.def.value, 0),
        );
      c.body.aggro = 8;
      c.state = "fight";
      w.enemies.push(c.body);
      w.record("chest_awake", c.name);
      return true;
    }
    return false;
  }
  pack() {
    const w = this.w,
      ex = w.expedition;
    const drop = w.drops.find((d) => distance(d, w.player) < 85 && w.canReachDrop(d));
    if (!ex || !drop) return false;
    const item = {
      uid: nextUid(),
      def: lootDefs[`sample-${drop.organ}`],
      source: "完整器官封装",
      district: ex.district,
    };
    if (!cargoAdd(ex.cargo, item)) {
      w.say("货物容量不足，封装未消耗器官");
      return true;
    }
    const count = drop.stacks ?? 1;
    if (count > 1) {
      drop.stacks = count - 1;
      drop.growth = Math.max(0, (drop.growth ?? count) - 1);
    } else w.drops = w.drops.filter((d) => d !== drop);
    ex.metrics.organsPacked++;
    w.record("organ_pack", drop.organ);
    w.say(`已封装 ${item.def.name}，需要成功带回`);
    return true;
  }
  rescued() {
    return this.rescue
      .filter((r) => r.following && r.hp > 0 && distance(r, this.w.player) < 180)
      .map((r) => r.id);
  }
  update(dt: number) {
    const w = this.w,
      p = w.player;
    for (const r of this.rescue) {
      r.lock = Math.max(0, r.lock - dt);
      if (r.hp <= 0 || !r.following) continue;
      const last = r.trail.at(-1);
      if ((!last || distance(last, p) > 6) && (!last || distance(last, p) < 300))
        r.trail.push({ x: p.x, y: p.y });
      if (r.trail.length > 3000) r.trail.shift();
      const target = r.trail[0];
      if (target && (r.trail.length > 9 || distance(r, p) > 95)) {
        const d = distance(r, target),
          step = Math.min(d, 290 * dt);
        if (d > 0) {
          r.x += ((target.x - r.x) / d) * step;
          r.y += ((target.y - r.y) / d) * step;
        }
        if (d < 8) r.trail.shift();
      }
      const threat = w.enemies.find((e) => !e.dead && e.charge > 0 && distance(e, r) < 45);
      if (threat && r.lock === 0) {
        r.hp = Math.max(0, r.hp - 12);
        r.lock = 1;
        w.record("rescue_hurt", r.id);
      }
    }
    for (const c of this.chests)
      if (c.state === "fight" && c.body?.dead) {
        c.state = "open";
        const ids = ["forgeBlueprint", "trainingTicket", "batteryCell"];
        w.expedition!.piles.push({
          uid: nextUid(),
          x: c.body.x,
          y: c.body.y,
          district: c.district,
          source: c.name,
          taken: false,
          difficulty: 1,
          items: [
            ...c.stored,
            ...ids.map((id) => ({ uid: nextUid(), def: lootDefs[id], source: c.name, district: c.district })),
          ],
        });
        c.stored = [];
        w.record("chest_open", c.name);
      }
    if (w.time > this.nextMeal) {
      this.nextMeal = w.time + 10;
      for (const c of this.chests.filter((c) => c.state === "sleep")) {
        const pile = w.expedition!.piles.find(
          (pile) => !pile.taken && pile.items.length > 0 && distance(pile, c) < 160,
        );
        const food = pile?.items.shift();
        if (food) {
          c.stored.push(food);
          if (!pile!.items.length) pile!.taken = true;
          w.record("chest_consume", `${c.name}:${food.def.id}`);
        }
      }
    }
  }
  render(art: Renderer) {
    const g = art.g;
    art.label("archive-title", 1100, 1400, "旧档案库 · 书籍与吞财箱", "#b8c8bd", 17);
    art.label("library-title", 1080, 1120, "封存书库", "#b8c8bd", 17);
    for (const r of this.rescue) {
      if (r.hp <= 0) continue;
      g.fillStyle(r.following ? 0xa8cba9 : 0xafa492);
      g.fillCircle(r.x, r.y - 15, 8);
      g.fillRoundedRect(r.x - 8, r.y - 7, 16, 30, 3);
      art.label(
        `rescue-${r.id}`,
        r.x - 45,
        r.y - 58,
        `${people[r.id].name} ${Math.ceil(r.hp)}\n${r.following ? "跟随中" : "E 救援"}`,
        "#d4d9b3",
        12,
      );
    }
    for (const s of this.stars)
      if (!this.permanentStars.includes(s.id)) {
        g.fillStyle(0xbfd6fa, 0.8);
        g.fillTriangle(s.x, s.y - 16, s.x - 11, s.y + 7, s.x + 11, s.y + 7);
        art.label(s.id, s.x - 28, s.y - 42, "星骸 · E", "#c6defa", 12);
      }
    for (const [i, c] of this.chests.entries())
      if (c.state !== "open") {
        const b = c.body ?? c;
        g.fillStyle(0x947342);
        g.fillRoundedRect(b.x - 24, b.y - 12, 48, 36, 6);
        g.fillStyle(0xe6be63);
        g.fillRect(b.x - 18, b.y - 2, 36, 4);
        art.label(
          `chest-${i}`,
          b.x - 50,
          b.y - 45,
          c.state === "sleep" ? `${c.name} · E` : "夺回腹内财物",
          "#ddbc7d",
          12,
        );
      }
  }
}
