import { expect, it } from "vitest";
import { Player, idleControls } from "../src/engine/Player";
import { buildGeometry } from "../src/game/expedition/ExpeditionGeometry";
it("档案支线可以用实际跳跃从维修区到封存书库，不穿墙或传送", () => {
  const g = buildGeometry(),
    p = new Player();
  p.boundsWidth = g.size.width;
  p.x = 880;
  p.y = 2176;
  p.grounded = true;
  const landings = [
    [880, 2122],
    [990, 2044],
    [880, 1966],
    [990, 1888],
    [880, 1810],
    [990, 1732],
    [880, 1654],
    [1010, 1576],
    [1120, 1532],
    [1270, 1454],
    [1120, 1376],
    [1210, 1332],
  ];
  for (const [x, surface] of landings) {
    let reached = false;
    for (let i = 0; i < 240; i++) {
      const delta = x - p.x;
      p.update(
        1 / 120,
        { ...idleControls(), left: delta < -8, right: delta > 8, jump: i === 0, jumpHeld: i < 60 },
        g.platforms,
      );
      if (i > 12 && p.grounded && p.y <= surface - 23 && Math.abs(p.x - x) < 60) {
        reached = true;
        break;
      }
    }
    expect(reached, `目标 ${x},${surface}；实际 ${p.x},${p.y}`).toBe(true);
  }
});
