import { Body, clamp, integrate, type Rect } from "./PhysicsHelpers";
export interface Controls {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpHeld: boolean;
  dash: boolean;
  fire: boolean;
  phase: boolean;
  melee: boolean;
  grab: boolean;
  rotate: number;
  mx: number;
  my: number;
}
export const idleControls = (): Controls => ({
  left: false,
  right: false,
  jump: false,
  jumpHeld: false,
  dash: false,
  fire: false,
  phase: false,
  melee: false,
  grab: false,
  rotate: 0,
  mx: 800,
  my: 400,
});
export class Player extends Body {
  hp = 100;
  maxHp = 100;
  aim = 0;
  facing = 1;
  dashTime = 0;
  dashCooldown = 0;
  fireCooldown = 0;
  meleeCooldown = 0;
  invulnerable = 0;
  coyote = 0;
  jumpBuffer = 0;
  externalX = 0;
  constructor() {
    super(130, 580, 25, 48);
  }
  update(dt: number, c: Controls, platforms: Rect[]) {
    this.aim = Math.atan2(c.my - this.y, c.mx - this.x);
    this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.fireCooldown -= dt;
    this.meleeCooldown -= dt;
    this.invulnerable -= dt;
    this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = c.jump ? 0.12 : Math.max(0, this.jumpBuffer - dt);
    const dir = Number(c.right) - Number(c.left);
    if (c.dash && this.dashCooldown <= 0) {
      this.dashTime = 0.14;
      this.dashCooldown = 0.68;
      this.vx = (dir || this.facing) * 880;
      this.vy = 0;
      this.invulnerable = 0.18;
    }
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      integrate(this, dt, platforms, 0);
      return;
    }
    const target = dir * 325;
    this.vx += clamp(
      target - this.vx,
      -(this.grounded ? 4100 : 2100) * dt,
      (this.grounded ? 4100 : 2100) * dt,
    );
    this.vx += this.externalX * dt;
    this.externalX *= Math.exp(-5 * dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -610;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
    }
    if (!c.jumpHeld && this.vy < -250 && this.vy > -650) this.vy += 1900 * dt;
    integrate(this, dt, platforms);
  }
}
