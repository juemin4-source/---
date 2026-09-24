import { it, expect } from "vitest";
import { zones, zoneOrder, shortcuts } from "../src/ExpeditionMap";
import { Expedition } from "../src/Expedition";
import { ProfileStore, newProfile } from "../src/Progression";
import { idleControls } from "../src/Player";
it("keeps all 20 nodes and the requested surface three-way choice", () => {
  expect(zoneOrder).toHaveLength(20);
  const high = zones.crown.portals.filter(p => p.ability);
  expect(Math.abs(high[0].x - high[1].x)).toBeGreaterThan(170);
  expect(zones.station.portals.map((p) => p.to)).toEqual(
    expect.arrayContaining(["quarantine", "housing", "market", "crater"]),
  );
  for (const id of zoneOrder) {
    const seen = new Set<string>(),
      q = [id];
    while (q.length) {
      const n = q.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      for (const p of zones[n].portals) q.push(p.to);
    }
    expect(seen.has("airlock")).toBe(true);
  }
  expect(zones.core.height).toBeGreaterThan(3000);
  expect(zones.station.width).toBeGreaterThan(6000);
  expect(zones.nest.depth).toBeGreaterThan(zones.core.depth);
});
it("portal and arrival coordinates remain inside their respective regions", () => {
  for (const z of Object.values(zones))
    for (const p of z.portals) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(z.width);
      expect(p.y).toBeLessThan(z.height);
      expect(p.arrival.x).toBeLessThan(zones[p.to].width);
      expect(p.arrival.y).toBeLessThan(zones[p.to].height);
    }
});
it("repairs only from the surface side, consumes materials once, survives failure and reload", () => {
  let saved: string | null = null;
  const storage = {
    getItem: () => saved,
    setItem: (_k: string, v: string) => {
      saved = v;
    },
  };
  const e = new Expedition(new ProfileStore(storage));
  e.start(4);
  e.cargo.material = 80;
  expect(e.repair("S1")).toBe(false);
  for (const s of shortcuts) {
    e.zoneId = s.from;
    e.world.player.x = s.x;
    e.world.player.y = e.zone.height - 134;
    const before = e.cargo.material;
    expect(e.repair(s.id)).toBe(true);
    expect(e.cargo.material).toBe(before - s.cost);
    expect(e.repair(s.id)).toBe(false);
    expect(e.portals.some((p) => p.id === s.id)).toBe(true);
  }
  e.finish("rescued");
  const again = new Expedition(new ProfileStore(storage));
  expect(again.profile.shortcuts).toEqual(["S1", "S2", "S3"]);
  again.start(5);
  again.zoneId = "station";
  expect(again.portals.some((p) => p.id === "S1")).toBe(true);
});
it("quiet nodes stay quiet and engineer cannot appear before the surface", () => {
  const e = new Expedition();
  e.start(2);
  for (const id of ["airlock", "nursery", "quarantine", "shelter"] as const) {
    expect(e.areas.get(id)!.world.enemies).toHaveLength(0);
    expect(e.spawn(id, true)).toBe(false);
  }
  expect(["housing", "shelter"]).toContain(
    e.discovery.features.find((f) => f.id === "engineer")!.zoneId,
  );
});
it("large-region movement and projectiles are not cut off at the old screen edge", () => {
  const e = new Expedition();
  e.start(2);
  e.zoneId = "station";
  e.world.enemies = [];
  const p = e.world.player;
  p.x = 2000;
  p.y = e.zone.height - 134;
  const c = idleControls();
  c.right = true;
  c.fire = true;
  c.mx = 3000;
  c.my = p.y;
  for (let i = 0; i < 120; i++) e.world.update(1 / 120, c);
  expect(p.x).toBeGreaterThan(2200);
  expect(e.world.projectiles.some((p) => p.x > 2500)).toBe(true);
});
it("medical charges are finite and restoration is capped", () => {
  const e = new Expedition();
  e.start(2);
  e.world.player.hp = 80;
  expect(e.heal()).toBe(true);
  expect(e.world.player.hp).toBe(100);
  expect(e.medkits).toBe(1);
  expect(e.heal()).toBe(false);
  expect(e.medkits).toBe(1);
  expect(newProfile().shortcuts).toEqual([]);
});
