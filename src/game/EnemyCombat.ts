import { matchup } from "./expedition/Counters";
import { Projectile } from "../engine/Projectile";
import { distance, clamp } from "../engine/PhysicsHelpers";
import type { Carrier, SliceWorld } from "./SliceWorld";
import type { OrganId, WeaponId, SecondaryId } from "./config";

interface Status {
  mark: number;
  hits: number;
  chill: number;
  frozen: number;
  immune: number;
  vulnerable: number;
}
const status = (): Status => ({ mark: 0, hits: 0, chill: 0, frozen: 0, immune: 0, vulnerable: 0 });
interface Kit {
  shield: number;
  droneStock: number;
  heat: number;
  hotCycle: boolean;
  energy: number;
  shots: number;
  combo: number;
  rhythm: number;
  support: number;
  blocking: boolean;
  burst: number;
  burstAt: number;
  invuln: number;
  dodge: number;
  airJump: number;
  slam: number;
  slamY: number;
}
export interface EnemyUnit {
  id: number;
  owner: Carrier;
  type: "drone" | "turret";
  x: number;
  y: number;
  hp: number;
  cooldown: number;
  status: Status;
}
interface EnemyShot {
  owner: Carrier;
  heavy: boolean;
  powered: boolean;
  piercing: boolean;
  hitPlayer: boolean;
  hits: Set<number>;
}
export const enemyModuleHints: Record<OrganId, string> = {
  vitality: "每层增加 20 生命",
  armor: "每层 12 护甲，递减减伤",
  ram: "冲锋接触造成伤害",
  battery: "把目标击退撞墙获得充能",
  discharge: "充能强化重击并放电",
  mark: "三击施加印记",
  conduit: "沿印记传给你的召唤物",
  spread: "击杀标记召唤物时传播印记",
  speed: "攻击速度提高",
  leech: "摧毁召唤物恢复生命",
  knock: "攻击击退增强",
  glass: "生命降低、攻速提高",
  heavyArea: "重击产生范围冲击",
  shieldBurst: "燃烧护盾强化攻击",
  perfect: "闪避后获得充能",
  stunRegen: "冻结目标后缩短攻击等待",
  airJump: "空中摧毁召唤物获得再跳",
  hot: "高热增伤",
  fullRange: "蓄势时扩大攻击范围",
  coolShield: "从高热冷却后获得盾",
  rage: "失血提高攻击伤害",
  vent: "重击消耗目标印记散热",
  freeze: "连续命中积累冻结",
  stunKnock: "对冻结目标强击退",
  vulnerable: "重击施加易伤",
  shatter: "重击冻结目标碎冰",
  overflow: "接受治疗的溢出部分转盾",
  airPower: "空中攻击增伤扩域",
  slam: "跳起后下砸产生冲击",
  multi: "命中多个目标增伤",
};
export class EnemyCombat {
  kits = new WeakMap<Carrier, Kit>();
  shots = new WeakMap<Projectile, EnemyShot>();
  playerStatus = status();
  units: EnemyUnit[] = [];
  nextUnit = 1;
  bombs: { x: number; y: number; vx: number; vy: number; life: number; owner: Carrier }[] = [];
  warnings: { x: number; y: number; radius: number; life: number }[] = [];
  /** Enemy-side combo counters: proof that multi-organ chains actually fire. */
  chains = { wallCharges: 0, dischargeHeavies: 0, heavyAreas: 0, conducts: 0 };
  constructor(public w: SliceWorld) {}
  kit(e: Carrier) {
    let k = this.kits.get(e);
    if (!k) {
      k = {
        droneStock: 8,
        shield: 35 * e.count("shieldBurst"),
        heat: 0,
        hotCycle: false,
        energy: Math.min(3, 2 * e.count("discharge")),
        shots: 0,
        combo: 0,
        rhythm: 0,
        support: 2,
        blocking: false,
        burst: 0,
        burstAt: 0,
        invuln: 0,
        dodge: 4,
        airJump: 0,
        slam: 0,
        slamY: 0,
      };
      this.kits.set(e, k);
      if (!this.w.ecoIds.has(e)) {
        e.maxHp += 20 * e.count("vitality");
        e.hp += 20 * e.count("vitality");
      }
      if (!this.w.ecoIds.has(e) && e.count("glass")) {
        e.hp *= 0.7 ** e.count("glass");
        e.maxHp *= 0.7 ** e.count("glass");
      }
      if (!this.w.ecoIds.has(e) && e.count("leech")) {
        e.hp += 10 * e.count("leech");
        e.maxHp += 10 * e.count("leech");
      }
    }
    return k;
  }
  speed(e: Carrier) {
    return 1 + 0.25 * e.count("speed") + 0.4 * e.count("glass");
  }
  power(e: Carrier) {
    const k = this.kit(e);
    return (
      1 +
      (k.heat >= 60 ? 0.35 * e.count("hot") : 0) +
      0.8 * e.count("rage") * (1 - e.hp / e.maxHp) +
      (k.shield > 0 ? 0.5 * e.count("shieldBurst") : 0) +
      (!e.grounded ? 0.3 * e.count("airPower") : 0)
    );
  }
  radius(e: Carrier, r: number) {
    return r * (1 + 0.3 * e.count("fullRange") + (!e.grounded ? 0.2 * e.count("airPower") : 0));
  }
  heal(e: Carrier, amount: number) {
    const over = Math.max(0, e.hp + amount - e.maxHp);
    e.hp = Math.min(e.maxHp, e.hp + amount);
    if (e.count("overflow")) this.kit(e).shield += over * e.count("overflow");
  }
  defend(e: Carrier, amount: number) {
    amount /= 1 + 0.12 * e.count("armor");
    const k = this.kit(e);
    if (k.invuln > 0) return 0;
    if (k.blocking && (this.w.player.x - e.x) * e.chargeDirection >= 0) amount *= 0.4;
    const absorbed = Math.min(amount, k.shield);
    k.shield -= absorbed;
    return amount - absorbed;
  }
  damage(
    e: Carrier,
    amount: number,
    heavy = false,
    unit?: (typeof this.w.armory.units)[number],
    indirect = false,
  ) {
    const w = this.w,
      k = this.kit(e),
      target = unit ?? w.player;
    if (e.dead || (!unit && (w.god || w.player.invulnerable > 0)) || (unit && unit.invulnerable > 0))
      return false;
    const st = unit ? (this.unitStatuses.get(unit.id) ?? status()) : this.playerStatus;
    if (unit) this.unitStatuses.set(unit.id, st);
    const marked = st.mark > 0,
      wasFrozen = st.frozen > 0;
    let dealt = amount * e.damageFactor * this.power(e) * (st.vulnerable > 0 ? 1.2 : 1);
    // No organ-archetype multiplier against the player: the player cannot choose which archetype
    // they carry, so this would read as an unpredictable damage tax. The archetype is shown on the
    // enemy label as intelligence instead; the cycle's real job is deciding creature vs creature.
    if (!indirect && e.count("multi"))
      dealt *= 1 + 0.15 * e.count("multi") * w.armory.units.filter((u) => distance(u, target) < 160).length;
    const before = unit ? unit.hp : w.player.hp + w.shield;
    if (unit) {
      unit.hp -= dealt;
      unit.invulnerable = 0.25;
    } else w.hurtPlayer(dealt, e.x);
    if ((unit ? unit.hp : w.player.hp + w.shield) >= before) return false; // A perfect block/dodge must not receive status effects.
    if (!indirect) {
      if (e.count("mark") && ++st.hits >= Math.max(1, Math.ceil(3 / (1 + 0.35 * (e.count("mark") - 1))))) {
        st.hits = 0;
        st.mark = 8 + 2 * (e.count("mark") - 1);
      }
      if (e.count("freeze") && st.immune <= 0 && (st.chill += e.count("freeze")) >= 3) {
        st.chill = 0;
        st.frozen = 0.5;
        st.immune = 3;
        if (!unit) w.say("冻结！短暂失去移动 · 解冻后 3 秒免疫再次冻结");
      }
      if (heavy && e.count("stunRegen")) {
        st.frozen = 0.2;
        k.burstAt = 0;
        e.cooldown = Math.max(0, e.cooldown - 0.5 * e.count("stunRegen"));
      }
      if (heavy && e.count("vulnerable")) st.vulnerable = 4;
      if (heavy && e.count("vent") && st.mark > 0) {
        st.mark = 0;
        k.heat = Math.max(0, k.heat - 25 * e.count("vent"));
      }
      if (!unit) {
        // A ram charge is itself a shove, so ram + battery really pins the target on walls.
        const push =
          650 * e.count("knock") +
          (e.charge > 0 ? 700 * e.count("ram") : 0) +
          (wasFrozen ? 900 * e.count("stunKnock") : 0);
        w.player.externalX += Math.sign(w.player.x - e.x) * push;
        if (
          e.count("battery") &&
          push > 0 &&
          (w.player.x < 65 ||
            w.player.x > w.width - 65 ||
            w.platforms.some(
              (r) =>
                !r.oneWay &&
                Math.abs(r.x - w.player.x) < r.w / 2 + 50 &&
                Math.abs(r.y - w.player.y) < r.h / 2 + 24,
            ))
        ) {
          k.energy = Math.min(3, k.energy + e.count("battery"));
          this.chains.wallCharges++;
        }
      }
      if (e.count("conduit") && marked)
        for (const u of w.armory.units)
          if (u !== unit && this.unitStatuses.get(u.id)?.mark && distance(u, target) < 320) {
            this.chains.conducts++;
            this.damage(e, amount * (0.6 + 0.3 * (e.count("conduit") - 1)), false, u, true);
          }
      if (heavy && e.count("shatter") && wasFrozen) {
        st.frozen = 0;
        this.blast(e, target.x, target.y, 12 * e.count("shatter"), 150, true);
      }
    }
    if (unit && unit.hp <= 0) {
      this.heal(e, 5 + 20 * e.count("leech"));
      if (e.count("airJump") && !e.grounded) k.airJump = e.count("airJump");
      if (e.count("spread") && marked) {
        if (distance(w.player, unit) < 280) this.playerStatus.mark = 8;
        for (const u of w.armory.units)
          if (u !== unit && distance(u, unit) < 280) {
            const s = this.unitStatuses.get(u.id) ?? status();
            s.mark = 8;
            this.unitStatuses.set(u.id, s);
          }
      }
    }
    return true;
  }
  unitStatuses = new Map<number, Status>();
  blast(e: Carrier, x: number, y: number, amount: number, radius: number, indirect = false, heavy = true) {
    const w = this.w,
      r = this.radius(e, radius);
    this.warnings.push({ x, y, radius: r, life: 0.25 });
    if (distance(w.player, { x, y }) < r && w.canSee({ x, y }, w.player))
      this.damage(e, amount, heavy, undefined, indirect);
    for (const u of w.armory.units)
      if (distance(u, { x, y }) < r && w.canSee({ x, y }, u)) this.damage(e, amount, heavy, u, indirect);
  }
  shoot(e: Carrier, damage: number, heavy: boolean, piercing = false, x = e.x, y = e.y) {
    const k = this.kit(e),
      a = Math.atan2(e.aimY - y, e.aimX - x),
      powered = heavy && k.energy > 0;
    if (powered) {
      k.energy--;
      damage += 10;
    }
    const b = new Projectile(
      x,
      y,
      Math.cos(a) * (piercing ? 750 : 440),
      Math.sin(a) * (piercing ? 750 : 440),
      "enemy",
      damage,
      e.id,
    );
    this.shots.set(b, { owner: e, heavy, powered, piercing, hitPlayer: false, hits: new Set() });
    this.w.projectiles.push(b);
  }
  release(e: Carrier) {
    const k = this.kit(e);
    let heavy = false;
    if (e.weapon === "dagger" || e.weapon === "hammer") {
      k.combo = (k.combo + 1) % 3;
      heavy = e.weapon === "hammer" && k.combo === 0;
      k.rhythm = e.weapon === "dagger" ? Math.min(5, k.rhythm + 1) : 0;
      // Ram opens from range; up close the same body still swings its weapon (and its heavy).
      const ram = e.count("ram") > 0 && (e.ramNext || distance(e, this.w.player) > 110);
      e.ramNext = false;
      if (ram) {
        e.charge = 0.4 + 0.08 * (e.count("ram") - 1);
        return;
      }
      if (e.count("slam") && !e.grounded) {
        k.slam = 1;
        k.slamY = e.y;
        return;
      }
      let amount = e.weapon === "dagger" ? 12 * (1 + 0.2 * k.rhythm) : heavy ? 27 : 18;
      if (heavy && k.energy > 0 && e.count("discharge")) {
        k.energy--;
        amount += 10 * e.count("discharge");
        this.chains.dischargeHeavies++;
        this.blast(e, e.x, e.y, 9 * e.count("discharge"), 155);
      }
      this.blast(e, e.x + e.chargeDirection * 40, e.y, amount, heavy ? 145 : 95, false, heavy);
      if (heavy && e.count("heavyArea")) {
        this.chains.heavyAreas++;
        this.blast(e, e.x, e.y, 10 * e.count("heavyArea"), 165 + 35 * e.count("heavyArea"), true);
      }
    } else if (e.weapon === "sniper") {
      this.shoot(e, 25, true, true);
      k.heat = Math.min(100, k.heat + 25);
    } else if (e.weapon === "rifle") {
      k.burst = 4;
      k.burstAt = 0;
    } else {
      k.shots++;
      heavy = k.shots % 5 === 0;
      this.shoot(e, heavy ? 23 : 14, heavy);
      k.heat = Math.min(100, k.heat + 8);
    }
    if (k.airJump > 0 && !e.grounded) {
      k.airJump--;
      e.vy = -500;
    }
  }
  tick(e: Carrier, dt: number) {
    const w = this.w,
      k = this.kit(e);
    k.invuln = Math.max(0, k.invuln - dt);
    k.dodge -= dt;
    k.support -= dt;
    k.blocking =
      e.secondary === "shield" && e.windup <= 0 && e.charge <= 0 && e.stun <= 0 && e.cooldown > 0.3;
    if (k.heat >= 60) k.hotCycle = true;
    k.heat = Math.max(0, k.heat - (e.windup > 0 || k.burst > 0 ? 2 : 24) * dt);
    if (k.hotCycle && k.heat <= 35) {
      k.hotCycle = false;
      k.shield += 25 * e.count("coolShield");
    }
    k.shield = Math.max(0, k.shield - (1 + 12 * e.count("shieldBurst")) * dt);
    if (e.stun > 0 || e.frozen > 0) {
      k.burst = 0;
      k.blocking = false;
      return;
    }
    if (
      e.count("perfect") > 0 &&
      k.dodge <= 0 &&
      w.projectiles.some((b) => b.team === "player" && distance(b, e) < 100)
    ) {
      k.dodge = 5;
      k.invuln = 0.2;
      k.energy = Math.min(3, k.energy + e.count("perfect"));
      e.impulseX = Math.sign(e.x - w.player.x) * 550;
      w.emit("dash", e.x, e.y, 0xe7bd7b);
    }
    if (k.burst > 0) {
      k.burstAt -= dt;
      if (k.burstAt <= 0) {
        this.shoot(e, k.heat >= 60 ? 16 : 10, k.heat >= 60);
        k.heat = Math.min(100, k.heat + 20);
        k.burst--;
        k.burstAt = 0.14 / this.speed(e);
        if (k.heat >= 100) {
          k.burst = 0;
          e.cooldown = 2.8;
        }
      }
    }
    if (k.slam) {
      e.vy = 1050;
      if (e.grounded) {
        k.slam = 0;
        this.blast(e, e.x, e.y, 20 + Math.max(0, e.y - k.slamY) * 0.05, 180);
      }
    }
    if (k.support <= 0 && distance(e, w.player) < 650 && w.canSee(e, w.player)) {
      k.support = 6;
      if (e.secondary === "grenade") {
        const dx = clamp(w.player.x - e.x, -350, 350);
        this.bombs.push({ x: e.x, y: e.y - 10, vx: dx / 0.8, vy: -230, life: 0.8, owner: e });
      }
      if (
        e.secondary === "drone" &&
        k.droneStock > 0 &&
        this.units.filter((u) => u.owner === e && u.type === "drone").length < 3 &&
        this.units.length < 18
      ) {
        k.droneStock--;
        this.units.push({
          id: this.nextUnit++,
          owner: e,
          type: "drone",
          x: e.x,
          y: e.y - 65,
          hp: 35,
          cooldown: 1,
          status: status(),
        });
      }
      if (e.secondary === "turret" && this.units.length < 18) {
        this.units = this.units.filter((u) => u.owner !== e || u.type !== "turret");
        this.units.push({
          id: this.nextUnit++,
          owner: e,
          type: "turret",
          x: e.x,
          y: e.y + e.h / 2 - 16,
          hp: 65,
          cooldown: 1,
          status: status(),
        });
      }
    }
  }
  update(dt: number) {
    for (const st of [this.playerStatus, ...this.unitStatuses.values()]) {
      st.mark = Math.max(0, st.mark - dt);
      st.frozen = Math.max(0, st.frozen - dt);
      st.immune = Math.max(0, st.immune - dt);
      st.vulnerable = Math.max(0, st.vulnerable - dt);
    }
    for (const [id] of this.unitStatuses)
      if (!this.w.armory.units.some((u) => u.id === id)) this.unitStatuses.delete(id);
    for (const g of this.bombs) {
      g.life -= dt;
      g.vy += 580 * dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (
        g.life <= 0 ||
        this.w.platforms.some((r) => Math.abs(g.x - r.x) < r.w / 2 && Math.abs(g.y - r.y) < r.h / 2)
      ) {
        this.blast(g.owner, g.x, g.y - 10, 18, 135, true);
        g.life = -1;
      }
    }
    this.bombs = this.bombs.filter((g) => g.life > 0 && !g.owner.dead);
    this.units = this.units.filter((u) => u.hp > 0 && !u.owner.dead);
    for (const u of this.units) {
      u.cooldown -= dt;
      if (u.type === "drone") {
        u.x += (u.owner.x + Math.sin(this.w.time + u.id) * 60 - u.x) * Math.min(1, dt * 4);
        u.y += (u.owner.y - 70 - u.y) * Math.min(1, dt * 4);
      }
      if (u.cooldown <= 0 && distance(u, this.w.player) < 600 && this.w.canSee(u, this.w.player)) {
        u.owner.aimX = this.w.player.x;
        u.owner.aimY = this.w.player.y;
        this.shoot(u.owner, 8, false, false, u.x, u.y);
        u.cooldown = 0.95;
      }
    }
    this.warnings = this.warnings.filter((a) => (a.life -= dt) > 0).slice(-40);
  }
}
