import { Body } from "./PhysicsHelpers";
import { EnemyModule } from "./EnemyModule";
export type EnemyKind = "crawler" | "floater" | "reclaimer" | "elite";
let nextEnemy = 1;
export class Enemy extends Body {
  id = nextEnemy++;
  tier = -1;
  hp = 90;
  maxHp = 90;
  dead = false;
  flash = 0;
  cooldown = 1;
  impulseX = 0;
  ramCooldown = 0;
  modules: EnemyModule[] = [];
  salvageKind?: EnemyModule["kind"];
  homeY: number;
  charge = 0;
  stun = 0;
  windup = 0;
  chargeDirection = 1;
  constructor(
    public kind: EnemyKind,
    x: number,
    y: number,
  ) {
    super(x, y, kind === "elite" ? 104 : kind === "reclaimer" ? 64 : 48, kind === "elite" ? 96 : 48);
    this.homeY = y;
    this.hp = this.maxHp =
      kind === "elite" ? 540 : kind === "reclaimer" ? 155 : kind === "floater" ? 110 : 90;
    this.mass = kind === "elite" ? 4 : 1;
  }
  attach(kind: EnemyModule["kind"], ox: number, oy: number) {
    const m = new EnemyModule(kind, this.x + ox, this.y + oy, this, ox, oy);
    this.modules.push(m);
    return m;
  }
  has(kind: EnemyModule["kind"]) {
    return this.modules.some((m) => m.parent === this && !m.dead && m.kind === kind);
  }
}
