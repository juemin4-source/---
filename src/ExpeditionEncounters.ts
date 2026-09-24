import type { World } from "./World";
import type { ZoneDefinition } from "./ExpeditionMap";
import type { Salvage } from "./Expedition";
import type { EnemyKind } from "./Enemy";
import type { ModuleKind } from "./EnemyModule";
export function populateArea(
  w: World,
  z: ZoneDefinition,
  random: () => number,
  sortie: number,
): Salvage[] {
  const loot: Salvage[] = [];
  const floor = z.height - 134;
  const add = (
    label: string,
    x: number,
    y: number,
    kind: Salvage["kind"],
    material: number,
    core = 0,
    data = 0,
  ) =>
    loot.push({
      id: z.id + "-" + loot.length,
      label,
      x,
      y,
      kind,
      cargo: { material, core, data },
      taken: false,
    });
  const shift = (sortie % 2 ? 1 : -1) * (25 + Math.floor(random() * 55));
  if (z.id === "airlock") {
    add("出行维护物资", 580, floor, "cache", 12);
    return loot;
  }
  const groups = z.quiet
    ? 0
    : Math.max(
        Math.floor(z.width / 1800),
        z.depth <= 1 ? 2 : z.depth <= 4 ? 3 : z.id === "nest" ? 4 : 3,
      );
  for (let g = 0; g < groups; g++) {
    const x = 850 + (g * (z.width - 1400)) / Math.max(1, groups - 1) + shift;
    const kind: EnemyKind =
      z.id === "nest" && g === 2
        ? "elite"
        : g === 1 && z.depth >= 2
          ? "reclaimer"
          : (g + sortie) % 2
            ? "crawler"
            : "floater";
    const organ: ModuleKind =
      z.id === "service"
        ? "shield"
        : z.id === "archive"
          ? "grapple"
          : z.id === "turbine" && g === 1
            ? "shield"
            : g === 0
              ? "thruster"
              : "gun";
    const e = w.spawnEnemy(
      kind,
      x,
      floor - (kind === "floater" ? 190 : 0),
      organ === "grapple" ? "gun" : organ,
    );
    if (organ === "grapple" && !e.has("grapple"))
      w.modules.push(e.attach("grapple", 35, -30));
    e.salvageKind = organ;
    if (kind === "reclaimer") e.hp = e.maxHp = 130 + z.depth * 5;
    if (z.depth >= 3 && g !== 0)
      w.spawnEnemy("crawler", x + 190, floor, g % 2 ? "gun" : "thruster");
  }
  add(
    z.band.includes("西") ? "住户遗物" : "巡检材料",
    Math.min(z.width - 250, 1200 + shift),
    floor,
    "cache",
    8 + z.depth,
  );
  add(
    "离线观测记录",
    z.width - 570,
    floor,
    "cache",
    4,
    z.depth >= 3 ? 1 : 0,
    z.id === "archive" ? 5 : 2,
  );
  if (z.width >= 3000)
    add(
      "高处隐蔽储物箱",
      Math.min(z.width - 900, 1730),
      z.height - 494,
      "cache",
      8,
      z.depth >= 5 ? 2 : 0,
      3,
    );
  if (["service", "turbine", "shelter", "quarantine"].includes(z.id))
    add("应急医疗针 +1", Math.min(z.width - 330, 820), floor, "medkit", 0);
  if (["crater", "nest", "tower", "market"].includes(z.id))
    add(
      "高价值稳定核心",
      z.width - 900,
      floor,
      "cache",
      8,
      z.depth >= 7 ? 4 : 2,
      3,
    );
  return loot;
}
