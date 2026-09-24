import type { Rect } from "../engine/PhysicsHelpers";
import type { EnemyKind } from "../engine/Enemy";
import type { OrganId, WeaponId, SecondaryId } from "./config";

// Authored spaces: coordinates, inhabitants and rewards are identical on every visit.
export const ascentSize = { width: 3000, height: 3300 };
export interface District {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  note: string;
}
export const districts: District[] = [
  {
    id: "sump",
    name: "沉井气闸",
    x: 150,
    y: 2850,
    w: 2700,
    h: 370,
    color: 0x416a69,
    note: "从地下出发 · 沿两侧检修梯上行",
  },
  {
    id: "pump",
    name: "西泵房",
    x: 180,
    y: 2400,
    w: 1220,
    h: 390,
    color: 0x776043,
    note: "墙边伏击 · 冲撞腺 / 压电骨",
  },
  {
    id: "roots",
    name: "东根室",
    x: 1610,
    y: 2400,
    w: 1220,
    h: 390,
    color: 0x485a75,
    note: "先处理高处射手 · 刻印眼 / 共鸣索",
  },
  {
    id: "forge",
    name: "断电锻台",
    x: 180,
    y: 1980,
    w: 1220,
    h: 390,
    color: 0x77523d,
    note: "窄口和背墙 · 放电髓成型",
  },
  {
    id: "colony",
    name: "孢囊温床",
    x: 1610,
    y: 1980,
    w: 1220,
    h: 390,
    color: 0x68517a,
    note: "群体守巢 · 播种囊成型",
  },
  {
    id: "rest",
    name: "检修中庭",
    x: 200,
    y: 1600,
    w: 2600,
    h: 320,
    color: 0x4c7861,
    note: "两路交汇 · 补给 / 启动回程升降台",
  },
  {
    id: "cold",
    name: "冷凝栈道",
    x: 180,
    y: 1140,
    w: 1220,
    h: 370,
    color: 0x477580,
    note: "高低交火 · 凝霜髓 / 碎晶核",
  },
  {
    id: "glass",
    name: "破顶温室",
    x: 1610,
    y: 1140,
    w: 1220,
    h: 370,
    color: 0x637a45,
    note: "暴露的奖励 · 开箱惊动守卫",
  },
  {
    id: "station",
    name: "地表货运站",
    x: 180,
    y: 700,
    w: 2640,
    h: 380,
    color: 0x6c7377,
    note: "组合实战 · 开启上层升降台",
  },
  {
    id: "crown",
    name: "天光母巢",
    x: 300,
    y: 250,
    w: 2400,
    h: 410,
    color: 0x865451,
    note: "可选首领 · 拿到核心后沿升降井撤退",
  },
];
const shelf = (x: number, top: number, w: number): Rect => ({ x, y: top + 9, w, h: 18, oneWay: true });
export const ascentPlatforms: Rect[] = [
  { x: 1500, y: 3190, w: 3000, h: 140 },
  shelf(750, 2700, 1040),
  shelf(2250, 2700, 1040),
  shelf(730, 2280, 1060),
  shelf(2270, 2280, 1060),
  shelf(1500, 1860, 2600),
  shelf(730, 1440, 1060),
  shelf(2270, 1440, 1060),
  shelf(1500, 1020, 2660),
  shelf(1500, 600, 2240),
  // Explicit combat pockets, high firing perches, and optional caches.
  shelf(500, 2590, 210),
  shelf(2500, 2595, 240),
  shelf(2150, 2500, 210),
  shelf(450, 2180, 210),
  shelf(780, 2110, 190),
  shelf(2510, 2170, 230),
  shelf(300, 1760, 180),
  shelf(2700, 1760, 180),
  shelf(400, 1335, 230),
  shelf(690, 1250, 240),
  shelf(2570, 1335, 230),
  shelf(2200, 930, 230),
  shelf(680, 930, 230),
  shelf(1080, 840, 240),
  shelf(1810, 820, 250),
  shelf(770, 490, 230),
  shelf(2230, 490, 230),
  // Hard surfaces are intentional knockback tools, not random obstacles.
  { x: 360, y: 2666, w: 36, h: 68 },
  { x: 990, y: 2246, w: 40, h: 68 },
  { x: 2590, y: 2246, w: 42, h: 68 },
  { x: 550, y: 1406, w: 42, h: 68 },
  { x: 940, y: 986, w: 40, h: 68 },
  { x: 2070, y: 986, w: 40, h: 68 },
];
// Six hand-positioned flights per side. 84 px rises fit the unmodified basic jump.
// Different offsets keep the approach to each combat floor distinct.
export const flights = [
  { bottom: 3120, left: [1120, 1260, 1120, 1260], right: [1880, 1740, 1880, 1740] },
  { bottom: 2700, left: [760, 900, 760, 900], right: [2120, 2260, 2120, 2260] },
  { bottom: 2280, left: [1100, 1240, 1100, 1240], right: [1880, 2020, 1880, 2020] },
  { bottom: 1860, left: [1130, 1270, 1130, 1270], right: [1870, 1730, 1870, 1730] },
  { bottom: 1440, left: [850, 990, 850, 990], right: [2340, 2200, 2340, 2200] },
  { bottom: 1020, left: [1260, 1400, 1260, 1400], right: [1740, 1600, 1740, 1600] },
];
for (const f of flights)
  for (const side of [f.left, f.right])
    side.forEach((x, i) => ascentPlatforms.push(shelf(x, f.bottom - 84 * (i + 1), 200)));

export interface Habitat {
  id: string;
  kind: EnemyKind;
  x: number;
  floor: number;
  organ: OrganId;
  hp: number;
  patrol: number;
  nest?: string;
  weapon?: WeaponId;
  secondary?: SecondaryId;
}
export const habitats: Habitat[] = [
  { id: "pump-scout", kind: "crawler", x: 1070, floor: 2700, organ: "ram", hp: 65, patrol: 160 },
  { id: "pump-guard", kind: "reclaimer", x: 610, floor: 2700, organ: "battery", hp: 145, patrol: 200 },
  {
    id: "root-scout",
    weapon: "handgun",
    kind: "crawler",
    x: 1900,
    floor: 2700,
    organ: "mark",
    hp: 65,
    patrol: 140,
  },
  {
    id: "root-eye",
    weapon: "sniper",
    kind: "floater",
    x: 2470,
    floor: 2570,
    organ: "conduit",
    hp: 95,
    patrol: 180,
  },
  { id: "forge-wall", kind: "reclaimer", x: 820, floor: 2280, organ: "discharge", hp: 200, patrol: 190 },
  { id: "forge-flank", kind: "crawler", x: 510, floor: 2280, organ: "knock", hp: 110, patrol: 130 },
  { id: "colony-a", kind: "crawler", x: 1950, floor: 2280, organ: "spread", hp: 115, patrol: 130 },
  { id: "colony-b", kind: "crawler", x: 2110, floor: 2280, organ: "mark", hp: 105, patrol: 150 },
  { id: "colony-c", kind: "crawler", x: 2240, floor: 2280, organ: "leech", hp: 100, patrol: 140 },
  {
    id: "colony-eye",
    weapon: "rifle",
    kind: "floater",
    x: 2470,
    floor: 2150,
    organ: "speed",
    hp: 100,
    patrol: 180,
  },
  {
    id: "cold-floor",
    weapon: "rifle",
    secondary: "shield",
    kind: "reclaimer",
    x: 1020,
    floor: 1440,
    organ: "freeze",
    hp: 260,
    patrol: 160,
  },
  { id: "cold-high", kind: "floater", x: 630, floor: 1260, organ: "shatter", hp: 175, patrol: 170 },
  {
    id: "glass-guard",
    weapon: "handgun",
    secondary: "drone",
    kind: "crawler",
    x: 2040,
    floor: 1440,
    organ: "overflow",
    hp: 185,
    patrol: 160,
  },
  {
    id: "glass-ambush-a",
    kind: "reclaimer",
    x: 2600,
    floor: 1440,
    organ: "shieldBurst",
    hp: 260,
    patrol: 210,
    nest: "glass-cache",
  },
  {
    id: "glass-ambush-b",
    weapon: "rifle",
    kind: "floater",
    x: 2330,
    floor: 1290,
    organ: "coolShield",
    hp: 170,
    patrol: 220,
    nest: "glass-cache",
  },
  {
    id: "station-west",
    secondary: "grenade",
    kind: "reclaimer",
    x: 780,
    floor: 1020,
    organ: "heavyArea",
    hp: 330,
    patrol: 220,
  },
  {
    id: "station-eye",
    weapon: "rifle",
    secondary: "turret",
    kind: "floater",
    x: 1850,
    floor: 890,
    organ: "hot",
    hp: 220,
    patrol: 210,
  },
  { id: "station-east", kind: "crawler", x: 2280, floor: 1020, organ: "vulnerable", hp: 240, patrol: 180 },
  {
    id: "mother",
    secondary: "grenade",
    kind: "elite",
    x: 1660,
    floor: 600,
    organ: "discharge",
    hp: 1600,
    patrol: 700,
  },
  { id: "mother-child-a", kind: "crawler", x: 1200, floor: 600, organ: "battery", hp: 170, patrol: 190 },
  { id: "mother-child-b", kind: "floater", x: 2090, floor: 475, organ: "conduit", hp: 175, patrol: 210 },
];
export interface Site {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: "cache" | "medical" | "lift" | "core";
  value: number;
  organ?: OrganId;
  note: string;
}
export const sites: Site[] = [
  {
    id: "starter",
    name: "出行补给柜",
    x: 1460,
    y: 3096,
    kind: "medical",
    value: 0,
    note: "医疗针 +1；两侧检修梯通向不同生态",
  },
  {
    id: "pump-cache",
    name: "泵工工具箱",
    x: 460,
    y: 2566,
    kind: "cache",
    value: 35,
    organ: "knock",
    note: "跳上泵体取箱；背墙可用于撞击",
  },
  {
    id: "root-cache",
    name: "根室样本柜",
    x: 2530,
    y: 2571,
    kind: "cache",
    value: 35,
    organ: "mark",
    note: "先移除高处射手，再占据射击位",
  },
  {
    id: "forge-cache",
    name: "热压保险箱",
    x: 790,
    y: 2086,
    kind: "cache",
    value: 65,
    organ: "speed",
    note: "锻台上层；从底层先看见，再绕上来",
  },
  {
    id: "colony-cache",
    name: "菌丝培养匣",
    x: 2520,
    y: 2146,
    kind: "cache",
    value: 65,
    organ: "conduit",
    note: "巢群背后的高台；适合印记扩散",
  },
  {
    id: "rest-med",
    name: "检修员急救站",
    x: 1450,
    y: 1836,
    kind: "medical",
    value: 0,
    note: "恢复 35 生命并补充 1 针；只可使用一次",
  },
  {
    id: "lift-low",
    name: "下井升降台开关",
    x: 1540,
    y: 1836,
    kind: "lift",
    value: 0,
    note: "从这里通电，开启通往气闸的实体升降台",
  },
  {
    id: "cold-cache",
    name: "冷藏器官匣",
    x: 690,
    y: 1226,
    kind: "cache",
    value: 95,
    organ: "freeze",
    note: "偏离主路攀上高处，取得冻结叠层",
  },
  {
    id: "glass-cache",
    name: "活性温床匣",
    x: 2630,
    y: 1311,
    kind: "cache",
    value: 120,
    organ: "leech",
    note: "可见两只休眠守卫；开箱会唤醒它们",
  },
  {
    id: "station-med",
    name: "旧站台药柜",
    x: 2700,
    y: 996,
    kind: "medical",
    value: 0,
    note: "登顶前最后补给；可以拿到就撤退",
  },
  {
    id: "lift-high",
    name: "上井升降台开关",
    x: 1500,
    y: 996,
    kind: "lift",
    value: 0,
    note: "接通货运站到中庭的第二段升降台",
  },
  {
    id: "roof-cache",
    name: "高架观察箱",
    x: 1080,
    y: 816,
    kind: "cache",
    value: 100,
    organ: "airPower",
    note: "母巢入口旁的可选高台",
  },
  {
    id: "core-cache",
    name: "母体核心匣",
    x: 1500,
    y: 576,
    kind: "core",
    value: 250,
    organ: "multi",
    note: "击败母体后解锁；沿升降井带回收获",
  },
];
