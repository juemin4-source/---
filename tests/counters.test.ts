import { describe, expect, it } from "vitest";
import {
  ADVANTAGE,
  ARCHETYPE_CYCLE,
  DISADVANTAGE,
  beats,
  canHunt,
  counteredBy,
  dominantArchetype,
  matchup,
  organArchetype,
  roleAdvantage,
  roleBeats,
  roleCounteredBy,
} from "../src/game/expedition/Counters";
import { OrganLoadout } from "../src/game/OrganLoadout";
import { organIds } from "../src/game/config";
import { Ecology } from "../src/game/expedition/Ecology";
import type { Role } from "../src/game/expedition/EcologyTypes";

const ROLES: Role[] = ["scavenger", "hunter", "floater"];

describe("克制链 · 器官相性", () => {
  it("三种相性每个器官都有归属，没有漏网的", () => {
    for (const id of organIds) expect(organArchetype[id], `器官 ${id} 没有相性归属`).toBeTruthy();
    expect(Object.keys(organArchetype).length).toBe(organIds.length);
  });

  it("循环是闭合的：蓄势克压制、压制克连锁、连锁克蓄势", () => {
    expect(beats.charge).toBe("suppress");
    expect(beats.suppress).toBe("chain");
    expect(beats.chain).toBe("charge");
    // 反向查表和正向表必须互为逆，否则克制会变成单向
    for (const a of ARCHETYPE_CYCLE) {
      expect(beats[a]).not.toBe(a);
      expect(counteredBy[beats[a]]).toBe(a);
      expect(counteredBy[a]).toBe(beats[counteredBy[a]] === a ? counteredBy[a] : counteredBy[a]);
    }
  });

  it("每个相性都恰好克一个、被一个克（真正的三角）", () => {
    const beaten = ARCHETYPE_CYCLE.map((a) => beats[a]);
    const counters = ARCHETYPE_CYCLE.map((a) => counteredBy[a]);
    expect(new Set(beaten).size).toBe(3);
    expect(new Set(counters).size).toBe(3);
    for (const a of ARCHETYPE_CYCLE) {
      expect(counteredBy[beats[a]]).toBe(a);
      expect(beats[counteredBy[a]]).toBe(a);
    }
  });

  it("克制有实感：占优 1.5 倍、被克 0.7 倍、同相性不偏不倚", () => {
    expect(matchup("chain", "charge")).toBe(ADVANTAGE);
    expect(matchup("charge", "chain")).toBe(DISADVANTAGE);
    expect(matchup("charge", "charge")).toBe(1);
    // 反过来打必须吃亏，否则克制只是额外加成
    for (const a of ARCHETYPE_CYCLE) {
      expect(matchup(a, beats[a])).toBe(ADVANTAGE);
      expect(matchup(beats[a], a)).toBe(DISADVANTAGE);
    }
  });

  it("堆积决定相性：多带一个器官能改变自己克谁", () => {
    expect(dominantArchetype({ freeze: 1, shatter: 1 })).toBe("suppress");
    const l = new OrganLoadout({ speed: 1, mark: 1, freeze: 1 });
    expect(l.dominant()).toBe("chain");
    // 补两层压制就能翻过来
    l.add("freeze", 2);
    expect(l.dominant()).toBe("suppress");
  });

  it("没有器官时没有相性，不会默认成某一种", () => {
    expect(dominantArchetype({})).toBeNull();
    expect(new OrganLoadout().dominant()).toBeNull();
  });
});

describe("克制链 · 角色生态", () => {
  it("角色循环闭合：腐食克猎人、猎人克漂浮、漂浮克腐食", () => {
    expect(roleBeats.scavenger).toBe("hunter");
    expect(roleBeats.hunter).toBe("floater");
    expect(roleBeats.floater).toBe("scavenger");
    for (const r of ROLES) {
      expect(roleBeats[r]).not.toBe(r);
      expect(roleCounteredBy[roleBeats[r]]).toBe(r);
      expect(roleBeats[roleCounteredBy[r]]).toBe(r);
    }
    expect(new Set(ROLES.map((r) => roleBeats[r])).size).toBe(3);
  });

  it("占优时小的也能吃大的；被克时必须大很多才敢动手", () => {
    // 被克关系：腐食者被漂浮者克
    expect(canHunt({ role: "floater", biomass: 5 }, { role: "scavenger", biomass: 40 })).toBe(true);
    expect(canHunt({ role: "scavenger", biomass: 8 }, { role: "floater", biomass: 5 })).toBe(false);
    // 大到 2.2 倍以上才能翻盘
    expect(canHunt({ role: "scavenger", biomass: 40 }, { role: "floater", biomass: 5 })).toBe(true);
  });

  it("中立关系靠体型，不是无条件乱吃", () => {
    expect(canHunt({ role: "scavenger", biomass: 10 }, { role: "scavenger", biomass: 20 })).toBe(false);
    expect(canHunt({ role: "scavenger", biomass: 30 }, { role: "scavenger", biomass: 20 })).toBe(true);
  });

  it("角色相性有实感且对称", () => {
    expect(roleAdvantage("hunter", "floater")).toBe(ADVANTAGE);
    expect(roleAdvantage("floater", "hunter")).toBe(DISADVANTAGE);
    expect(roleAdvantage("hunter", "hunter")).toBe(1);
  });

  it("在实际模拟中三条相克链都会发生，没有哪个角色独占地图", () => {
    for (const seed of [1, 7, 42, 99]) {
      const eco = new Ecology(seed);
      for (let t = 0; t < 1200; t += 0.5) eco.update(0.5, { player: null, open: new Set() });
      // Read the pairing tally recorded at kill time; dead bodies are pruned from the list.
      for (const p of ["scavenger→hunter", "hunter→floater", "floater→scavenger"]) {
        expect(eco.roleKills[p] ?? 0, `seed ${seed} 缺少相克链 ${p}`).toBeGreaterThan(0);
      }
      // 没有任何角色占绝对多数
      const counts = ROLES.map((r) => eco.alive.filter((c) => c.role === r).length);
      expect(Math.max(...counts) / Math.max(1, eco.alive.length)).toBeLessThan(0.62);
      // 每个角色都还活着
      for (const r of ROLES)
        expect(
          eco.alive.some((c) => c.role === r),
          `seed ${seed} 角色 ${r} 灭绝`,
        ).toBe(true);
    }
  });

  it("Apex 数量靠克制链自我限制，不靠写死的上限", () => {
    let created = 0;
    for (const seed of [1, 7, 42, 99, 5, 13]) {
      const eco = new Ecology(seed);
      for (let t = 0; t < 1500; t += 0.5) eco.update(0.5, { player: null, open: new Set() });
      created += eco.metrics.apexCreated;
      expect(eco.apexes.length, `seed ${seed}`).toBeLessThan(8);
    }
    expect(created).toBeGreaterThan(10);
  });

  it("器官相性只在生物之间生效，不偷偷改玩家伤害", () => {
    // The player's archetype is emergent (random drops, unlimited slots), so a damage multiplier
    // would be an unpredictable tax rather than a decision. This guards against it coming back.
    const eco = new Ecology(1);
    const a = eco.alive[0];
    a.organs.add("freeze", 3);
    a.organs.add("shatter", 1);
    expect(a.organs.dominant()).toBe("suppress");
  });

  it("生物之间的胜负会记录赢家的相性（器官在生态里真的有用）", () => {
    const eco = new Ecology(1);
    for (let t = 0; t < 1200; t += 0.5) eco.update(0.5, { player: null, open: new Set() });
    const total = Object.values(eco.archetypeKills).reduce((s, v) => s + v, 0);
    expect(total).toBeGreaterThan(50);
    // Every archetype must win some fights, so none of them is dead weight.
    for (const a of ARCHETYPE_CYCLE)
      expect(eco.archetypeKills[a] ?? 0, `相性 ${a} 从未获胜`).toBeGreaterThan(5);
  });
});
