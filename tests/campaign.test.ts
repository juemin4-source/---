import { describe, expect, it } from "vitest";
import { freshSave, SliceWorld } from "../src/game/SliceWorld";
import { metaAction, parseMeta, benefits, settleMeta } from "../src/game/meta/MetaProgression";
import { finishEducation } from "../src/game/meta/CampaignProgress";
import { lootDefs, cargoAdd } from "../src/game/expedition/LootSystem";
const account = () => {
  const a = freshSave();
  a.bank = 1000;
  return a;
};
const world = () => {
  const w = new SliceWorld(false, 1, false, true, true, true);
  w.applyProgress(freshSave().meta);
  return w;
};

describe("campaign production and progression", () => {
  it("loans all six experimental weapons in exploration without modifying ownership", () => {
    const meta = freshSave().meta;
    const owned = [...meta.campaign.ownedWeapons];
    const w = world();
    w.applyProgress(meta);
    for (const id of ["recoil", "nail", "harpoon", "blade", "gravity", "rift"] as const) {
      w.armory.switchPrimary(id);
      expect(w.armory.primary).toBe(id);
    }
    expect(meta.campaign.ownedWeapons).toEqual(owned);
  });
  it("manufacturing requires a rescued worker, consumes exact materials once, and unlocks real switching", () => {
    const a = account();
    a.meta.warehouse = { lithium: 2, bioPart: 1 };
    metaAction(a, "manufacture", "rifle");
    expect(a.bank).toBe(1000);
    a.meta.campaign.residents.push({ id: "lin", profession: "mechanic", knowledge: [], studying: null });
    metaAction(a, "manufacture", "rifle");
    metaAction(a, "manufacture", "rifle");
    expect(a.bank).toBe(955);
    expect(a.meta.warehouse.lithium).toBe(0);
    const w = world();
    w.armory.switchPrimary("rifle");
    expect(w.armory.primary).toBe("handgun");
    w.applyProgress(a.meta);
    w.armory.switchPrimary("rifle");
    expect(w.armory.primary).toBe("rifle");
  });
  it("third reinforcement requires the actual machine tool construction", () => {
    const a = account();
    a.meta.campaign.residents.push({ id: "lin", profession: "mechanic", knowledge: [], studying: null });
    a.meta.warehouse = { lithium: 10, machineTool: 1 };
    metaAction(a, "reinforce", "handgun");
    metaAction(a, "reinforce", "handgun");
    const bank = a.bank;
    metaAction(a, "reinforce", "handgun");
    expect(a.bank).toBe(bank);
    metaAction(a, "construct", "machining");
    metaAction(a, "reinforce", "handgun");
    expect(a.meta.campaign.reinforcement.handgun).toBe(3);
    expect(a.meta.warehouse.machineTool).toBe(0);
    const w = world();
    w.applyProgress(a.meta);
    w.armory.shoot(100, false);
    expect(w.projectiles.at(-1)!.damage).toBeCloseTo(115);
  });
  it("education consumes books, enforces prerequisite and completes before enabling worker construction", () => {
    const a = account();
    a.meta.campaign.residents.push({ id: "an", profession: "resident", knowledge: [], studying: null });
    a.meta.warehouse = { maintenanceBook: 2, fusionBook: 1, deuterium: 2 };
    metaAction(a, "construct", "academy");
    metaAction(a, "learn", "an:fusion");
    expect(a.meta.warehouse.fusionBook).toBe(1);
    metaAction(a, "learn", "an:mechanical");
    expect(a.meta.warehouse.maintenanceBook).toBe(0);
    expect(a.meta.campaign.residents[0].profession).toBe("resident");
    finishEducation(a);
    metaAction(a, "learn", "an:fusion");
    finishEducation(a);
    expect(a.meta.campaign.residents[0].profession).toBe("engineer");
    metaAction(a, "construct", "freightPower");
    const w = world();
    w.applyProgress(parseMeta(a.meta));
    expect(w.expedition!.power).toBe(true);
  });
  it("refining consumes physical goods and failure is atomic", () => {
    const a = account();
    a.meta.warehouse = { batteryCell: 1 };
    metaAction(a, "refine", "batteryCell");
    expect(a.meta.warehouse.batteryCell).toBe(1);
    a.meta.campaign.built.push("refinery");
    metaAction(a, "refine", "batteryCell");
    metaAction(a, "refine", "batteryCell");
    expect(a.meta.warehouse.lithium).toBe(2);
    expect(a.meta.warehouse.batteryCell).toBe(0);
  });
  it("sample research gives a bounded interface and never a starting organ", () => {
    const a = account();
    a.meta.warehouse = { "sample-speed": 1 };
    a.meta.campaign.built.push("laboratory");
    metaAction(a, "organ-research", "speed");
    metaAction(a, "organ-research", "speed");
    expect(a.bank).toBe(965);
    metaAction(a, "interface", "speed");
    expect(benefits(a.meta).attackSpeed).toBe(1.06);
    const w = world();
    w.applyProgress(a.meta);
    expect(w.count("speed")).toBe(0);
  });
  it("branches are exclusive, refundable and hero-specific; skill levels require usage", () => {
    const a = account();
    a.meta.campaign.points = 1;
    metaAction(a, "branch", "force");
    metaAction(a, "branch", "flow");
    expect(a.meta.campaign.trees.meng).toBe("force");
    metaAction(a, "reset-branch", "");
    metaAction(a, "reset-branch", "");
    expect(a.meta.campaign.points).toBe(1);
    metaAction(a, "skill-upgrade", "");
    expect(a.meta.campaign.skillLevel.meng).toBe(0);
    a.meta.campaign.skillUses.meng = 3;
    metaAction(a, "skill-upgrade", "");
    metaAction(a, "skill-upgrade", "");
    expect(a.meta.campaign.skillLevel.meng).toBe(1);
  });
  it("permanent shortcut opens its physical gate", () => {
    const w = world(),
      a = account();
    a.meta.campaign.built.push("maintenanceRoute");
    w.applyProgress(a.meta);
    const gates = w.expedition!.geometry.gates.filter((g) => g.lock === "sewer-valve");
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.every((g) => w.platforms[g.index].y === -1000)).toBe(true);
  });
});
describe("physical expedition rewards", () => {
  it("packing stops automatic absorption, preserves stack on full cargo, and death loses sample", () => {
    const w = world(),
      ex = w.expedition!,
      o = ex.objectives;
    w.drops = [{ id: 999, x: w.player.x, y: w.player.y, organ: "speed", stacks: 2 }];
    o.packing = true;
    w.autoCollect();
    expect(w.count("speed")).toBe(0);
    o.pack();
    expect(ex.cargo.items[0].def.id).toBe("sample-speed");
    expect(w.drops[0].stacks).toBe(1);
    ex.cargo.capacity = 1;
    o.pack();
    expect(w.drops).toHaveLength(1);
    const a = account();
    settleMeta(a, 1, false, 45, ex.cargo.items);
    expect(a.meta.warehouse).toEqual({});
    o.packing = false;
    w.autoCollect();
    expect(w.count("speed")).toBe(1);
  });
  it("rescue follows actual traversed path, needs space and proximity at extraction", () => {
    const w = world(),
      o = w.expedition!.objectives,
      r = o.rescue[0];
    w.enemies = [];
    w.player.x = r.x;
    w.player.y = r.y;
    o.interact();
    expect(r.following).toBe(true);
    const x = r.x;
    for (let i = 0; i < 120; i++) {
      w.player.x += 2;
      o.update(1 / 60);
    }
    expect(r.x).toBeGreaterThan(x + 50);
    expect(o.rescued()).toContain(r.id);
    w.player.x += 1000;
    expect(o.rescued()).not.toContain(r.id);
    const next = o.rescue[1];
    o.availableBeds = 1;
    w.player.x = next.x;
    w.player.y = next.y;
    o.interact();
    expect(next.following).toBe(false);
  });
  it("chest eats actual treasure and releases it once after being defeated", () => {
    const w = world(),
      ex = w.expedition!,
      o = ex.objectives,
      c = o.chests[0];
    ex.piles = [
      {
        uid: 900,
        x: c.x,
        y: c.y,
        district: c.district,
        source: "test",
        taken: false,
        difficulty: 1,
        items: [{ uid: 901, def: lootDefs.batteryCell, source: "test", district: c.district }],
      },
    ];
    w.time = 1;
    o.update(0.1);
    expect(c.stored).toHaveLength(1);
    expect(ex.piles[0].taken).toBe(true);
    w.player.x = c.x;
    w.player.y = c.y;
    o.interact();
    expect(c.body!.organs.count("ram")).toBe(1);
    w.hit(c.body!, 9999);
    o.update(0.1);
    o.update(0.1);
    expect(c.state).toBe("open");
    expect(ex.piles).toHaveLength(2);
    expect(ex.piles[1].items).toHaveLength(4);
  });
  it("stars are awarded once and remain hidden with saved progress", () => {
    const w = world(),
      o = w.expedition!.objectives,
      s = o.stars[0];
    w.player.x = s.x;
    w.player.y = s.y;
    o.interact();
    o.interact();
    expect(o.newStars).toEqual([s.id]);
    const a = account();
    a.meta.campaign.stars = [s.id];
    const w2 = world();
    w2.applyProgress(a.meta);
    w2.player.x = s.x;
    w2.player.y = s.y;
    w2.expedition!.objectives.interact();
    expect(w2.expedition!.objectives.newStars).toEqual([]);
  });
});
describe("character abilities", () => {
  it("echo replays attacks without consuming heat or recording itself", () => {
    const w = world();
    w.skills.activate();
    w.armory.shoot(20, false);
    w.skills.activate();
    const heat = w.heat;
    w.skills.update(0.1);
    expect(w.projectiles).toHaveLength(2);
    expect(w.heat).toBe(heat);
    expect(w.skills.echo).toHaveLength(0);
    expect(w.skills.uses).toBe(1);
  });
  it("rabbit converts overflow only during its active window and credits once", () => {
    const w = world();
    w.skills.hero = "rabbit";
    w.skills.activate();
    w.heat = 100;
    w.skills.addHeat(20);
    w.skills.addHeat(20);
    expect(w.skills.damage).toBeCloseTo(1.4);
    expect(w.skills.uses).toBe(1);
    w.skills.update(9);
    expect(w.skills.burning).toBe(false);
    expect(w.skills.damage).toBe(1);
  });
  it("support is spatial or temporary rather than a permanent free bonus", () => {
    const w = world();
    w.skills.partner = "lu";
    w.skills.support();
    expect(w.skills.protection).toBe(0.65);
    w.player.x += 300;
    expect(w.skills.protection).toBe(1);
    w.skills.update(29);
    w.skills.partner = "cheng";
    w.skills.support();
    expect(w.armory.units).toHaveLength(1);
    w.time += 13;
    w.skills.update(13);
    expect(w.armory.units).toHaveLength(0);
    w.skills.update(29);
    w.skills.partner = "du";
    w.skills.support();
    w.player.hp = 50;
    w.skills.moon!.lost = 20;
    w.skills.update(7);
    expect(w.player.hp).toBe(62);
  });
});
