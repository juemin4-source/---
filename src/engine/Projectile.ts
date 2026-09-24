export type Team = "player" | "enemy" | "wild";
export class Projectile {
  life = 2;
  dead = false;
  implosion = false;
  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public team: Team,
    public damage = 12,
    public owner = 0,
  ) {}
}
