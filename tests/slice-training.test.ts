import { describe, expect, it } from "vitest";
import { SliceWorld, Carrier } from "../src/game/SliceWorld";
import { idleControls } from "../src/engine/Player";
import { organIds, weapons, secondaries } from "../src/game/config";

const target = (w: SliceWorld, x = 300) => {
  const e = new Carrier("crawler", x, 580, "ram", 1);
  e.hp = e.maxHp = 10000;
  e.stun = 100;
  w.enemies.push(e);
  return e;
};
const fire = () => ({ ...idleControls(), fire: true, mx: 500, my: 580 });
describe("0.6 无尽训练 / 叠层与九武器", () => {
  it("28 种可接入，每组叠层改变数值，第七种替换时保留整组层数", () => {
    expect(organIds).toHaveLength(28);
    expect(Object.keys(weapons)).toHaveLength(5);
    expect(Object.keys(secondaries)).toHaveLength(4);
    for (const id of organIds) {
      const w = new SliceWorld();
      expect(w.grant(id, 3)).toBe(true);
      expect(w.count(id)).toBe(3);
    }
    const w = new SliceWorld();
    w.useBuild("wall", 4);
    w.grant("battery", 2);
    expect(w.count("battery")).toBe(6);
    expect(w.energyMax).toBe(13);
    expect(w.slots).toHaveLength(6);
    expect(w.grant("speed", 3)).toBe(false);
    // A refused grant still queues a resolvable panel: the drop is on the floor, so it can be swapped in.
    expect(w.pendingDrop?.organ).toBe("speed");
    expect(w.drops.some((d) => d.organ === "speed")).toBe(true);
    expect(w.equip(1)).toBe(true);
    expect(w.drops.find((d) => d.organ === "battery")?.stacks).toBe(6);
    expect(w.speedFactor()).toBe(1.75);
  });
  it("清场自动续波且变强，不清场也继续增援，有存活数量上限", () => {
    const w = new SliceWorld(false, 1, true);
    w.god = true;
    const initial = w.enemyHealthScale();
    w.enemies.forEach((e) => {
      e.dead = true;
    });
    w.step(1.3);
    expect(w.wave).toBe(2);
    expect(w.enemies.length).toBeGreaterThan(0);
    expect(w.enemyHealthScale()).toBeGreaterThan(initial);
    w.step(22.1);
    expect(w.wave).toBeGreaterThan(2);
    for (let i = 0; i < 10; i++) w.spawnTraining(24);
    expect(w.enemies.filter((e) => !e.dead)).toHaveLength(28);
  });
  it("可以指定 Boss 与掉落，关闭自动续波后清场不会擅自开波", () => {
    const w = new SliceWorld(false, 1, true);
    w.enemies.length = 0;
    w.trainingAuto = false;
    w.trainingKind = "elite";
    w.trainingOrgan = "freeze";
    w.trainingHealth = 10;
    w.spawnTraining(2);
    expect(
      w.enemies.every(
        (e) => e.kind === "elite" && e.organ === "freeze" && e.maxHp === 6500 && e.y + e.h / 2 <= 610,
      ),
    ).toBe(true);
    w.enemies.length = 0;
    w.step(30);
    expect(w.wave).toBe(1);
    expect(w.enemies).toHaveLength(0);
  });
  it("步枪高热发出重击，过热锁枪，散热后恢复", () => {
    const w = new SliceWorld();
    w.armory.switchPrimary("rifle");
    w.step(1.3, fire());
    expect(w.overheated).toBe(true);
    expect(w.projectiles.some((b) => w.armory.shots.get(b)?.heavy)).toBe(true);
    const shots = w.metrics.shots;
    w.step(0.3, fire());
    expect(w.metrics.shots).toBe(shots);
    w.step(3);
    expect(w.overheated).toBe(false);
    w.step(0.1, fire());
    expect(w.metrics.shots).toBeGreaterThan(shots);
  });
  it("狙击蓄力释放贯穿同一直线的两名目标，同颗子弹不反复伤害", () => {
    const w = new SliceWorld();
    w.armory.switchPrimary("sniper");
    const a = target(w, 320),
      b = target(w, 430);
    w.step(1.3, fire());
    expect(w.metrics.shots).toBe(0);
    w.step(0.3, { ...idleControls(), mx: 500, my: 580 });
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(w.metrics.hits).toBe(2);
  });
  it("匕首按住只砍一次，正确节律加层，失拍扣三层", () => {
    const w = new SliceWorld();
    w.armory.switchPrimary("dagger");
    w.step(0.1, fire());
    w.step(0.36);
    w.step(1 / 120, fire());
    expect(w.armory.rhythmStacks).toBe(1);
    const n = w.metrics.shots;
    w.step(0.5, fire());
    expect(w.metrics.shots).toBe(n);
    w.armory.rhythmStacks = 5;
    w.step(1);
    w.step(1 / 120, fire());
    expect(w.armory.rhythmStacks).toBe(2);
  });
  it("重锤第三段触发放电且消耗体力，前两段不消耗充能", () => {
    const w = new SliceWorld();
    w.armory.switchPrimary("hammer");
    w.grant("discharge");
    w.energy = 2;
    target(w, 240);
    w.armory.update(0.01, fire());
    expect(w.energy).toBe(2);
    w.player.fireCooldown = 0;
    w.armory.update(0.01, fire());
    expect(w.energy).toBe(2);
    w.player.fireCooldown = 0;
    w.armory.update(0.01, fire());
    expect(w.energy).toBe(1);
    expect(w.stamina).toBe(70);
    expect(w.metrics.chargedHits).toBe(1);
    expect(w.armory.swing.heavy).toBe(true);
  });
  it("盾正面起手完美格挡，持续格挡减伤 60%，背面仍受伤", () => {
    const w = new SliceWorld();
    w.armory.switchSecondary("shield");
    w.player.facing = 1;
    w.player.invulnerable = 0;
    w.armory.update(0.01, { ...idleControls(), phase: true });
    w.hurtPlayer(20, 500);
    expect(w.player.hp).toBe(100);
    w.armory.update(0.3, { ...idleControls(), phase: true });
    w.hurtPlayer(20, 500);
    expect(w.player.hp).toBe(92);
    w.player.invulnerable = 0;
    w.hurtPlayer(20, 0);
    expect(w.player.hp).toBe(72);
  });
  it("手雷按下蓄力不立即投掷，松开投掷且爆炸实际伤害目标", () => {
    const w = new SliceWorld();
    const e = target(w, 250);
    const c = { ...idleControls(), grab: true, mx: 260, my: 580 };
    w.step(0.6, c);
    expect(w.grenades).toHaveLength(0);
    w.step(0.01, { ...c, grab: false });
    expect(w.grenades).toHaveLength(1);
    w.step(0.8);
    expect(w.grenades).toHaveLength(0);
    expect(e.hp).toBeLessThan(e.maxHp);
  });
  it("无人机最多三架，摧毁后可补放但消耗总储备；炮台始终只有一座", () => {
    const w = new SliceWorld();
    w.armory.switchSecondary("drone");
    for (let i = 0; i < 4; i++) {
      w.grenadeCooldown = 0;
      w.armory.deploy();
    }
    expect(w.armory.units).toHaveLength(3);
    expect(w.armory.droneStock).toBe(5);
    target(w, 400);
    w.step(0.6);
    expect(w.metrics.shots).toBeGreaterThan(0);
    w.armory.units[0].hp = 0;
    w.step(0.01);
    w.grenadeCooldown = 0;
    w.armory.deploy();
    expect(w.armory.droneStock).toBe(4);
    w.armory.switchSecondary("turret");
    for (let i = 0; i < 3; i++) {
      w.grenadeCooldown = 0;
      w.armory.deploy();
    }
    expect(w.armory.units.filter((u) => u.type === "turret")).toHaveLength(1);
  });
  it("冻结层数缩短触发，重击碎冰命中周围，易伤影响后续伤害", () => {
    const w = new SliceWorld();
    w.grant("freeze", 3);
    w.grant("shatter", 2);
    w.grant("vulnerable", 2);
    const a = target(w),
      b = target(w, 340);
    a.stun = 0;
    w.hit(a, 10, true);
    expect(a.frozen).toBe(0);
    w.hit(a, 10, true);
    expect(a.frozen).toBe(2);
    w.hit(a, 10, true, 0, true);
    expect(w.metrics.shatters).toBe(1);
    expect(b.hp).toBe(b.maxHp - 90);
    const before = a.hp;
    w.hit(a, 10);
    expect(before - a.hp).toBeCloseTo(14);
  });
  it("击杀溢出治疗转盾、高热冷却转盾、燃盾增伤均有实际数值", () => {
    const w = new SliceWorld();
    w.grant("leech", 2);
    w.grant("overflow", 3);
    w.grant("coolShield", 2);
    w.grant("shieldBurst", 2);
    const a = target(w);
    w.hit(a, 10000);
    expect(w.shield).toBe(30);
    expect(w.power()).toBe(2);
    w.shield = 0;
    w.heat = 65;
    w.step(1.1);
    expect(w.shield).toBeGreaterThan(45);
    expect(w.heat).toBeLessThan(35);
  });
  it("训练死亡继续保留叠层并清理场上威胁", () => {
    const w = new SliceWorld(false, 1, true);
    w.useBuild("ice", 5);
    w.player.invulnerable = 0;
    w.hurtPlayer(1000, 0);
    expect(w.result).toBe("dead");
    w.reviveTraining();
    expect(w.result).toBe(null);
    expect(w.player.hp).toBe(w.player.maxHp);
    expect(w.count("freeze")).toBe(5);
    expect(w.enemies).toHaveLength(0);
  });
});
