import { Body } from "./PhysicsHelpers";
import type { Enemy } from "./Enemy";
export type ModuleKind = "thruster" | "gun" | "shield" | "grapple";
export const moduleInfo: Record<ModuleKind, { name: string; color: number }> = {
  thruster: { name: "推进囊", color: 0xffb85b },
  gun: { name: "炮腕", color: 0xff7284 },
  shield: { name: "甲壳盾", color: 0x8dc7ed },
  grapple: { name: "牵引腕", color: 0xb799ff },
};
let nextModule = 1;
export class EnemyModule extends Body {
  id = nextModule++;
  hp = 64;
  maxHp = 64;
  connection = 100;
  stable = false;
  dead = false;
  held = false;
  mounted = false;
  dormant = false;
  angle = -Math.PI / 2;
  cooldown = 0.6;
  flash = 0;
  active = 0;
  targetX = 0;
  targetY = 0;
  stableAt = 0;
  constructor(
    public kind: ModuleKind,
    x: number,
    y: number,
    public parent: Enemy | null = null,
    public ox = 0,
    public oy = -42,
  ) {
    super(x, y, kind === "shield" ? 24 : 34, kind === "shield" ? 92 : 30);
    this.mass = kind === "shield" ? 3 : 1;
    if (kind === "shield") this.hp = this.maxHp = 150;
  }
  follow() {
    if (this.parent) {
      this.x = this.parent.x + this.ox;
      this.y = this.parent.y + this.oy;
    }
  }
  detach() {
    this.parent = null;
    this.connection = 0;
    this.vx = 80 * (Math.random() - 0.5);
    this.vy = -180;
    this.angle = -Math.PI / 2;
    this.cooldown = 0.75;
  }
  damage(amount: number) {
    this.hp -= amount;
    this.flash = 0.09;
    if (this.hp <= 0) {
      this.dead = true;
      this.stable = false;
    }
  }
}
