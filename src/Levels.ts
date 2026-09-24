import type { Rect } from "./PhysicsHelpers";
import type { EnemyKind } from "./Enemy";
import type { ModuleKind } from "./EnemyModule";
export interface Spawn {
  kind: EnemyKind;
  x: number;
  y: number;
  variant?: "gun" | "thruster" | "shield";
}
export interface Room {
  name: string;
  subtitle: string;
  hint: string;
  platforms: Rect[];
  waves: Spawn[][];
  supplies: { kind: ModuleKind; x: number; y: number; angle: number }[];
  exit: Rect;
}
const floor: Rect = { x: 640, y: 665, w: 1280, h: 110 };
const exit: Rect = { x: 1205, y: 555, w: 54, h: 108 };
export const rooms: Room[] = [
  {
    name: "拆解的第一课",
    subtitle: "01 / CONTACT",
    hint: "靠近外置零件，用 F 连续震脱；射击核心可以快速结束战斗。",
    platforms: [floor, { x: 455, y: 507, w: 160, h: 22 }],
    waves: [
      [
        { kind: "crawler", x: 620, y: 580, variant: "thruster" },
        { kind: "crawler", x: 1030, y: 580, variant: "thruster" },
      ],
      [{ kind: "crawler", x: 1010, y: 580, variant: "gun" }],
    ],
    supplies: [],
    exit,
  },
  {
    name: "向上的可能",
    subtitle: "02 / ASCENT",
    hint: "地面的划痕向上延伸。拿起推进囊，调整喷口，再观察它对身体的作用。",
    platforms: [floor, { x: 1100, y: 310, w: 310, h: 24 }],
    waves: [
      [
        { kind: "crawler", x: 720, y: 580, variant: "thruster" },
        { kind: "crawler", x: 1050, y: 580, variant: "thruster" },
      ],
    ],
    supplies: [],
    exit: { x: 1205, y: 255, w: 54, h: 108 },
  },
  {
    name: "借来的防线",
    subtitle: "03 / SHELTER",
    hint: "蓝色甲壳能挡住弹道。完整拆下后，带着它向前推进。",
    platforms: [floor, { x: 710, y: 425, w: 200, h: 20 }],
    waves: [
      [
        { kind: "reclaimer", x: 710, y: 570, variant: "shield" },
        { kind: "floater", x: 1000, y: 390 },
        { kind: "crawler", x: 1060, y: 580, variant: "gun" },
      ],
    ],
    supplies: [],
    exit,
  },
  {
    name: "让零件相遇",
    subtitle: "04 / RECOMBINATION",
    hint: "喷流不会区分玩家和甲壳。试着改变两者的位置与朝向。",
    platforms: [floor],
    waves: [
      [
        { kind: "crawler", x: 800, y: 580, variant: "gun" },
        { kind: "crawler", x: 1000, y: 580, variant: "thruster" },
        { kind: "reclaimer", x: 1130, y: 580 },
      ],
      [
        { kind: "crawler", x: 910, y: 580, variant: "gun" },
        { kind: "crawler", x: 1110, y: 580, variant: "thruster" },
      ],
    ],
    supplies: [
      { kind: "thruster", x: 310, y: 594, angle: 0 },
      { kind: "shield", x: 430, y: 562, angle: -Math.PI / 2 },
    ],
    exit,
  },
  {
    name: "甲壳聚合体",
    subtitle: "05 / BLACK SUN",
    hint: "甲壳只覆盖一侧。你可以绕开它直击核心，也可以逐个拆走它的器官。",
    platforms: [
      floor,
      { x: 430, y: 465, w: 180, h: 20 },
      { x: 1080, y: 420, w: 200, h: 20 },
    ],
    waves: [[{ kind: "elite", x: 920, y: 560 }]],
    supplies: [],
    exit,
  },
];
