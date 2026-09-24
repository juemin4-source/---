import { it, expect } from "vitest";
import { FieldDiscovery } from "../src/FieldDiscovery";
import { newProfile, settle, ProfileStore, SAVE_KEY } from "../src/Progression";
import { Expedition } from "../src/Expedition";
import { idleControls } from "../src/Player";
const record = (findings: string[], escort = false) => ({
  cargo: { material: 10, core: 1, data: 2 },
  seconds: 80,
  activity: 50,
  route: ["airlock", "service"],
  detached: 0,
  phased: 0,
  seed: 1,
  findings,
  escort,
});
it("discoveries and a rescued engineer only become city traces on extraction", () => {
  const p = newProfile();
  settle(p, record(["roots"], true), "rescued");
  expect(p.residents).toEqual([]);
  expect(p.discoveries).toEqual([]);
  settle(p, record(["roots"], true), "extracted");
  settle(p, record(["roots"], true), "extracted");
  expect(p.residents).toEqual(["engineer"]);
  expect(p.discoveries).toEqual(["roots"]);
});
it("old saves preserve their bank and upgrades while new collections default empty", () => {
  const p = newProfile();
  p.bank.material = 45;
  p.upgrades.health = true;
  const old = JSON.parse(JSON.stringify(p));
  delete old.discoveries;
  delete old.residents;
  const storage = { getItem: () => JSON.stringify(old), setItem: () => {} };
  const loaded = new ProfileStore(storage).load();
  expect(loaded.bank.material).toBe(45);
  expect(loaded.upgrades.health).toBe(true);
  expect(loaded.discoveries).toEqual([]);
});
it("warm-room and activity locks are enforced and each award is single use", () => {
  const d = new FieldDiscovery(newProfile(), 1, 1),
    roots = d.features.find((f) => f.id === "roots")!,
    anomaly = d.features.find((f) => f.id === "dormant-cache")!;
  expect(roots.requires).toBeUndefined(); // Physical high route, not an inventory key.
  expect(roots.zoneId).toBe("nursery");
  expect(
    d.complete(roots, { activity: 80, connected: ["grapple"] }),
  ).not.toBeNull();
  expect(d.found).toEqual(["roots"]);
  expect(
    d.complete(roots, { activity: 80, connected: ["grapple"] }),
  ).toBeNull();
  expect(d.complete(anomaly, { activity: 69 })).toBeNull();
  expect(d.complete(anomaly, { activity: 70 })?.activity).toBe(12);
});
it("life signal changes branches; a saved resident is not duplicated next run", () => {
  const p = newProfile();
  const a = new FieldDiscovery(p, 1, 1),
    b = new FieldDiscovery(p, 1, 2);
  expect(a.features.find((f) => f.kind === "survivor")!.zoneId).not.toBe(
    b.features.find((f) => f.kind === "survivor")!.zoneId,
  );
  p.residents = ["engineer"];
  expect(
    new FieldDiscovery(p, 1, 3).features.some((f) => f.kind === "survivor"),
  ).toBe(false);
});
it("the lift folds the return route without healing or directly banking resources", () => {
  const e = new Expedition();
  e.start(3);
  e.zoneId = "station";
  e.world.player.x = 3200;
  e.world.player.y = e.zone.height-134;
  e.world.player.hp = 47;
  e.world.god = true;
  e.cargo.material = 20;
  expect(e.repair("S1")).toBe(true);
  e.travelCooldown = 0;
  expect(e.travel("S1")).toBe(true);
  expect(e.zoneId).toBe("concourse");
  expect(e.world.player.hp).toBe(47);
  expect(e.profile.bank.material).toBe(0);
  expect(e.cargo.material).toBe(12);
  expect(e.state).toBe("field");
});
it("interrupted findings are not banked and repeated reload cannot duplicate resources", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
  const p = newProfile();
  p.active = record(["dawn-lens"], true);
  data.set(SAVE_KEY, JSON.stringify(p));
  const once = new ProfileStore(storage).load(),
    again = new ProfileStore(storage).load();
  expect(once.discoveries).toEqual([]);
  expect(once.residents).toEqual([]);
  expect(again.bank).toEqual(once.bank);
  expect(again.history).toHaveLength(1);
});
