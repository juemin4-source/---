import { describe, expect, it } from "vitest";
import { freshSave, parseSave, SliceWorld } from "../src/game/SliceWorld";
import { freshMeta, metaAction, settleMeta } from "../src/game/meta/MetaProgression";
import { lootDefs, type LootItem } from "../src/game/expedition/LootSystem";
import { idleControls } from "../src/engine/Player";
const loot = (id: string): LootItem => ({ uid: 1, def: lootDefs[id], source: "test", district: "airlock" });
const expedition = () => new SliceWorld(false, 1, false, true, true, true);

describe("局外养成闭环", () => {
  it("旧存档保留收益，新增字段默认初始化；非法等级、改造和仓库数据清理", () => {
    const old = parseSave(JSON.stringify({ version: 1, bank: 90, trips: 2, research: ["ram"] }));
    expect(old.bank).toBe(90);
    expect(old.meta).toEqual(freshMeta());
    old.meta.training.health = 20;
    old.meta.warehouse = { bad: 4, bioPart: -2, sludgeSample: 2.8 };
    old.meta.installed = "precision";
    const safe = parseSave(JSON.stringify(old));
    expect(safe.meta.training.health).toBe(3);
    expect(safe.meta.warehouse).toEqual({ bioPart: 0, sludgeSample: 2 });
    expect(safe.meta.installed).toBeNull();
  });
  it("成功撤离实物入库，不双重发放货物价值，重复结算无收益", () => {
    const s = freshSave();
    expect(settleMeta(s, 1, true, 52, [loot("sludgeSample"), loot("bioPart")])).toEqual({
      stored: 2,
      coins: 12,
    });
    expect(s.bank).toBe(12);
    settleMeta(s, 1, true, 52, [loot("sludgeSample")]);
    expect(s.meta.warehouse.sludgeSample).toBe(1);
    expect(s.bank).toBe(12);
    metaAction(s, "sell", "bioPart");
    expect(s.bank).toBe(40);
    expect(s.meta.warehouse.bioPart).toBe(0);
    metaAction(s, "sell", "bioPart");
    expect(s.bank).toBe(40);
  });
  it("死亡不给货物和金币，也不清掉已有训练", () => {
    const s = freshSave();
    s.bank = 100;
    metaAction(s, "train", "health");
    settleMeta(s, 1, false, 200, [loot("reactorCore")]);
    expect(s.bank).toBe(70);
    expect(s.meta.training.health).toBe(1);
    expect(s.meta.warehouse).toEqual({});
  });
  it("材料不足不扣钱，研究仅扣一次，改造互斥且可卸下", () => {
    const s = freshSave();
    s.bank = 200;
    metaAction(s, "research", "precision");
    expect(s.bank).toBe(200);
    s.meta.warehouse = { bioPart: 1, coolantCell: 1 };
    metaAction(s, "research", "precision");
    metaAction(s, "research", "precision");
    expect(s.bank).toBe(160);
    expect(s.meta.warehouse.bioPart).toBe(0);
    metaAction(s, "install", "rapid");
    expect(s.meta.installed).toBeNull();
    metaAction(s, "install", "precision");
    metaAction(s, "research", "vented");
    metaAction(s, "install", "vented");
    expect(s.meta.installed).toBe("vented");
    metaAction(s, "install", "none");
    expect(s.meta.installed).toBeNull();
  });
  it("维修手册升级工坊再消耗蓝图研究；设施只建一次", () => {
    const s = freshSave();
    s.bank = 300;
    s.meta.campaign.residents = [
      { id: "lin", profession: "mechanic", knowledge: [], studying: null },
      { id: "tang", profession: "engineer", knowledge: [], studying: null },
    ];
    s.meta.warehouse = { forgeBlueprint: 1, maintenanceBook: 1, sensorSpine: 1 };
    metaAction(s, "research", "rapid");
    expect(s.bank).toBe(300);
    metaAction(s, "facility", "workshop");
    metaAction(s, "research", "rapid");
    expect(s.meta.unlocked).toContain("rapid");
    expect(s.meta.warehouse.maintenanceBook).toBe(0);
    metaAction(s, "facility", "freight");
    const bank = s.bank;
    metaAction(s, "facility", "freight");
    expect(s.bank).toBe(bank);
    const w = expedition();
    w.applyProgress(s.meta);
    expect(w.expedition!.cargo.capacity).toBe(8);
  });
  it("训练有上限，存读档后出发生效，器官增长不会抹去永久生命", () => {
    const s = freshSave();
    s.bank = 500;
    for (let i = 0; i < 4; i++) metaAction(s, "train", "health");
    expect(s.meta.training.health).toBe(3);
    expect(s.bank).toBe(320);
    const w = expedition();
    w.applyProgress(parseSave(JSON.stringify(s)).meta);
    expect(w.player.maxHp).toBe(130);
    expect(w.player.hp).toBe(130);
    w.grant("vitality");
    expect(w.player.maxHp).toBe(150);
    w.slots = [];
    w.stackCounts = {};
    w.syncStats();
    expect(w.player.maxHp).toBe(130);
  });
  it("武器改造实际改变弹丸，伴随单位不吃主武器伤害改造", () => {
    const m = freshMeta();
    m.unlocked = ["precision"];
    m.installed = "precision";
    const w = expedition();
    w.applyProgress(m);
    w.armory.shoot(100, false);
    expect(w.projectiles.at(-1)!.damage).toBeCloseTo(115);
    w.armory.shoot(100, false, false, 300, 200, 0, true);
    expect(w.projectiles.at(-1)!.damage).toBe(100);
    expect(w.permanent.attackSpeed).toBe(0.9);
  });
  it("散热与耐力训练实际影响恢复；训练场保持中立数值", () => {
    const m = freshMeta();
    m.training = { health: 3, cooling: 3, recovery: 3 };
    m.facilities = ["infirmary", "freight", "generator"];
    const w = expedition();
    w.applyProgress(m);
    expect(w.medkits).toBe(3);
    expect(w.energy).toBe(1);
    w.heat = 50;
    w.stamina = 20;
    w.update(0.1, idleControls());
    expect(w.heat).toBeCloseTo(50 - 28 * 1.24 * 0.1);
    expect(w.stamina).toBeCloseTo(20 + 24 * 1.24 * 0.1);
    const training = new SliceWorld(false, 1, true);
    training.applyProgress(m);
    expect(training.player.maxHp).toBe(100);
    expect(training.permanent.health).toBe(0);
  });
});
