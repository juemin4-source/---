import type { Enemy, EnemyKind } from "./Enemy";
import type { World } from "./World";

export const playerWeapon = {
  damage: 8,
  interval: 0.19,
  upgradedDamage: 9,
  upgradedInterval: 0.175,
} as const;
export const rigBalance = {
  gunDamage: 14,
  gunInterval: 0.72,
  heatPerShot: 28,
  cooling: 38,
  overheatCooling: 46,
  resumeHeat: 20,
  comboInterval: 2.4,
  blastDamage: 32,
  blastRadius: 118,
  pullRadius: 120,
  pullForce: 500,
  blastPull: 1050,
} as const;
export const enemyBands = [
  {
    name: "余烬型",
    zone: "地下",
    color: 0xb5a878,
    scale: 1,
    attack: 1,
    speed: 1,
    shotSpeed: 370,
    shotInterval: 1.65,
    hp: { crawler: 100, floater: 125, reclaimer: 190, elite: 520 },
  },
  {
    name: "霜结型",
    zone: "过渡层",
    color: 0x86c7d4,
    scale: 1.08,
    attack: 1.1,
    speed: 1.08,
    shotSpeed: 405,
    shotInterval: 1.5,
    hp: { crawler: 135, floater: 160, reclaimer: 250, elite: 660 },
  },
  {
    name: "棘甲型",
    zone: "地表",
    color: 0xda9871,
    scale: 1.17,
    attack: 1.25,
    speed: 1.16,
    shotSpeed: 445,
    shotInterval: 1.4,
    hp: { crawler: 180, floater: 205, reclaimer: 330, elite: 860 },
  },
  {
    name: "聚合型",
    zone: "坠落坑 / 聚合巢",
    color: 0xd481aa,
    scale: 1.26,
    attack: 1.4,
    speed: 1.23,
    shotSpeed: 485,
    shotInterval: 1.3,
    hp: { crawler: 230, floater: 260, reclaimer: 420, elite: 1100 },
  },
] as const;
export const bandIndex = (depth: number) => (depth >= 7 ? 3 : depth >= 5 ? 2 : depth >= 3 ? 1 : 0);
export const bodyNames: Record<EnemyKind, string> = {
  crawler: "突进骸",
  floater: "浮游骸",
  reclaimer: "回收骸",
  elite: "重构骸",
};

export function configureEnemy(w: World, e: Enemy, depth: number) {
  e.tier = bandIndex(depth);
  const b = enemyBands[e.tier];
  e.hp = e.maxHp = b.hp[e.kind];
  e.w = (e.kind === "elite" ? 104 : e.kind === "reclaimer" ? 64 : 48) * b.scale;
  e.h = (e.kind === "elite" ? 96 : 48) * b.scale;
  e.mass = (e.kind === "elite" ? 4 : e.kind === "reclaimer" ? 2 : 1) * (1 + e.tier * 0.6);
  const attach = (kind: "gun" | "shield", x: number, y: number) => {
    if (!e.has(kind)) w.modules.push(e.attach(kind, x, y));
  };
  if (e.kind === "reclaimer" && e.tier >= 1) attach("shield", -e.w / 2 - 26, -14);
  if (e.kind === "crawler" && e.tier >= 2) attach("gun", 22, -e.h / 2 - 22);
}
