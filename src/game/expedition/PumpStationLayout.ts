import type { DistrictId } from "./ExpeditionMap";
/** Fixed authored empty spaces. Their union is only compiled into collision; no room is generated. */
export const stationVoids: readonly (readonly [number, number, number, number])[] = [
  [820, 1430, 1040, 2200], // Archive service shaft: hand-placed jump landings.
  [1000, 1320, 1840, 1610], // Records vault, first branch above the workshop.
  [1750, 1570, 2070, 1823], // Return connection into the filter route.
  [1040, 1090, 1640, 1332], // Sealed upper library and star relic.
  [100, 2018, 700, 2200], // Safe airlock opens horizontally.
  [620, 2096, 900, 2200],
  [800, 1979, 1510, 2200], // Workshop: full-height work bay.
  [1450, 2057, 1940, 2200], // Lower tool corridor; different ceiling and sightline.
  [1870, 1986, 3220, 2278], // Drain basin, observation catwalk above feeding floor.
  [1900, 1726, 2240, 2278], // Filter equipment ascent, short jumps.
  [1800, 1648, 3300, 1823], // Filter route with low pipe ceiling.
  [2520, 1582, 2870, 1823], // Side pocket with nest.
  [3050, 1582, 3390, 1823], // Two jumps into west pump entrance.
  [3130, 2090, 3560, 2278], // East drainage mouth (jump out to warehouse).
  [3300, 1998, 5250, 2200], // Long warehouse aisles.
  [3440, 1875, 3940, 2200], // High rack bay.
  [4140, 1934, 4520, 2200], // Broken loading bay.
  [4590, 1596, 4900, 2200], // Rack ascent / heavy descent.
  [3300, 1388, 4900, 1680], // Pump arena; solid machine and bridge added below.
  [4820, 1570, 5500, 1680], // Quiet room behind the pump.
  [3350, 1088, 3680, 1680], // Control maintenance switchback.
  [3300, 887, 4700, 1160], // Upper control.
  [4600, 1043, 4860, 1160], // Sloping outer link, individually authored steps.
  [4780, 1076, 5080, 1238],
  [5000, 1154, 5300, 1316],
  [5220, 1232, 5660, 1394],
  [5370, 1316, 5680, 1680], // Short western rig approach / cargo descent.
  [5500, 1102, 6550, 1394], // Rig bay.
  [6290, 1322, 6630, 1680], // Outer loading descent around the building.
  [5940, 1602, 6630, 1758],
  [5750, 1667, 6080, 1992],
  [5120, 1901, 6080, 2070],
  [5120, 1986, 5350, 2200],
  [5760, 1348, 5920, 2070], // Powered freight lift; bypasses the long outside dogleg.
  [3130, 1641, 3260, 2200], // Locked maintenance ladder shortcut.
];

/** x, walkable surface, width. Individually placed equipment tops and landings. */
export const stationLedges: readonly (readonly [number, number, number])[] = [
  [880, 2122, 100],
  [990, 2044, 100],
  [880, 1966, 100],
  [990, 1888, 100],
  [880, 1810, 100],
  [990, 1732, 100],
  [880, 1654, 100],
  [1010, 1576, 110],
  [1780, 1688, 110],
  [1940, 1766, 110],
  [1120, 1532, 130],
  [1270, 1454, 130],
  [1120, 1376, 130],
  [1410, 1332, 460], // Upper library floor, with western jump entrance.
  [1990, 2200, 160],
  [2160, 2116, 150],
  [1990, 2031, 160],
  [2160, 1946, 150],
  [1990, 1862, 160],
  [2160, 1778, 150],
  [2550, 2109, 640],
  [2950, 2174, 160], // Observation deck and east exit.
  [3110, 1758, 170],
  [3280, 1680, 150],
  [4670, 2116, 150],
  [4820, 2031, 140],
  [4670, 1946, 150],
  [4820, 1862, 140],
  [4670, 1778, 150],
  [4820, 1693, 140],
  [4740, 1615, 210],
  [3440, 1596, 150],
  [3590, 1511, 150],
  [3440, 1426, 150],
  [3590, 1342, 150],
  [3440, 1258, 150],
  [3590, 1173, 150],
  [3440, 1095, 150],
  [5450, 1602, 150],
  [5600, 1518, 140],
  [5450, 1433, 150],
  [5600, 1355, 140],
  [6380, 1478, 180],
  [6510, 1563, 170],
  [6380, 1648, 180],
  [5980, 1823, 160],
  [5840, 1908, 150],
  [5220, 2135, 150],
  [3500, 2057, 250],
  [3840, 1992, 210],
  [4290, 2057, 270], // Warehouse racks.
  [3950, 1524, 720],
  [4460, 1582, 170],
  [3720, 1608, 150], // Pump bridge, flanks.
];
/** Solid cover is low enough to jump, but blocks ground shots and creates charge impacts. */
export const stationBlocks = [
  { x: 1210, y: 2174, w: 110, h: 52 },
  { x: 1680, y: 2180, w: 80, h: 39 },
  { x: 2530, y: 1804, w: 110, h: 39 },
  { x: 3660, y: 2174, w: 110, h: 52 },
  { x: 4110, y: 2168, w: 130, h: 65 },
  { x: 4020, y: 1641, w: 200, h: 78 },
  { x: 3800, y: 1134, w: 120, h: 52 },
  { x: 4350, y: 1128, w: 120, h: 65 },
];
export const stationRoutes: {
  a: DistrictId;
  b: DistrictId;
  kind: string;
  x: number;
  top: number;
  bottom: number;
  lock?: string;
}[] = [
  { a: "airlock", b: "cargo", kind: "walk", x: 680, top: 2200, bottom: 2200 },
  { a: "cargo", b: "lower", kind: "walk", x: 1900, top: 2200, bottom: 2200 },
  { a: "lower", b: "bed", kind: "jump", x: 2070, top: 1823, bottom: 2278 },
  { a: "lower", b: "heatx", kind: "jump", x: 3200, top: 2200, bottom: 2278 },
  { a: "bed", b: "control", kind: "jump", x: 3200, top: 1680, bottom: 1823 },
  { a: "heatx", b: "control", kind: "jump", x: 4740, top: 1680, bottom: 2200 },
  { a: "control", b: "cool", kind: "walk", x: 4900, top: 1680, bottom: 1680 },
  { a: "control", b: "deep", kind: "jump", x: 3510, top: 1160, bottom: 1680 },
  { a: "cool", b: "spine", kind: "jump", x: 5520, top: 1394, bottom: 1680 },
  { a: "spine", b: "heatx", kind: "freightLift", x: 5840, top: 1394, bottom: 2070 },
  { a: "control", b: "lower", kind: "shortcut", x: 3195, top: 1680, bottom: 2200, lock: "sewer-valve" },
];
