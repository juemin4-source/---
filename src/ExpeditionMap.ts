import type { Rect } from "./PhysicsHelpers";
export const zoneOrder = [
  "airlock",
  "concourse",
  "service",
  "archive",
  "turbine",
  "core",
  "pipes",
  "nursery",
  "freight",
  "quarantine",
  "station",
  "housing",
  "shelter",
  "viaduct",
  "market",
  "tower",
  "crown",
  "crater",
  "nest",
  "dome",
] as const;
export type ZoneId = (typeof zoneOrder)[number];
export interface Portal {
  id: string;
  to: ZoneId;
  x: number;
  y: number;
  arrival: { x: number; y: number };
  label: string;
  ability?: boolean;
  shortcut?: string;
}
export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  code: string;
  depth: number;
  mapX: number;
  mapY: number;
  description: string;
  platforms: Rect[];
  portals: Portal[];
  width: number;
  height: number;
  band: string;
  quiet: boolean;
  landmark: string;
}
const rows = [
  [
    "airlock",
    "城市气闸",
    1800,
    720,
    0,
    50,
    96,
    "地下 / 安全",
    "城市就在下方 · 返回这里长按 W 撤离",
    true,
  ],
  [
    "concourse",
    "地下主廊",
    12000,
    960,
    1,
    50,
    87,
    "地下 / 交通",
    "维修、档案、涡轮三路交汇 · S1 地表货梯回到此处",
    false,
  ],
  [
    "service",
    "维修回廊",
    3200,
    900,
    1,
    30,
    88,
    "地下 / 室内",
    "工具与应急医疗 · 温暖管道仍有人工维护痕迹",
    true,
  ],
  [
    "archive",
    "旧档案库",
    9000,
    1320,
    1,
    65,
    79,
    "地下 / 室内",
    "低处有常规通路，高架藏着离线记录",
    false,
  ],
  [
    "turbine",
    "涡轮大厅",
    10000,
    1440,
    2,
    38,
    77,
    "地下 / 供暖岛",
    "巨大涡轮仍有余热 · 中央检修廊可绕过守卫",
    false,
  ],
  [
    "core",
    "核心升降井",
    2400,
    3600,
    2,
    50,
    68,
    "地下 / 垂直",
    "沿维修阶梯向上 · 天井尽头是通往地表的冷却管线",
    false,
  ],
  [
    "pipes",
    "冷却管线层",
    12000,
    1680,
    3,
    50,
    58,
    "过渡 / 失温",
    "第一次寒流 · 培育区与货运站在上方分岔",
    false,
  ],
  [
    "nursery",
    "冻结温室层",
    3400,
    1440,
    3,
    35,
    48,
    "过渡 / 培育区",
    "冻死的培养架下仍有根种 · 安静的高台藏有记录",
    true,
  ],
  [
    "freight",
    "旧货运站",
    10000,
    1440,
    3,
    65,
    48,
    "过渡 / 工业",
    "起重机下是守卫宝库 · 上方维修道可以绕开重型星骸",
    false,
  ],
  [
    "quarantine",
    "表层隔离站",
    2200,
    1080,
    4,
    50,
    38,
    "过渡 / 最后庇护",
    "门内是供暖结构，门外是永夜 · 上方隔离闸通向地表",
    true,
  ],
  [
    "station",
    "旧车站广场",
    16000,
    1200,
    5,
    50,
    29,
    "地表 / 三岔枢纽",
    "西找活人 · 东探晨光塔 · 北追星骸 · 修复货梯可折返地下",
    false,
  ],
  [
    "housing",
    "冻结住宅区",
    12000,
    1680,
    5,
    28,
    28,
    "地表 / 西线",
    "公寓、室内连廊与旧避难标记 · 生命信号在西侧",
    false,
  ],
  [
    "shelter",
    "地表避难所",
    1600,
    720,
    5,
    18,
    38,
    "地表 / 安全岛",
    "暖风仍在运转 · 医疗补给与微弱生命信号",
    true,
  ],
  [
    "viaduct",
    "断裂高架",
    12000,
    2400,
    6,
    12,
    49,
    "地表 / 西侧高位",
    "沿断桥维护阶梯攀升 · 从此侧修复 S2 维修井",
    false,
  ],
  [
    "market",
    "冻结商业街",
    13000,
    1440,
    5,
    72,
    28,
    "地表 / 东线",
    "商店二层互通 · 宝箱密集，沿屋顶可以避战",
    false,
  ],
  [
    "tower",
    "晨光塔基座",
    3600,
    2880,
    6,
    80,
    40,
    "地表 / 光学设施",
    "晨光塔就在头顶 · 向上攀登，或修复通往旧货运站的 S3",
    false,
  ],
  [
    "crown",
    "晨光塔上层",
    6000,
    1680,
    6,
    87,
    52,
    "地表 / 高位",
    "高台藏有透镜 · 能力路线横跨高架，另一侧落向温室",
    true,
  ],
  [
    "crater",
    "星骸坠落坑",
    14000,
    1680,
    7,
    50,
    16,
    "地表 / 北线",
    "星骸侵占冻结岩层 · 70% 活化时休眠匣苏醒",
    false,
  ],
  [
    "nest",
    "聚合巢",
    8000,
    1680,
    8,
    50,
    5,
    "地表 / 极险",
    "可选的聚合体栖地 · 随时回头，不是必经终点",
    false,
  ],
  [
    "dome",
    "地表冻结温室",
    10000,
    1680,
    6,
    76,
    15,
    "地表 / 穹顶",
    "穹顶下仍有活物 · 商业街与坠落坑的第二回环",
    false,
  ],
] as const;
export const zones = Object.fromEntries(
  rows.map((r, i) => {
    const [
      id,
      name,
      width,
      height,
      depth,
      mapX,
      mapY,
      band,
      description,
      quiet,
    ] = r;
    const platforms: Rect[] = [
      { x: width / 2, y: height - 55, w: width, h: 110 },
    ];
    // Reachable maintenance stairs: normal jump is sufficient. Boost skips landings.
    const tiers = Math.floor((height - 620) / 95);
    for (let j = 0; j < tiers; j++)
      platforms.push({
        x: 450 + (5 - Math.abs(5 - (j % 10))) * 170,
        y: height - 200 - j * 95,
        w: 190,
        h: 20,
      });
    // Long overhead route above encounters; access stairs at either end.
    if (width >= 3000) {
      for (let side of [700, width - 1100])
        for (let j = 0; j < 3; j++)
          platforms.push({
            x: side + j * 190,
            y: height - 200 - j * 90,
            w: 160,
            h: 20,
          });
      for (let x = 1300; x < width - 850; x += 430)
        platforms.push({ x, y: height - 460, w: 340, h: 24 });
    }
    return [
      id,
      {
        id,
        name,
        code: String(i).padStart(2, "0") + " / " + id.toUpperCase(),
        width,
        height,
        depth,
        mapX,
        mapY,
        band,
        description,
        quiet,
        landmark: name,
        platforms,
        portals: [],
      },
    ];
  }),
) as unknown as Record<ZoneId, ZoneDefinition>;
const edges: number[][] = [
  [0, 1],
  [0, 2],
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 4],
  [3, 5],
  [4, 5],
  [5, 6],
  [6, 7],
  [6, 8],
  [7, 9],
  [8, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [12, 13],
  [10, 14],
  [14, 15],
  [15, 16],
  [14, 19],
  [19, 17],
  [17, 10],
  [17, 18],
  [10, 15],
  [10, 19],
  [17, 11],
];
const counts = new Map<ZoneId, number>();
function endpoint(id: ZoneId, up: boolean) {
  const z = zones[id],
    slot = counts.get(id) ?? 0;
  counts.set(id, slot + 1);
  if (id === "airlock") return { x: slot === 0 ? 1600 : 1000, y: 586 };
  if (up && (id === "core" || id === "tower")) {
    const p = z.platforms[Math.floor((z.height - 620) / 95)];
    return { x: p.x, y: p.y - 34 };
  }
  return {
    x: Math.min(
      z.width - 130,
      180 +
        (slot * (z.width - 360)) /
          Math.max(
            2,
            edges.filter((e) => e.includes(zoneOrder.indexOf(id))).length - 1,
          ),
    ),
    y: z.height - 134,
  };
}
for (const [ai, bi] of edges) {
  const a = zoneOrder[ai],
    b = zoneOrder[bi],
    pa = endpoint(a, bi > ai),
    pb = endpoint(b, false);
  const legacy: Record<string, string> = {
    "airlock:concourse": "out",
    "concourse:airlock": "back",
    "concourse:service": "service",
    "service:concourse": "back",
    "concourse:archive": "archive",
    "archive:concourse": "back",
    "concourse:turbine": "forward",
    "turbine:concourse": "back",
    "service:turbine": "shortcut",
    "turbine:service": "service",
    "turbine:core": "forward",
    "core:turbine": "back",
  };
  zones[a].portals.push({
    id: legacy[a + ":" + b] ?? b,
    to: b,
    ...pa,
    arrival: { x: pb.x + 85, y: pb.y },
    label:
      String(bi).padStart(2, "0") +
      " " +
      zones[b].name +
      " " +
      (zones[b].depth > zones[a].depth ? "↑ / 风险上升" : zones[b].depth < zones[a].depth ? "↓ / 靠近城市" : "↔ / 同层支路"),
  });
  zones[b].portals.push({
    id: legacy[b + ":" + a] ?? a,
    to: a,
    ...pb,
    arrival: { x: pa.x + 85, y: pa.y },
    label:
      String(ai).padStart(2, "0") +
      " " +
      zones[a].name +
      " " +
      (zones[a].depth > zones[b].depth ? "↑ / 风险上升" : zones[a].depth < zones[b].depth ? "↓ / 靠近城市" : "↔ / 同层支路"),
  });
}
// Side routes are physically elevated, never checked against an inventory key.
for (const [ai, bi] of [
  [13, 10],
  [16, 13],
  [16, 19],
  [14, 16],
]) {
  const a = zoneOrder[ai],
    b = zoneOrder[bi],
    z = zones[a];
  const x = z.width - 480 - z.portals.filter(p => p.ability).length * 740,
    y = z.height - 750;
  z.platforms.push({ x, y: y + 34, w: 200, h: 22 });
  // An indirect normal-jump route also reaches each lookout.
  for (let j = 0; j < 7; j++)
    z.platforms.push({
      x: x - 1330 + j * 190,
      y: z.height - 200 - j * 90,
      w: 155,
      h: 20,
    });
  zones[a].portals.push({
    id: "ability-" + b,
    to: b,
    x,
    y,
    arrival: { x: 300, y: zones[b].height - 134 },
    label: "高位通路 → " + zones[b].name,
    ability: true,
  });
}
for (const z of Object.values(zones))
  for (const p of z.platforms.slice(1)) p.oneWay = true;
export const shortcuts = [
  {
    id: "S1",
    from: "station",
    to: "concourse",
    x: 3200,
    cost: 8,
    duration: 3,
    label: "修复货运电梯",
    activity: 4,
  },
  {
    id: "S2",
    from: "viaduct",
    to: "turbine",
    x: 4400,
    cost: 12,
    duration: 3,
    label: "恢复旧维修井",
    activity: 3,
  },
  {
    id: "S3",
    from: "tower",
    to: "freight",
    x: 3200,
    cost: 35,
    duration: 5,
    label: "修复光塔货运线",
    activity: 5,
  },
] as const;
export function seededRandom(seed: number) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = n;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
