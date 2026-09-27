import type { OrganId } from "../config";
import type { DistrictId } from "./ExpeditionMap";
import type { Role } from "./EcologyTypes";
/** Combat groups are placed by hand around cover, food and route choices. Not random room filling. */
export const residentGroups: { district: DistrictId; role: Role; x: number; y: number; organ: OrganId }[] = [
  { district: "cargo", role: "hunter", x: 980, y: 2176, organ: "ram" },
  { district: "cargo", role: "scavenger", x: 1420, y: 2176, organ: "vitality" },
  { district: "cargo", role: "scavenger", x: 1790, y: 2176, organ: "armor" },
  { district: "lower", role: "scavenger", x: 2410, y: 2254, organ: "battery" },
  { district: "lower", role: "scavenger", x: 2510, y: 2254, organ: "leech" },
  { district: "lower", role: "hunter", x: 2830, y: 2254, organ: "ram" },
  { district: "bed", role: "hunter", x: 2350, y: 1799, organ: "mark" },
  { district: "bed", role: "hunter", x: 2930, y: 1799, organ: "conduit" },
  { district: "heatx", role: "scavenger", x: 3440, y: 2176, organ: "hot" },
  { district: "heatx", role: "floater", x: 3820, y: 1919, organ: "discharge" },
  { district: "heatx", role: "hunter", x: 4260, y: 2176, organ: "heavyArea" },
  { district: "control", role: "hunter", x: 3780, y: 1656, organ: "ram" },
  { district: "control", role: "scavenger", x: 3860, y: 1656, organ: "battery" },
  { district: "control", role: "hunter", x: 4300, y: 1656, organ: "heavyArea" },
  { district: "control", role: "floater", x: 4010, y: 1431, organ: "discharge" },
  { district: "control", role: "floater", x: 4520, y: 1470, organ: "mark" },
  { district: "deep", role: "hunter", x: 3730, y: 1136, organ: "freeze" },
  { district: "deep", role: "scavenger", x: 3930, y: 1136, organ: "shatter" },
  { district: "deep", role: "floater", x: 4130, y: 963, organ: "airPower" },
  { district: "spine", role: "hunter", x: 5710, y: 1370, organ: "rage" },
  { district: "spine", role: "scavenger", x: 6030, y: 1370, organ: "vulnerable" },
  { district: "spine", role: "floater", x: 6220, y: 1230, organ: "glass" },
];
