import { zones, zoneOrder, shortcuts } from "./ExpeditionMap";
import type { Expedition } from "./Expedition";
export function mapSVG(e: Expedition, large = false) {
  const seen = new Set<string>();
  let paths = "";
  for (const z of Object.values(zones))
    for (const p of z.portals) {
      const b = zones[p.to],
        key = [z.id, b.id].sort().join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      paths +=
        '<path d="M ' +
        z.mapX * 10 +
        " " +
        z.mapY * 8 +
        " L " +
        b.mapX * 10 +
        " " +
        b.mapY * 8 +
        '" class="' +
        (p.ability ? "module-route" : "") +
        '"/>';
    }
  for (const s of shortcuts) {
    const a = zones[s.from],
      b = zones[s.to];
    paths +=
      '<path class="' +
      (e.profile.shortcuts.includes(s.id) ? "lift-route" : "locked-route") +
      '" d="M ' +
      a.mapX * 10 +
      " " +
      a.mapY * 8 +
      " Q 980 " +
      b.mapY * 8 +
      " " +
      b.mapX * 10 +
      " " +
      b.mapY * 8 +
      '"/>';
  }
  return (
    '<svg viewBox="0 0 1000 840" aria-label="房宿20区地图：向上进入地表" role="img"><text x="30" y="45">北：星骸 / 地表</text><text x="30" y="430">西：活人</text><text x="790" y="590">东：光塔</text><text x="30" y="790">↓ 地下城市</text>' +
    paths +
    zoneOrder
      .map((id, i) => {
        const z = zones[id];
        return (
          '<g class="' +
          (e.zoneId === id
            ? "current"
            : e.areas.get(id)?.visited
              ? "visited"
              : "") +
          '"><title>' +
          z.name +
          '</title><circle cx="' +
          z.mapX * 10 +
          '" cy="' +
          z.mapY * 8 +
          '" r="13"/><text x="' +
          z.mapX * 10 +
          '" y="' +
          (z.mapY * 8 + 29) +
          '">' +
          String(i).padStart(2, "0") +
          (large ? " " + z.name : "") +
          "</text></g>"
        );
      })
      .join("") +
    "</svg>"
  );
}
