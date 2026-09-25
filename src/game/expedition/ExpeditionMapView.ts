import type { Expedition } from "./Expedition";
import { extractors, extractorPos, shortcutDefs } from "./ExpeditionContent";
import { districts, links } from "./ExpeditionMap";

/**
 * The 0.10 map is an instrument, not a picture: it answers "where can I go, what is left there, and
 * how do I get out". Ecology state is only shown where the player has actually been, so the map
 * cannot be used to scout the whole run for free.
 */
export function expeditionMapHTML(
  ex: Expedition,
  playerX: number,
  playerY: number,
  known: ReadonlySet<string>,
) {
  const { width, height } = ex.geometry.size;
  const linkPaths = links
    .map((l) => {
      const a = districts.find((d) => d.id === l.a)!,
        b = districts.find((d) => d.id === l.b)!;
      const ax = a.x + a.w / 2,
        ay = a.floor,
        bx = b.x + b.w / 2,
        by = b.floor;
      const opened = ex.open.has(l.lock ?? "");
      const dashed = l.kind === "drop" || l.kind === "shaft";
      return `<path d="M${ax} ${ay}L${bx} ${by}" stroke="${opened ? "#8ef0c0" : "#547465"}" stroke-width="14" ${
        dashed ? 'stroke-dasharray="26 20"' : ""
      } fill="none"/>`;
    })
    .join("");
  const districtRects = districts
    .map((d) => {
      const here = known.has(d.id);
      const current = ex.district === d.id;
      return `<rect x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" fill="${
        current ? "#2c4a3f" : here ? "#1e332e" : "#101b1c"
      }" stroke="${current ? "#8ef0c0" : "#4a6a5e"}" stroke-width="${current ? 8 : 4}"/><text x="${d.x + 26}" y="${
        d.y + 78
      }" fill="${here ? "#cfe8d8" : "#6b8378"}" font-size="58">${d.name}</text>`;
    })
    .join("");
  const pileMarks = ex.piles
    .filter((p) => !p.taken)
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="${p.y - 20}" r="${16 + p.difficulty * 2}" fill="${
          p.difficulty > 4 ? "#ff8f9b" : p.difficulty > 2.6 ? "#ffd27d" : "#9cd8cb"
        }" opacity="0.85"/>`,
    )
    .join("");
  const extractMarks = extractors
    .map((e) => {
      const p = extractorPos(e);
      const ok = !ex.extractBlocked(e);
      return `<rect x="${p.x - 30}" y="${p.y - 60}" width="60" height="60" fill="${ok ? "#8ef0c0" : "#6b7280"}"/><text x="${
        p.x - 34
      }" y="${p.y - 74}" fill="${ok ? "#8ef0c0" : "#9aa4b2"}" font-size="46">${e.name}</text>`;
    })
    .join("");
  const shortcutMarks = shortcutDefs
    .map((s) => {
      const p = extractorPos({ ...s, needsPower: false, cargo: false } as never);
      const done = ex.open.has(s.id);
      return `<path d="M${p.x - 26} ${p.y}L${p.x + 26} ${p.y}" stroke="${done ? "#8ef0c0" : "#ffd27d"}" stroke-width="16"/>`;
    })
    .join("");
  const nests = ex.eco.nests
    .filter((n) => known.has(n.district))
    .map((n) => {
      const d = districts.find((x) => x.id === n.district)!;
      const size = 22 + n.biomass * 1.4;
      return `<circle cx="${n.x}" cy="${d.floor - 60}" r="${size}" fill="none" stroke="${
        n.state === "collapsed" ? "#6b7280" : "#ff9f7d"
      }" stroke-width="10"/>`;
    })
    .join("");
  const stats = ex.eco.districtStats();
  const rows = districts
    .filter((d) => known.has(d.id))
    .map((d) => {
      const s = stats.find((x) => x.id === d.id);
      return `<tr><td>${d.name}</td><td>${s?.alive ?? 0}</td><td>${s?.mature ?? 0}</td><td>${s?.apex ?? 0}</td></tr>`;
    })
    .join("");
  return `<div class="slice-eyebrow">活生态地图 · 已知区域 · 当前暂停</div><h1>${ex.district} 区 · 威胁 ${ex.eco.threatLabel()}</h1>
  <div class="ascent-map-layout"><svg class="ascent-map" viewBox="0 0 ${width} ${height}" role="img" aria-label="活生态搜打撤地图：九个区域、两条撤离路线与生态分布">
    ${districtRects}${linkPaths}${nests}${pileMarks}${shortcutMarks}${extractMarks}
    <circle cx="${playerX}" cy="${playerY}" r="40" fill="#fff1cc" stroke="#111" stroke-width="12"/>
  </svg><div>
    <p>白点：你的位置<br>圆点：未搜完的搜索点（越大越难，越红越危险）<br>方框：撤离点（灰＝不可用）<br>横线：可打开的捷径<br>圆环：巢穴（越大越活跃）</p>
    <p><b>两条回程</b><br>安全气闸：永远可用，但带不走重型货物。<br>货运撤离站：要先恢复供电，是唯一能吊走重型货物的出口。</p>
    <p><b>负重</b> ${ex.cargo.value} 价值 · ${ex.cargo.weight} 重量 · ${ex.cargo.size}/${ex.cargo.capacity} 格${
      ex.heavy ? `<br><span class="warn">携带重型货物：移动变慢，且过不去窄道</span>` : ""
    }</p>
    <p><b>已知区域生态</b></p>
    <table class="eco-table"><tr><th>区域</th><th>存活</th><th>成熟</th><th>顶点</th></tr>${rows}</table>
    <p>已搜 ${ex.metrics.searchesCompleted} / ${ex.piles.length} 处 · 威胁峰值 ${ex.metrics.peakThreat.toFixed(1)}</p>
  </div></div>`;
}
