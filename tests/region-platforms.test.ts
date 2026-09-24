import { it, expect } from "vitest";
import { zones } from "../src/ExpeditionMap";
import { Player, idleControls } from "../src/Player";
it("the core shaft maintenance stairs are climbable with the baseline jump", () => {
  const z = zones.core,
    p = new Player();
  p.boundsWidth = z.width;
  p.x = 310;
  p.y = z.height - 134;
  const stairs = z.platforms.slice(1, Math.floor((z.height - 620) / 95) + 1);
  for (const platform of stairs) {
    const c = idleControls();
    c.jumpHeld = true;
    // Start beside the next platform; horizontal approach itself is tested by gameplay.
    p.x = platform.x + (p.x <= platform.x ? -1 : 1) * (platform.w / 2 + 45);
    p.vx = 0;
    p.vy = 0;
    p.grounded = true;
    p.coyote = 0.1;
    c.jump = true;
    let reached = false;
    for (let i = 0; i < 180; i++) {
      const dx = platform.x - p.x;
      c.left = dx < -12 && p.y + 24 < platform.y - platform.h / 2;
      c.right = dx > 12 && p.y + 24 < platform.y - platform.h / 2;
      p.update(1 / 120, c, z.platforms);
      c.jump = false;
      if (
        i > 4 &&
        p.grounded &&
        Math.abs(p.y - (platform.y - platform.h / 2 - 24)) < 3
      ) {
        reached = true;
        break;
      }
    }
    expect(reached, "landing at " + platform.x + "," + platform.y).toBe(true);
  }
});
