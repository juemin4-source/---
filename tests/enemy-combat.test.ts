import { describe, it, expect } from "vitest";
import { Carrier, SliceWorld } from "../src/game/SliceWorld";
import { organIds, type OrganId, type WeaponId } from "../src/game/config";
const fixture = (organ: OrganId = "ram", weapon: WeaponId = "dagger") => {
  const w = new SliceWorld();
  w.player.x = 650;
  w.player.y = 584;
  w.player.invulnerable = 0;
  const e = new Carrier("crawler", 350, 584, organ, 1);
  e.weapon = weapon;
  w.enemies = [e];
  return { w, e };
};
describe("敌人攻击、武器和成长", () => {
  it.each(["dagger", "hammer", "handgun", "rifle", "sniper"] as WeaponId[])(
    "静止初始角色会被 %s 敌人在 30 秒内击杀",
    (weapon) => {
      const { w, e } = fixture("knock", weapon);
      w.step(30);
      expect(w.result).toBe("dead");
      expect(e.attack).toBeGreaterThan(0);
      console.log(`${weapon}: ${w.time.toFixed(2)}s`);
    },
  );
  it("地图原生泵房敌人会追出旧巡逻范围并攻击", () => {
    const w = new SliceWorld(false, 1, false, true);
    w.player.x = 1180;
    w.player.y = 2676;
    w.step(30);
    expect(w.metrics.damage).toBeGreaterThan(0);
    expect(w.result).toBe("dead");
  });
  it("每六层加 20 上限和新增生命，回生膜额外成长，医疗针随上限恢复", () => {
    const w = new SliceWorld();
    w.player.hp = 50;
    w.grant("speed", 6);
    expect(w.player.maxHp).toBe(120);
    expect(w.player.hp).toBe(70);
    w.grant("leech", 2);
    expect(w.player.maxHp).toBe(140);
    expect(w.player.hp).toBe(90);
    w.heal();
    expect(w.player.hp).toBe(140);
    w.grant("glass");
    expect(w.player.maxHp).toBe(98);
  });
  it("换下再接回不会重复赚成长层数或免费治疗", () => {
    const w = new SliceWorld();
    w.grant("leech");
    w.grant("ram");
    w.player.hp = 40;
    w.pendingDrop = { id: 900, x: w.player.x + 70, y: w.player.y, organ: "speed" };
    w.drops.push(w.pendingDrop);
    w.equip(0);
    const layers = w.collectedLayers;
    w.pendingDrop = w.drops.find((d) => d.organ === "leech")!;
    w.equip(0);
    expect(w.collectedLayers).toBe(layers);
    expect(w.player.hp).toBe(40);
  });
  it("无限训练能装超过六种、选择敌人武器与副武器", () => {
    const w = new SliceWorld(false, 1, true, false, true);
    for (const o of organIds) w.grant(o);
    expect(w.slots).toHaveLength(organIds.length);
    w.enemies = [];
    w.trainingWeapon = "sniper";
    w.trainingSecondary = "drone";
    w.spawnTraining(1);
    expect(w.enemies[0].weapon).toBe("sniper");
    expect(w.enemies[0].secondary).toBe("drone");
  });
  it("凝霜与印记命中会实际施加状态，闪避无敌不会收到状态", () => {
    const { w, e } = fixture("freeze");
    for (let i = 0; i < 3; i++) {
      w.player.invulnerable = 0;
      w.hostile.damage(e, 1);
    }
    expect(w.hostile.playerStatus.frozen).toBe(0.5);
    expect(w.hostile.playerStatus.immune).toBe(3);
    e.organ = "mark";
    for (let i = 0; i < 3; i++) {
      w.player.invulnerable = 0;
      w.hostile.damage(e, 1);
    }
    expect(w.hostile.playerStatus.mark).toBe(8);
    w.hostile.playerStatus.hits = 0;
    w.player.invulnerable = 1;
    w.hostile.damage(e, 1);
    expect(w.hostile.playerStatus.hits).toBe(0);
  });
  it("同一发狙击穿过召唤物后仍命中玩家，但被地形截停", () => {
    const { w, e } = fixture("speed", "sniper");
    e.aimX = 900;
    e.aimY = 584;
    w.armory.units.push({ id: 1, type: "turret", x: 480, y: 584, hp: 100, cooldown: 10, invulnerable: 0 });
    w.hostile.shoot(e, 20, true, true);
    for (let i = 0; i < 100; i++) w.updateProjectiles(1 / 120);
    expect(w.armory.units[0].hp).toBe(80);
    expect(w.player.hp).toBe(80);
    w.projectiles = [];
    w.platforms.push({ x: 400, y: 560, w: 30, h: 100 });
    w.hostile.shoot(e, 20, true, true);
    for (let i = 0; i < 100; i++) w.updateProjectiles(1 / 120);
    expect(w.player.hp).toBe(80);
  });
  it("护盾减伤、手雷实体、无人机与炮台部署都实际工作", () => {
    const { w, e } = fixture("speed");
    e.secondary = "shield";
    e.cooldown = 2;
    e.chargeDirection = 1;
    w.hostile.tick(e, 0.01);
    expect(w.hostile.defend(e, 100)).toBe(40);
    for (const secondary of ["grenade", "drone", "turret"] as const) {
      e.secondary = secondary;
      w.hostile.kit(e).support = 0;
      w.hostile.tick(e, 0.01);
    }
    expect(w.hostile.bombs).toHaveLength(1);
    expect(w.hostile.units.map((u) => u.type)).toEqual(["drone", "turret"]);
    w.hostile.kit(e).support = 0;
    w.hostile.tick(e, 0.01);
    expect(w.hostile.units.filter((u) => u.type === "turret")).toHaveLength(1);
  });
  it("手炮第五发重击、步枪爆发与热量、锤第三段以及匕首非重击", () => {
    const { w, e } = fixture("discharge", "handgun");
    e.aimX = w.player.x;
    e.aimY = w.player.y;
    for (let i = 0; i < 5; i++) w.hostile.release(e);
    expect(w.projectiles.map((b) => w.hostile.shots.get(b)!.heavy)).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(w.hostile.kit(e).energy).toBe(1);
    e.weapon = "rifle";
    w.hostile.release(e);
    for (let i = 0; i < 80; i++) w.hostile.tick(e, 1 / 120);
    expect(w.hostile.kit(e).heat).toBeGreaterThan(60);
    e.weapon = "dagger";
    e.organ = "vulnerable";
    e.x = 600;
    e.chargeDirection = 1;
    w.player.invulnerable = 0;
    w.hostile.release(e);
    expect(w.hostile.playerStatus.vulnerable).toBe(0);
    e.weapon = "hammer";
    w.hostile.kit(e).combo = 2;
    w.player.invulnerable = 0;
    w.hostile.release(e);
    expect(w.hostile.playerStatus.vulnerable).toBe(4);
  });
});
