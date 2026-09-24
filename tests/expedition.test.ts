import { describe, it, expect } from "vitest";
import { Expedition } from "../src/Expedition";
import {
  ProfileStore,
  newProfile,
  settle,
  emptyCargo,
  buyUpgrade,
  SAVE_KEY,
} from "../src/Progression";
import { EnemyModule } from "../src/EnemyModule";
import { idleControls } from "../src/Player";
import { zones, type ZoneId } from "../src/ExpeditionMap";
const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
};
function cross(e: Expedition, id: string) {
  const p = e.zone.portals.find((p) => p.id === id)!;
  e.world.player.x = p.x;
  e.world.player.y = p.y;
  e.travelCooldown = 0;
  expect(e.travel(id)).toBe(true);
}
describe("expedition loop", () => {
  it("extracts once, buys an upgrade, starts a changed second trip", () => {
    const e = new Expedition(new ProfileStore(memory()));
    e.start(123);
    const first = e.areas.get("concourse")!.world.enemies.map((x) => x.kind);
    e.collect(e.area.loot[0]);
    expect(e.profile.bank.material).toBe(0);
    cross(e, "out");
    e.area.loot.filter((x) => x.kind === "cache").forEach((x) => e.collect(x));
    cross(e, "service");
    e.area.loot.filter((x) => x.kind === "cache").forEach((x) => e.collect(x));
    cross(e, "back");
    cross(e, "back");
    const cargo = { ...e.cargo };
    e.finish("extracted");
    expect(e.profile.bank).toEqual(cargo);
    expect(e.areas.size).toBe(0);
    expect(e.finish("extracted")).toBeNull();
    expect(e.buy("health")).toBe(true);
    expect(e.buy("health")).toBe(false);
    e.start(124);
    expect(e.world.player.hp).toBe(125);
    expect(e.cargo).toEqual(emptyCargo());
    expect(
      e.areas.get("concourse")!.world.enemies.map((x) => x.kind),
    ).not.toEqual(first);
    expect(e.profile.sorties).toBe(2);
  });
  it("revisits preserve health, enemies, searched caches and loose organs", () => {
    const e = new Expedition();
    e.start(4);
    cross(e, "out");
    const area = e.area,
      loot = area.loot[0];
    e.collect(loot);
    e.world.player.hp = 53;
    const m = new EnemyModule("gun", 600, 585);
    e.world.modules.push(m);
    e.world.stabilize(m);
    cross(e, "service");
    cross(e, "back");
    expect(e.area).toBe(area);
    expect(e.world.player.hp).toBe(53);
    expect(loot.taken).toBe(true);
    expect(e.world.modules).toContain(m);
    const old = e.cargo.material;
    e.collect(loot);
    expect(e.cargo.material).toBe(old);
  });
  it("carries held module across nodes but clears all temporary modules on death", () => {
    const e = new Expedition();
    e.start(6);
    const m = new EnemyModule("thruster", 240, 580);
    m.held = true;
    e.world.modules.push(m);
    e.world.held = m;
    e.world.stabilize(m);
    cross(e, "out");
    expect(e.world.held).toBe(m);
    e.profile.bank.material = 20;
    e.cargo = { material: 40, core: 4, data: 5 };
    e.world.player.hp = 1;
    e.world.player.invulnerable = 0;
    e.world.hurtPlayer(100, 500);
    e.update(1 / 120, idleControls());
    expect(e.state).toBe("hub");
    expect(e.profile.bank).toEqual({ material: 32, core: 2, data: 2 });
    expect(e.world.modules).toHaveLength(0);
    expect(e.lastRecord!.lost).toEqual({ material: 28, core: 2, data: 3 });
  });
  it("upgrades change only the small permanent baseline", () => {
    const e = new Expedition();
    e.profile.bank = { material: 100, core: 10, data: 10 };
    expect(e.buy("weapon")).toBe(true);
    expect(e.buy("phase")).toBe(true);
    e.start(8);
    expect(e.world.shotDamage).toBe(9);
    expect(e.world.shotInterval).toBe(0.175);
    expect(e.world.phaseCapacity).toBe(4);
    const ms = Array.from(
      { length: 5 },
      () => new EnemyModule("gun", 400, 580),
    );
    ms.forEach((m) => e.world.stabilize(m));
    expect(ms.map((m) => m.stable)).toEqual([false, true, true, true, true]);
  });
  it("activity creates reinforcement pressure without an instant death at 100%", () => {
    const e = new Expedition();
    e.start(9);
    cross(e, "out");
    e.world.god = true;
    e.zoneId="station";
    e.activity = 99.9999;
    const before = e.world.enemies.length;
    e.update(0.2, idleControls());
    expect(e.activity).toBe(100);
    expect(e.world.dead).toBe(false);
    expect(e.activityStage).toBe("聚合状态");
    expect(e.world.enemies.length).toBeGreaterThan(before);
    e.world.enemies.forEach((x) => {
      x.dead = true;
    });
    e.spawnClock = 24.99;
    e.update(0.1, idleControls());
    expect(e.world.enemies.some((x) => !x.dead)).toBe(true);
  });
  it("each major node has a route back; no combat or elite kill gates extraction", () => {
    for (const id of Object.keys(zones) as ZoneId[]) {
      const seen = new Set<ZoneId>(),
        queue = [id];
      while (queue.length) {
        const current = queue.shift()!;
        if (seen.has(current)) continue;
        seen.add(current);
        for (const p of zones[current].portals) queue.push(p.to);
      }
      expect(seen.has("airlock")).toBe(true);
    }
    const e = new Expedition();
    e.start(2);
    cross(e, "out");
    cross(e, "forward");
    cross(e, "forward");
    e.world.spawnEnemy("elite", e.world.player.x+500, e.zone.height-134);
    expect(e.world.enemies.some((x) => x.kind === "elite" && !x.dead)).toBe(
      true,
    );
    cross(e, "back");
    cross(e, "back");
    cross(e, "back");
    expect(e.finish("extracted")?.outcome).toBe("extracted");
  });
  it("safe-zone W channel settles resources and cannot settle twice", () => {
    const e = new Expedition();
    e.start(1);
    e.cargo.material = 10;
    e.world.player.x = 175;
    e.world.player.y = 586;
    for (let i = 0; i < 190; i++)
      e.update(1 / 120, idleControls(), true, i === 0);
    expect(e.state).toBe("hub");
    expect(e.profile.bank.material).toBe(10);
    expect(e.profile.history).toHaveLength(1);
  });
  it("80% rare encounter waits for a dangerous region and an available enemy slot", () => {
    const e = new Expedition();
    e.start(16);
    e.rareIds.clear();
    e.activity = 80;
    e.update(0.1, idleControls());
    expect(e.pendingRare).toBe(true);
    cross(e, "out");
    e.zoneId="station";
    e.world.enemies=[];
    while (e.world.enemies.filter((x) => !x.dead).length < 7)
      e.world.spawnEnemy("crawler", 1100, 580, "gun");
    e.world.god = true;
    e.update(0.1, idleControls());
    expect(e.pendingRare).toBe(true);
    e.world.enemies[0].dead = true;
    e.update(0.1, idleControls());
    expect(e.pendingRare).toBe(false);
    expect(e.rareIds.size).toBe(1);
  });
  it("damage interrupts searching but does not lock routes or consume the cache", () => {
    const e = new Expedition();
    e.start(23);
    cross(e, "out");
    const cache = e.area.loot.find((x) => x.id === "concourse-0")!;
    e.world.player.x = cache.x;
    e.world.player.y = cache.y;
    e.world.player.invulnerable = 0;
    const enemy = e.world.enemies[0];
    enemy.x = cache.x;
    enemy.y = cache.y;
    e.interactionId = cache.id;
    e.interactionProgress = 1.1;
    e.update(1 / 120, idleControls(), true);
    expect(e.interactionProgress).toBe(0);
    expect(cache.taken).toBe(false);
    expect(e.message).toContain("搜索被打断");
    expect(e.zone.portals.length).toBe(4);
  });
  it("main corridor replaces destroyed propulsion within its next short reinforcement window", () => {
    const e = new Expedition();
    e.start(33);
    cross(e, "out");
    e.world.god = true;
    e.world.enemies.forEach((x) => (x.dead = true));
    e.world.modules.forEach((m) => (m.dead = true));
    e.spawnClock = 19.99;
    e.update(0.1, idleControls());
    expect(e.world.enemies.some((x) => !x.dead && x.has("thruster"))).toBe(
      true,
    );
  });
});
describe("local persistence", () => {
  it("saves bank and upgrades, and recovers interrupted cargo only once", () => {
    const m = memory(),
      e = new Expedition(new ProfileStore(m));
    e.profile.bank.material = 50;
    e.buy("health");
    e.start(90);
    e.cargo = { material: 10, core: 1, data: 2 };
    e.saveActive();
    const loaded = new Expedition(new ProfileStore(m));
    expect(loaded.profile.upgrades.health).toBe(true);
    expect(loaded.profile.bank).toEqual({ material: 35, core: 1, data: 1 });
    expect(loaded.lastRecord?.outcome).toBe("interrupted");
    const again = new Expedition(new ProfileStore(m));
    expect(again.profile.bank).toEqual(loaded.profile.bank);
    expect(again.profile.active).toBeNull();
  });
  it("rejects corrupted saves and unaffordable upgrades", () => {
    const m = memory();
    m.setItem(SAVE_KEY, "bad");
    expect(new ProfileStore(m).load().bank).toEqual(emptyCargo());
    const p = newProfile();
    expect(buyUpgrade(p, "health")).toBe(false);
    expect(p.bank.material).toBe(0);
  });
});
