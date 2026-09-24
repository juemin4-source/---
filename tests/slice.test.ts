import { describe, expect, it } from "vitest";
import { Carrier, SliceWorld, parseSave } from "../src/game/SliceWorld";
import { idleControls } from "../src/engine/Player";
import { Player } from "../src/engine/Player";
import { zones, type OrganId } from "../src/game/config";

describe("器官猎场 / 玩法闭环", () => {
  it("母体以自身高度落在地板上，长时间冲锋和击退不会掉出世界", () => {
    const w = new SliceWorld();
    w.enter("core");
    w.god = true;
    const boss = w.enemies.find((e) => e.kind === "elite")!;
    expect(boss.y + boss.h / 2).toBeLessThanOrEqual(610);
    for (let i = 0; i < 7200; i++) {
      if (i % 120 === 0) w.push(boss, i % 240 ? 1600 : -1600);
      w.update(1 / 120, idleControls());
    }
    expect(boss.y + boss.h / 2).toBeLessThanOrEqual(610);
    expect(boss.x).toBeGreaterThan(0);
    expect(boss.x).toBeLessThan(1280);
  });
  it("两条猎取路线都能不杀 Boss 返回气闸，全部十种模块可取得", () => {
    const seen = new Set<string>();
    const visit = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      for (const p of zones[id].portals.filter((p) => !p.shortcut)) visit(p.to);
    };
    visit("hub");
    expect(seen.size).toBe(7);
    for (const [id, z] of Object.entries(zones))
      for (const p of z.portals) expect(zones[p.to].portals.some((back) => back.to === id)).toBe(true);
    expect(new Set(Object.values(zones).flatMap((z) => z.spawns.map((s) => s.organ))).size).toBe(10);
    const w = new SliceWorld();
    w.player.x = 475;
    expect(w.travel("west")).toBe(true);
    w.player.x = 75;
    expect(w.travel("hub")).toBe(true);
    expect(w.stats.kills).toBe(0);
  });
  it("门只允许靠近使用，未修复捷径不能通行", () => {
    const w = new SliceWorld();
    expect(w.travel("west")).toBe(false);
    w.player.x = 1140;
    expect(w.travel("junction")).toBe(false);
    const repaired = new SliceWorld(true);
    repaired.player.x = 1140;
    expect(repaired.travel("junction")).toBe(true);
  });
  it("跨区域保留已击杀敌人、掉落和已搜索箱子，不能刷新刷取收益", () => {
    const w = new SliceWorld();
    w.enter("west");
    const e = w.enemies[0];
    w.hit(e, 999);
    w.player.x = 1010;
    w.player.y = 584;
    w.interact();
    const amount = w.cargo;
    w.enter("hub");
    w.enter("west");
    expect(w.enemies[0].dead).toBe(true);
    expect(w.drops).toHaveLength(1);
    expect(w.areas.west.searched).toBe(true);
    expect(w.cargo).toBe(amount);
  });
  it("第七种必须替换，换下的模块留在地面，同类器官叠层不占新槽", () => {
    const w = new SliceWorld();
    for (const id of ["ram", "battery", "discharge", "mark", "conduit", "spread"] as OrganId[]) {
      const d = { id: w.nextDrop++, x: 200, y: 585, organ: id };
      w.drops.push(d);
      w.pendingDrop = d;
      expect(w.equip()).toBe(true);
    }
    const d = { id: w.nextDrop++, x: 200, y: 585, organ: "leech" as const };
    w.drops.push(d);
    w.pendingDrop = d;
    expect(w.equip()).toBe(false);
    expect(w.equip(1)).toBe(true);
    expect(w.slots).toHaveLength(6);
    expect(w.drops.find((d) => d.organ === "battery")).toBeDefined();
    expect(w.metrics.swaps).toBe(1);
    const duplicate = { id: w.nextDrop++, x: 200, y: 585, organ: "ram" as const };
    w.drops.push(duplicate);
    w.pendingDrop = duplicate;
    expect(w.equip(0)).toBe(true);
    expect(w.slots[0]).toBe("ram");
    expect(w.count("ram")).toBe(2);
    expect(w.slots).toHaveLength(6);
  });
  it("拆下裂心瓣恢复生命上限但不凭空回血", () => {
    const w = new SliceWorld();
    const a = { id: 1, x: 200, y: 585, organ: "glass" as const };
    w.drops.push(a);
    w.pendingDrop = a;
    w.equip();
    expect(w.player.hp).toBe(70);
    const b = { id: 2, x: 200, y: 585, organ: "ram" as const };
    w.drops.push(b);
    w.pendingDrop = b;
    w.equip(0);
    expect(w.player.maxHp).toBe(100);
    expect(w.player.hp).toBe(70);
  });
  it("连续三次直接射击挂印，传导只发生一层且不累计命中", () => {
    const w = new SliceWorld();
    w.slots = ["mark", "conduit"];
    const a = new Carrier("crawler", 500, 585, "mark", 1),
      b = new Carrier("crawler", 600, 585, "conduit", 1);
    w.enemies = [a, b];
    b.mark = 8;
    for (let i = 0; i < 3; i++) w.hit(a, 10, true);
    expect(a.mark).toBe(8);
    expect(b.hp).toBe(b.maxHp);
    w.hit(a, 10, true);
    expect(b.hp).toBe(b.maxHp - 6);
    expect(w.metrics.transmissions).toBe(1);
    expect(b.hits).toBe(0);
  });
  it("击杀印记目标会传播，范围外目标不受影响", () => {
    const w = new SliceWorld();
    w.slots = ["spread"];
    const a = new Carrier("crawler", 500, 585, "mark", 1),
      b = new Carrier("crawler", 600, 585, "mark", 1),
      c = new Carrier("crawler", 1000, 585, "mark", 1);
    w.enemies = [a, b, c];
    a.mark = 8;
    w.hit(a, 999);
    expect(b.mark).toBe(8);
    expect(c.mark).toBe(0);
    expect(w.metrics.spreads).toBe(1);
  });
  it("真实击退撞到边界获得充能，敌人原地贴墙不会持续刷能量", () => {
    const w = new SliceWorld();
    w.slots = ["battery"];
    w.player.x = 100;
    const e = new Carrier("crawler", 1215, 585, "ram", 1);
    w.enemies = [e];
    w.push(e, 800);
    w.step(0.3);
    expect(w.energy).toBe(1);
    expect(w.metrics.wallCharges).toBe(1);
    w.step(2);
    expect(w.energy).toBe(1);
  });
  it("第五发才消耗充能，子弹命中会产生范围放电", () => {
    const w = new SliceWorld();
    w.slots = ["discharge"];
    w.energy = 2;
    w.player.x = 180;
    const e = new Carrier("crawler", 450, 585, "ram", 1);
    e.hp = e.maxHp = 1000;
    w.enemies = [e];
    const c = idleControls();
    c.fire = true;
    c.mx = 450;
    c.my = 585;
    w.step(0.8, c);
    expect(w.energy).toBe(2);
    w.step(0.65, c);
    expect(w.energy).toBe(1);
    expect(w.metrics.chargedHits).toBe(1);
  });
  it("模块选择界面冻结战斗，不能造成敌人偷袭", () => {
    const w = new SliceWorld();
    w.pendingDrop = { id: 1, x: 0, y: 0, organ: "ram" };
    w.step(2);
    expect(w.time).toBe(0);
  });
  it("气闸必须连续按住两秒，移开或松手中断，Boss 不是撤离条件", () => {
    const w = new SliceWorld();
    for (let i = 0; i < 150; i++) w.update(1 / 120, idleControls(), true);
    expect(w.result).toBeNull();
    w.update(1 / 120, idleControls(), false);
    expect(w.extraction).toBe(0);
    for (let i = 0; i < 245; i++) w.update(1 / 120, idleControls(), true);
    expect(w.result).toBe("extracted");
    expect(w.stats.kills).toBe(0);
  });
  it("死亡不能撤离或治疗，损失记录包含本次携带样本", () => {
    const w = new SliceWorld();
    w.cargo = 90;
    w.player.invulnerable = 0;
    w.hurtPlayer(100, 0);
    w.heal();
    expect(w.result).toBe("dead");
    expect(w.player.hp).toBe(0);
    expect(w.log.at(-1)?.detail).toBe("lost=90");
  });
  it("旧档案或损坏数据安全回退，新档只恢复合法字段", () => {
    expect(parseSave("{broken").bank).toBe(0);
    expect(parseSave('{"version":0}').trips).toBe(0);
    const s = parseSave(
      JSON.stringify({
        version: 1,
        bank: 90,
        trips: 2,
        research: ["ram", "ram", "bad"],
        shortcut: true,
        active: true,
      }),
    );
    expect(s.research).toEqual(["ram"]);
    expect(s.shortcut).toBe(true);
    expect(s.active).toBe(true);
  });
  it("普通接触不伤人，近战只能在预警后的冲锋窗口造成伤害", () => {
    const w = new SliceWorld();
    w.player.x = 500;
    w.player.invulnerable = 0;
    const e = new Carrier("crawler", 500, 584, "ram", 1);
    e.cooldown = 10;
    w.enemies = [e];
    w.updateEnemy(e, 1 / 120);
    expect(w.player.hp).toBe(100);
    e.charge = 0.3;
    w.updateEnemy(e, 1 / 120);
    expect(w.player.hp).toBe(86);
  });
  it("重复器官掉在门口也不会阻断撤退", () => {
    const w = new SliceWorld();
    w.enter("west");
    w.player.x = 75;
    w.drops.push({ id: 1, x: 75, y: 585, organ: "ram" });
    w.slots = ["ram"];
    expect(w.nearby()?.type).toBe("portal");
    w.interact();
    expect(w.zoneId).toBe("hub");
  });
  it("每个区域的门之间，都能用基础移动和跳跃往返，不依赖模块", () => {
    for (const [id, zone] of Object.entries(zones)) {
      const points = [...zone.portals.map((p) => p.x), zone.chest?.x ?? 180];
      for (const from of points)
        for (const to of points) {
          const p = new Player();
          p.x = from;
          p.y = 584;
          let reached = false;
          for (let i = 0; i < 2400; i++) {
            if (Math.abs(p.x - to) < 30 && Math.abs(p.y - 584) < 70) {
              reached = true;
              break;
            }
            const c = idleControls(),
              direction = Math.sign(to - p.x);
            c.left = direction < 0;
            c.right = direction > 0;
            c.jumpHeld = true;
            c.jump =
              p.grounded &&
              zone.platforms.some(
                (r) => !r.oneWay && r.h < 100 && Math.abs(r.x - p.x) < 85 && (r.x - p.x) * direction > 0,
              );
            p.update(1 / 120, c, zone.platforms);
          }
          expect(reached, `${id}: ${from} → ${to}`).toBe(true);
        }
    }
  });
});
