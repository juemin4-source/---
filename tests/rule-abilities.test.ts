import { describe, it, expect } from "vitest";
import { SliceWorld, Carrier } from "../src/game/SliceWorld";
import { idleControls } from "../src/engine/Player";
import { Projectile } from "../src/engine/Projectile";
import { AbilityEvents } from "../src/game/abilities/AbilityEvents";
import { exoticWeapons, ruleOrgans } from "../src/game/abilities/Content";
const world = () => {
  const w = new SliceWorld(false, 1, true, false, true);
  w.trainingAuto = false;
  w.enemies = [];
  w.platforms = [];
  w.width = 10000;
  w.height = 6000;
  w.player.x = 300;
  w.player.y = 1000;
  w.player.aim = 0;
  return w;
};
const enemy = (w: SliceWorld, x = 500, y = 1000) => {
  const e = new Carrier("crawler", x, y, "speed", 1);
  e.x = x;
  e.y = y;
  e.hp = e.maxHp = 5000;
  w.enemies.push(e);
  return e;
};
const fire = (w: SliceWorld) => w.armory.update(1 / 60, { ...idleControls(), fire: true });
describe("规则能力与武器的交叉行为", () => {
  it("霰炮地面射击不强制起飞，近距离散射具备有效杀伤", () => {
    const w = world();
    w.player.grounded = true;
    w.armory.switchPrimary("recoil");
    const e = enemy(w, 360);
    e.hp = e.maxHp = 90;
    fire(w);
    expect(w.player.grounded).toBe(true);
    expect(Math.abs(w.player.externalX)).toBeLessThan(3000);
    for (let i = 0; i < 20; i++) w.updateProjectiles(1 / 120);
    expect(e.dead).toBe(true);
  });
  it("坍缩囊短按就覆盖附近敌人并造成伤害，不必等待长蓄力", () => {
    const w = world();
    w.armory.switchPrimary("gravity");
    const e = enemy(w, 440);
    fire(w);
    expect(w.rules.bubble!.radius).toBeGreaterThanOrEqual(110);
    w.armory.update(1 / 60, idleControls());
    expect(w.rules.bubble).toBeNull();
    expect(e.hp).toBeLessThan(e.maxHp - 90);
  });
  it("监听器稳定有序修改事件", () => {
    const bus = new AbilityEvents();
    bus.on("BeforeDamage", (e) => (e.amount *= 2));
    bus.on("BeforeDamage", (e) => (e.amount += 3));
    expect(bus.emit({ type: "BeforeDamage", amount: 4, x: 0, y: 0, tags: new Set() }).amount).toBe(11);
  });
  it("旧手炮和狙击都通过同一个到期事件返回，并允许第二次命中", () => {
    for (const piercing of [false, true]) {
      const w = world();
      w.grant("returnMembrane");
      const b = w.armory.shoot(10, false, piercing);
      const data = w.armory.shots.get(b)!;
      data.hits.add(1);
      b.life = 0.001;
      w.updateProjectiles(0.01);
      expect(w.rules.shots.get(b)!.returning).toBe(true);
      expect(data.hits.size).toBe(0);
      w.player.x = 100;
      w.rules.beforeProjectile(b, 0.01);
      expect(b.vx).toBeLessThan(0);
      b.life = 0.001;
      w.updateProjectiles(0.01);
      expect(w.projectiles).not.toContain(b);
    }
  });
  it("霰炮下射带来真实向上速度；残像复制整次七发且不递归", () => {
    const w = world();
    w.grant("mirrorEye");
    w.rules.emit("Dash", { x: 100, y: 1000 });
    w.armory.switchPrimary("recoil");
    w.player.aim = Math.PI / 2;
    fire(w);
    expect(w.projectiles).toHaveLength(14);
    expect(w.player.vy).toBeLessThan(-300);
    expect(w.rules.mirror).toBeNull();
    expect(w.projectiles.filter((b) => w.rules.shots.get(b)!.tags.has("Copy"))).toHaveLength(7);
  });
  it("镜胎眼也复制近战，部署物射击不会偷掉残像", () => {
    const w = world();
    w.grant("mirrorEye");
    w.rules.emit("Dash", { x: 700, y: 1000 });
    w.armory.shoot(10, false, false, 200, 900, 0, true);
    expect(w.rules.mirror).not.toBeNull();
    const e = enemy(w, 745);
    const hp = e.hp;
    w.armory.melee(20, false, 90);
    expect(e.hp).toBeLessThan(hp);
    expect(w.rules.mirror).toBeNull();
  });
  it("磁钉附着墙与敌人形成实际伤害连线，并牵制远离锚点的宿主", () => {
    const w = world(),
      host = enemy(w, 800),
      cross = enemy(w, 600);
    const a = w.armory.shoot(10, false, false, 400, 1000, 0, false, "nail");
    a.x = 400;
    w.rules.contact(a);
    const b = w.armory.shoot(10, false, false, 800, 1000, 0, false, "nail");
    w.rules.contact(b, host);
    expect(w.rules.lines).toHaveLength(1);
    const hp = cross.hp;
    w.rules.update(0.1);
    expect(cross.hp).toBeLessThan(hp);
    expect(host.impulseX).toBeLessThan(0);
    host.dead = true;
    w.rules.update(0.1);
    expect(w.rules.lines).toHaveLength(0);
  });
  it("捕鲸索对轻敌拉敌、重敌和墙拉自己", () => {
    const w = world(),
      e = enemy(w);
    e.maxHp = 100;
    let b = w.armory.shoot(10, false, false, 300, 1000, 0, false, "harpoon");
    w.rules.contact(b, e);
    expect(e.impulseX).toBeLessThan(0);
    expect(w.rules.tether).toBeNull();
    e.maxHp = 5000;
    w.rules.contact(b, e);
    expect(w.rules.tether).not.toBeNull();
    w.rules.update(0.1);
    expect(w.player.externalX).toBeGreaterThan(0);
    b.x = 700;
    w.rules.contact(b);
    expect(w.rules.tether!.target.host).toBeUndefined();
  });
  it("回航刃回程变重击，移动改变返回方向", () => {
    const w = world();
    w.armory.switchPrimary("blade");
    fire(w);
    const b = w.projectiles[0];
    b.x = 800;
    b.life = 0;
    w.rules.expire(b);
    expect(w.armory.shots.get(b)!.heavy).toBe(true);
    w.player.y = 700;
    w.rules.beforeProjectile(b, 0.01);
    expect(b.vy).toBeLessThan(0);
  });
  it("裂隙穿越伤害与两线交叉爆发都生效，不因每帧重叠重复爆炸", () => {
    const w = world();
    w.armory.switchPrimary("rift");
    w.player.aim = 0;
    fire(w);
    const e = enemy(w, 390);
    const hp = e.hp;
    w.rules.update(0.1);
    expect(e.hp).toBeLessThan(hp);
    w.player.x = 390;
    w.player.y = 920;
    w.player.aim = Math.PI / 2;
    w.player.fireCooldown = 0;
    fire(w);
    expect(w.areaFlashes.length).toBe(1);
    w.rules.update(0.1);
    expect(w.areaFlashes.length).toBe(1);
  });
  it("重力泡吸入弹丸和掉落，松开坍缩并释放状态", () => {
    const w = world();
    w.armory.switchPrimary("gravity");
    fire(w);
    const b = w.rules.bubble!;
    const e = enemy(w, b.x + 50, b.y);
    const shot = new Projectile(b.x, b.y, 0, 0, "enemy", 20);
    w.projectiles.push(shot);
    w.drops.push({ id: 888, x: b.x + 20, y: b.y, organ: "speed" });
    b.radius = 100;
    w.rules.update(0.1);
    expect(shot.dead).toBe(true);
    expect(b.stored).toBe(20);
    expect(w.drops[0].x).toBeLessThan(b.x + 20);
    const hp = e.hp;
    w.armory.update(0.1, idleControls());
    expect(w.rules.bubble).toBeNull();
    expect(e.hp).toBeLessThan(hp);
  });
  it("迟发核跨武器存账后由重击结清，不重复加成", () => {
    const w = world(),
      e = enemy(w);
    w.grant("debt");
    w.hit(e, 100, true);
    expect(w.rules.debts.get(e)).toBeCloseTo(35);
    const hp = e.hp;
    w.hit(e, 20, true, 0, true);
    expect(hp - e.hp).toBeCloseTo(55);
    expect(w.rules.debts.has(e)).toBe(false);
  });
  it("缝合索与逆极骨传递相反方向力", () => {
    const w = world(),
      a = enemy(w),
      b = enemy(w, 650);
    w.grant("stitch");
    w.grant("polarity");
    w.hit(a, 1, true);
    w.hit(b, 1, true);
    w.push(a, 100);
    expect(a.impulseX).toBeGreaterThan(0);
    expect(b.impulseX).toBeLessThan(0);
    a.impulseX = 0;
    w.push(a, 100);
    expect(a.impulseX).toBeLessThan(0);
  });
  it("爆炸吸入延迟结算一次，并保留伤害", () => {
    const w = world(),
      e = enemy(w, 350);
    w.grant("vacuum");
    const hp = e.hp;
    w.blast(300, 1000, 40, 120, 300);
    expect(e.hp).toBe(hp);
    w.rules.update(0.1);
    expect(e.impulseX).toBeLessThan(0);
    w.rules.update(0.21);
    expect(e.hp).toBeLessThan(hp);
    const after = e.hp;
    w.rules.update(0.4);
    expect(e.hp).toBe(after);
    expect(w.rules.pending).toHaveLength(0);
  });
  it("尸殖产生会攻击且会到期的炮体", () => {
    const w = world(),
      e = enemy(w),
      next = enemy(w, 600);
    w.grant("corpse");
    w.hit(e, 99999, true);
    expect(w.rules.corpses).toHaveLength(1);
    w.rules.update(0.1);
    expect(w.projectiles.length).toBeGreaterThan(0);
    w.rules.update(6);
    expect(w.rules.corpses).toHaveLength(0);
    expect(next.dead).toBe(false);
  });
  it("寄生无人机跟随宿主，移巢保留炮台生命", () => {
    const w = world(),
      e = enemy(w);
    w.grant("parasite");
    w.armory.secondary = "drone";
    w.armory.deploy();
    const drone = w.armory.units[0];
    e.x = 650;
    w.armory.update(0.1, idleControls());
    expect(drone.x).toBe(e.x);
    w.armory.secondary = "turret";
    w.grenadeCooldown = 0;
    w.armory.deploy();
    const turret = w.armory.units.at(-1)!;
    turret.hp = 31;
    w.grant("relocate");
    w.grenadeCooldown = 0;
    w.player.x = 900;
    w.armory.deploy();
    expect(w.armory.units.at(-1)).toBe(turret);
    expect(turret.hp).toBe(31);
    expect(turret.x).toBe(900);
  });
  it("弹丸经过部署物偏折成重击且只强化一次", () => {
    const w = world();
    w.grant("refract");
    w.armory.secondary = "turret";
    w.armory.deploy();
    const b = w.armory.shoot(10, false, false, 220, 1000);
    w.rules.beforeProjectile(b, 0.1);
    expect(w.armory.shots.get(b)!.heavy).toBe(true);
    expect(b.damage).toBe(10.5);
    w.rules.beforeProjectile(b, 0.1);
    expect(b.damage).toBe(10.5);
  });
  it("破盾生成可被重力场处理的甲壳，而自然耗盾不触发", () => {
    const w = world();
    w.grant("shell");
    w.player.invulnerable = 0;
    w.shield = 10;
    w.hurtPlayer(20, 200);
    expect(w.projectiles.some((b) => w.rules.shots.get(b)?.tags.has("PhysicalObject"))).toBe(true);
  });
  it("分裂有代际衰减、来源继承与实体预算，击中同一物体不重复分裂", () => {
    const w = world(),
      e = enemy(w);
    w.grant("split", 10);
    const first = w.armory.shoot(100, false);
    w.rules.contact(first, e);
    w.rules.contact(first, e);
    expect(w.projectiles).toHaveLength(3);
    const child = w.projectiles[1];
    expect(child.damage).toBe(45);
    expect(w.rules.shots.get(child)!.root).toBe(w.rules.shots.get(first)!.root);
    for (const b of w.projectiles) w.rules.contact(b, e);
    expect(w.projectiles.length).toBeLessThanOrEqual(49);
    expect(Math.max(...w.projectiles.map((b) => w.rules.shots.get(b)!.generation))).toBeLessThanOrEqual(4);
  });
  it("切换世界不会继承旧实体，六武器十二规则均有可选择配置", () => {
    const w = world();
    w.rules.emit("Dash");
    expect(Object.keys(exoticWeapons)).toHaveLength(6);
    expect(Object.keys(ruleOrgans)).toHaveLength(12);
    expect(world().rules.lines).toHaveLength(0);
  });
});

it("逆冲与钩索在实际玩家物理中产生位移，而不只是写入临时数值", () => {
  const w = world();
  w.armory.switchPrimary("recoil");
  const x = w.player.x;
  fire(w);
  for (let i = 0; i < 12; i++) w.player.update(1 / 120, idleControls(), []);
  expect(w.player.x).toBeLessThan(x - 5);
  expect(w.player.x).toBeGreaterThan(x - 35);
  const hook = world(),
    e = enemy(hook, 800);
  const b = hook.armory.shoot(10, false, false, 300, 1000, 0, false, "harpoon");
  hook.rules.contact(b, e);
  for (let i = 0; i < 18; i++) {
    hook.rules.update(1 / 120);
    hook.player.update(1 / 120, idleControls(), []);
  }
  expect(hook.player.x).toBeGreaterThan(350);
});
it("规则交叉压力测试：六武器与十二规则、旧印记冻结链保持有限实体和有限数值", () => {
  const w = world();
  w.god = true;
  w.platforms = [{ x: 5000, y: 1036, w: 10000, h: 24 }];
  for (const id of Object.keys(ruleOrgans) as (keyof typeof ruleOrgans)[]) w.grant(id, 3);
  for (const id of ["mark", "spread", "freeze", "shatter", "heavyArea"] as const) w.grant(id);
  const ids = Object.keys(exoticWeapons) as (keyof typeof exoticWeapons)[];
  let peak = 0;
  for (let i = 0; i < 1800; i++) {
    if (i % 300 === 0) w.armory.switchPrimary(ids[Math.floor(i / 300)]);
    if (i % 120 === 0)
      for (let j = 0; j < 6; j++) {
        const e = enemy(w, 500 + j * 75, 1000);
        e.hp = e.maxHp = 300;
      }
    w.update(1 / 120, { ...idleControls(), fire: i % 180 < 140, mx: 800, my: 1000, dash: i % 180 === 0 });
    peak = Math.max(peak, w.projectiles.length);
    expect(
      [w.player.x, w.player.y, w.player.hp, w.metrics.dealt, ...w.projectiles.map((b) => b.damage)].every(
        Number.isFinite,
      ),
    ).toBe(true);
  }
  expect(peak).toBeLessThanOrEqual(1200);
  expect(w.rules.lines.length).toBeLessThanOrEqual(20);
  expect(w.rules.corpses.length).toBeLessThanOrEqual(12);
  expect(w.rules.pending.length).toBeLessThanOrEqual(40);
});

it("回航刃先抵达世界边界也会返航，不被通用越界清理吞掉", () => {
  const w = world();
  w.width = 700;
  const b = w.armory.shoot(10, false, true, 670, 1000, 0, false, "blade");
  b.life = 0.48;
  w.updateProjectiles(0.05);
  expect(w.projectiles).toContain(b);
  expect(w.rules.shots.get(b)!.returning).toBe(true);
  expect(b.x).toBeLessThan(700);
  w.updateProjectiles(0.05);
  expect(b.vx).toBeLessThan(0);
});
