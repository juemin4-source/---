import { Body, clamp, integrate, GRAVITY, type Rect } from "./PhysicsHelpers";
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
  moveFacing = 1;
  landed = 0;
  jumped = false;
  airJumpAvailable = true;
  airJumped = false;
  squash = 0;
  trailClock = 0;
  trails: { x: number; y: number; life: number }[] = [];
  /** Run-speed multiplier set by the game layer (e.g. frenzy). */
  moveScale = 1;
  constructor() {
    super(130, 580, 25, 48);
  }
  update(dt: number, c: Controls, platforms: Rect[]) {
    this.landed = 0;
    this.jumped = false;
    this.airJumped = false;
    if (this.grounded) this.airJumpAvailable = true;
    this.squash *= Math.exp(-dt * 16);
    for (const trail of this.trails) trail.life -= dt;
    this.trails = this.trails.filter((trail) => trail.life > 0);
    this.aim = Math.atan2(c.my - this.y, c.mx - this.x);
    this.facing = Math.cos(this.aim) >= 0 ? 1 : -1;
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.fireCooldown -= dt;
    this.meleeCooldown -= dt;
    this.invulnerable -= dt;
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = c.jump ? 0.15 : Math.max(0, this.jumpBuffer - dt);
    const dir = Number(c.right) - Number(c.left);
    if (dir) this.moveFacing = dir;
    if (c.dash && this.dashCooldown <= 0) {
      this.dashTime = 0.14;
      this.dashCooldown = 0.48;
      this.vx = (dir || this.moveFacing) * 880;
      this.vy = 0;
      this.invulnerable = Math.max(this.invulnerable, 0.14);
    }
    // An air jump can cancel a dash immediately; ground jumps keep their short dash lead-in.
    const airJump = c.jump && this.coyote <= 0 && this.airJumpAvailable;
    if (airJump) this.dashTime = 0;
    if (this.dashTime > 0 && this.dashTime < 0.09 && this.jumpBuffer > 0 && this.coyote > 0)
      this.dashTime = 0;
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.trailClock -= dt;
      if (this.trailClock <= 0) {
        this.trails.push({ x: this.x, y: this.y, life: 0.18 });
        this.trailClock = 0.025;
      }
      integrate(this, dt, platforms, 0);
      if (this.vx === 0) this.dashTime = 0;
      return;
    }
    const target = dir * 325 * this.moveScale;
    const acceleration = this.grounded ? (dir ? 6200 : 7800) : dir ? 3800 : 2400;
    this.vx += clamp(target - this.vx, -acceleration * dt, acceleration * dt);
    this.vx += this.externalX * dt;
    this.externalX *= Math.exp(-5 * dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -610;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.jumped = true;
      this.squash = -0.12;
    } else if (airJump) {
      this.airJumpAvailable = false;
      this.airJumped = true;
      this.jumped = true;
      this.vy = -590;
      this.jumpBuffer = 0;
      this.grounded = false;
      this.squash = -0.18;
    }
    if (!c.jumpHeld && this.vy < -250 && this.vy > -650) this.vy += 1900 * dt;
    const wasGrounded = this.grounded,
      fallSpeed = this.vy;
    const gravityScale = this.vy > 140 ? 1.3 : c.jumpHeld && Math.abs(this.vy) < 110 ? 0.6 : 1;
    integrate(this, dt, platforms, GRAVITY * gravityScale);
    if (!wasGrounded && this.grounded) {
      this.airJumpAvailable = true;
      this.landed = Math.max(0, fallSpeed);
      this.squash = Math.min(0.24, this.landed / 3500);
    }
  }
}
