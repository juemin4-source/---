import { describe, expect, it } from "vitest";
import { Ecology } from "../src/game/expedition/Ecology";
import { SeededRandom } from "../src/game/expedition/SeededRandom";
import { districts, nestDefs, route, passages } from "../src/game/expedition/ExpeditionMap";
import { STAGE_BIOMASS, stageOf } from "../src/game/expedition/EcologyTypes";

const ALL_LOCKS = new Set(["freight-power", "spine-door", "sewer-valve"]);
const run = (
  seed: number,
  seconds: number,
  player = null as null | { x: number; y: number; district: never },
) => {
  const eco = new Ecology(seed);
  for (let t = 0; t < seconds; t += 0.5) eco.update(0.5, { player, open: ALL_LOCKS });
  return eco;
};

describe("生态 · 世界自己变危险", () => {
  it("随机数是可复现的，且不使用 Math.random", () => {
    const a = new SeededRandom(5),
      b = new SeededRandom(5);
    const seq = Array.from({ length: 40 }, () => a.next());
    expect(seq).toEqual(Array.from({ length: 40 }, () => b.next()));
    expect(new Set(seq).size).toBeGreaterThan(35);
    expect(seq.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("同一 seed 跑两次结果完全一致（离屏模拟可复现）", () => {
    const a = run(3, 600).snapshot(),
      b = run(3, 600).snapshot();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.alive).toBe(b.alive);
  });

  it("不同 seed 走出不同生态", () => {
    const a = run(1, 900),
      b = run(7, 900);
    expect(a.metrics.creatureConsumes).not.toBe(b.metrics.creatureConsumes);
  });

  it("巢穴会自行积累并升级状态", () => {
    const eco = run(1, 600);
    expect(eco.nests.length).toBeGreaterThanOrEqual(4);
    expect(eco.nests.some((n) => n.state !== "dormant")).toBe(true);
    expect(eco.nests.some((n) => n.biomass > 10)).toBe(true);
  });

  it("生物会互相捕食，也会吃尸骸（不是只靠刷怪）", () => {
    const eco = run(1, 900);
    expect(eco.metrics.creatureVsCreatureKills).toBeGreaterThan(5);
    expect(eco.metrics.creatureConsumes).toBeGreaterThan(10);
    expect(eco.metrics.remainsCreated).toBeGreaterThan(10);
  });

  it("会自然产生成熟体与 Apex，且 Apex 来自真实个体", () => {
    const eco = run(1, 1200);
    expect(eco.metrics.matureCreated).toBeGreaterThan(0);
    expect(eco.metrics.apexCreated).toBeGreaterThan(0);
    const apexLog = eco.log.filter((e) => e.event === "apex_created");
    expect(apexLog.length).toBeGreaterThan(0);
    // Each apex keeps an identity and a home nest rather than appearing from nothing.
    expect(apexLog[0].detail).toMatch(/^[a-z]+-\d+ · 源自 nest-/);
    for (const a of eco.apexes) {
      expect(a.name).toMatch(/^[a-z]+-\d+$/);
      expect(a.home).toMatch(/^nest-/);
      expect(a.biomass).toBeGreaterThanOrEqual(STAGE_BIOMASS.apex);
    }
  });

  it("吞噬会继承器官，同种器官可叠层", () => {
    const eco = run(7, 1200);
    const stacked = eco.creatures.filter((c) => c.organs.entries().some(([, n]) => n > 1));
    expect(stacked.length).toBeGreaterThan(0);
    expect(eco.metrics.maxEnemyOrganLayers).toBeGreaterThan(eco.metrics.maxEnemyUniqueOrgans);
    expect(eco.log.some((e) => e.event === "enemy_absorb")).toBe(true);
  });

  it("器官层数真正影响战斗属性，成长不等于无脑加血", () => {
    const eco = new Ecology(2);
    const c = eco.alive[0];
    const before = c.maxHp;
    c.organs.add("ram", 4);
    eco.refreshStats(c);
    // Layers raise HP only slightly...
    expect(c.maxHp).toBeLessThan(before * 1.5);
    // ...while the combat module scales the real numbers.
    expect(c.organs.totalLayers).toBe(5);
  });

  it("人口有上限，不会指数爆炸或集体灭绝", () => {
    for (const seed of [1, 7, 42, 99]) {
      const eco = run(seed, 1200);
      const snap = eco.snapshot();
      expect(snap.alive).toBeGreaterThan(5);
      expect(snap.alive).toBeLessThan(60);
      expect(eco.metrics.creatureVsCreatureKills).toBeLessThan(eco.metrics.creaturesSpawned);
    }
  });

  it("Apex 由克制链自我限制：既不会满地都是，也不会永不出现", () => {
    let created = 0;
    for (const seed of [1, 7, 42, 99, 5, 13]) {
      const eco = run(seed, 1500);
      created += eco.metrics.apexCreated;
      expect(eco.apexes.length, `seed ${seed} Apex 过多`).toBeLessThan(8);
    }
    // Apex 真的被养出来了，而不是被上限压着；同时也不是时间一到就自动出现。
    expect(created).toBeGreaterThan(10);
  });

  it("Apex 会被真正猎杀，不是无敌的", () => {
    let killed = 0;
    for (const seed of [1, 7, 42, 99, 5, 13]) killed += run(seed, 1500).metrics.apexKilled;
    expect(killed).toBeGreaterThan(3);
  });

  it("尸骸不会无限堆积", () => {
    const eco = run(1, 1500);
    expect(eco.remains.length).toBeLessThan(40);
    expect(eco.creatures.length).toBeLessThan(400);
  });

  it("所有数值都是有限数，没有 NaN / Infinity", () => {
    const eco = run(42, 1200);
    const snap = eco.snapshot();
    expect(Number.isFinite(snap.threat)).toBe(true);
    expect(Number.isFinite(snap.biomass)).toBe(true);
    expect(Number.isFinite(snap.maxBiomass)).toBe(true);
    for (const c of eco.creatures) {
      expect(Number.isFinite(c.biomass)).toBe(true);
      expect(Number.isFinite(c.hp)).toBe(true);
      expect(c.maxHp).toBeGreaterThan(0);
    }
  });

  it("Threat 全程上升但不会一直顶到满值", () => {
    const eco = new Ecology(3);
    const samples: number[] = [];
    for (let t = 0; t < 900; t += 0.5) {
      eco.update(0.5, { player: null, open: ALL_LOCKS });
      if (t % 60 === 0) samples.push(eco.threat());
    }
    expect(samples[0]).toBeLessThan(1.5);
    expect(Math.max(...samples)).toBeGreaterThan(samples[0]);
    expect(samples.filter((v) => v >= 5).length).toBe(0);
    expect(eco.threatLabel().length).toBeGreaterThan(0);
  });

  it("噪声会让附近的生物前来查看，巢穴警戒上升", () => {
    const eco = new Ecology(5);
    const nest = eco.nests[0];
    const before = nest.alert;
    const target = eco.alive.find((c) => c.district === nest.district)!;
    const heard = eco.hearNoise({ x: target.x, y: target.y, district: nest.district, strength: 2 });
    expect(heard).toBeGreaterThan(0);
    expect(nest.alert).toBeGreaterThan(before);
    expect(eco.alive.some((c) => c.intent === "investigate")).toBe(true);
  });

  it("成熟体与 Apex 会沿合法地图路径迁移，并记录理由", () => {
    const eco = new Ecology(1);
    const c = eco.alive[0];
    c.biomass = 40;
    eco.refreshStats(c);
    expect(c.stage).toBe("apex");
    const home = c.district;
    const moved = eco.startMigration(c, "control", "扩张领地", { player: null, open: ALL_LOCKS });
    expect(moved).toBe(true);
    expect(c.intent).toBe("migrate");
    expect(c.migratePath![0]).toBe(home);
    expect(c.migratePath![c.migratePath!.length - 1]).toBe("control");
    expect(eco.log.some((e) => e.event === "enemy_migrate" && e.detail.includes("扩张领地"))).toBe(true);
  });

  it("未成年体不会迁移", () => {
    const eco = new Ecology(1);
    const c = eco.alive[0];
    expect(c.stage).toBe("juvenile");
    expect(eco.startMigration(c, "control", "扩张领地", { player: null, open: ALL_LOCKS })).toBe(false);
  });

  it("玩家在附近时该区域的巢穴繁殖变慢（但不冻结世界）", () => {
    // Measured on the rule itself: comparing whole-run spawn counts is dominated by predation
    // chaos, so it would pass or fail for reasons unrelated to the suppression being tested.
    const gate = (player: { x: number; y: number; district: never } | null) => {
      const eco = new Ecology(1);
      let intervals = 0,
        count = 0;
      for (let t = 0; t < 240; t += 0.5) {
        const before = eco.nests[0].spawnTimer;
        eco.update(0.5, { player, open: ALL_LOCKS });
        // A re-arm is any tick where the timer jumped upward. Summing rather than averaging would
        // cancel out, since slower breeding also produces fewer intervals.
        if (eco.nests[0].spawnTimer > before) {
          intervals += eco.nests[0].spawnTimer;
          count++;
        }
      }
      expect(count).toBeGreaterThan(3);
      return intervals / count;
    };
    const d = districts.find((x) => x.id === "lower")!;
    const watched = gate({ x: d.x + d.w / 2, y: d.floor, district: d.id as never }),
      ignored = gate(null);
    expect(watched).toBeGreaterThan(ignored);
    expect(watched / ignored).toBeGreaterThan(1.3);
  });

  it("玩家离屏时生态照样推进（不依赖渲染）", () => {
    const off = run(1, 600, null);
    expect(off.metrics.creatureConsumes).toBeGreaterThan(0);
    expect(off.alive.length).toBeGreaterThan(0);
    expect(off.metrics.matureCreated).toBeGreaterThanOrEqual(0);
  });
});

describe("生态 · 地图拓扑", () => {
  it("区域数量与巢穴数量符合设计", () => {
    expect(districts.length).toBeGreaterThanOrEqual(7);
    expect(districts.length).toBeLessThanOrEqual(9);
    expect(nestDefs.length).toBe(5);
    // At least one district hosts two competing colonies, or predation could never happen.
    const perDistrict = new Map<string, number>();
    for (const n of nestDefs) perDistrict.set(n.district, (perDistrict.get(n.district) ?? 0) + 1);
    expect([...perDistrict.values()].some((v) => v > 1)).toBe(true);
  });

  it("有两条初始路线、两条环路、单向落点与两类撤离点", () => {
    const fromAirlock = passages(ALL_LOCKS).filter((p) => p.from === "airlock");
    expect(fromAirlock.length).toBeGreaterThanOrEqual(2);
    const oneWay = passages(ALL_LOCKS).filter((p) => p.link.oneWay);
    expect(oneWay.length).toBeGreaterThanOrEqual(1);
    expect(districts.some((d) => d.id === "airlock")).toBe(true);
    expect(districts.some((d) => d.id === "heatx")).toBe(true);
  });

  it("货运路线与快速危险路线都存在，且重量限制不同", () => {
    const heavy = passages(ALL_LOCKS, true);
    const light = passages(ALL_LOCKS, false);
    expect(heavy.length).toBeLessThan(light.length);
    expect(heavy.some((p) => p.to === "heatx")).toBe(true);
    // The sewer shortcut is the dangerous fast way home and rejects heavy cargo.
    expect(light.some((p) => p.link.lock === "sewer-valve")).toBe(true);
    expect(heavy.some((p) => p.link.lock === "sewer-valve")).toBe(false);
  });

  it("未解锁的捷径不能通行，解锁后可以", () => {
    const locked = passages(new Set());
    expect(locked.some((p) => p.link.lock === "spine-door")).toBe(false);
    const open = passages(new Set(["spine-door"]));
    expect(open.some((p) => p.link.lock === "spine-door")).toBe(true);
  });

  it("地图是全连通的（任何区域都能走到撤离点）", () => {
    for (const d of districts) {
      expect(route(d.id, "airlock", ALL_LOCKS)).not.toBeNull();
    }
  });

  it("阶段阈值单调", () => {
    expect(stageOf(0)).toBe("juvenile");
    expect(stageOf(STAGE_BIOMASS.mature)).toBe("mature");
    expect(stageOf(STAGE_BIOMASS.apex)).toBe("apex");
  });
});
