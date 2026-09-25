import type { Expedition } from "./Expedition";
import { districts, links } from "./ExpeditionMap";

/**
 * F3 developer overlay: the whole ecological state at once, including districts the player has
 * never visited. This is a debugging instrument, not a player tool — it is deliberately dense.
 */
export function ecologyOverlayHTML(ex: Expedition): string {
  const stats = ex.eco.districtStats();
  const snap = ex.eco.snapshot();
  const alive = ex.eco.alive;
  const byRole: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  for (const c of alive) {
    byRole[c.role] = (byRole[c.role] ?? 0) + 1;
    byStage[c.stage] = (byStage[c.stage] ?? 0) + 1;
  }
  const rows = stats
    .map((s) => {
      const d = districts.find((x) => x.id === s.id)!;
      const here = s.id === ex.district;
      return `<tr class="${here ? "eco-here" : ""}"><td>${s.name}</td><td>${s.alive}</td><td>${s.mature}</td><td>${
        s.apex
      }</td><td>${s.biomass}</td><td>${s.remains}</td><td>${s.layers}</td><td>${s.nests}</td></tr>`;
    })
    .join("");
  const nests = ex.eco.nests
    .map(
      (n) =>
        `<li>${n.name} · ${n.district} · ${n.state} · 生物量 ${n.biomass.toFixed(0)} · 已生 ${n.spawned}</li>`,
    )
    .join("");
  const top = [...alive]
    .sort((a, b) => b.organs.totalLayers - a.organs.totalLayers)
    .slice(0, 6)
    .map(
      (c) =>
        `<li>${c.name} · ${c.role} · ${c.stage}${c.isApex ? " · <b>APEX</b>" : ""} · 生物量 ${c.biomass.toFixed(
          0,
        )} · 器官 ${c.organs.totalLayers} 层 [${c.organs.ids().join(",")}] · hp ${c.hp.toFixed(0)}</li>`,
    )
    .join("");
  const m = ex.eco.metrics;
  return `<div class="eco-overlay"><div class="eco-card">
    <header><b>F3 生态调试</b><span>种子 ${ex.eco.seed} · 时间 ${ex.time.toFixed(0)}s · 威胁 ${ex.eco.threatLabel()} (${snap.threat.toFixed(
      2,
    )})</span></header>
    <div class="eco-grid">
      <div><h4>生态总量</h4><ul>
        <li>存活 ${snap.alive} · 成熟 ${snap.mature} · 顶点 ${snap.apex}</li>
        <li>幼体 ${byStage.juvenile ?? 0} / 成熟 ${byStage.mature ?? 0} / 顶点 ${byStage.apex ?? 0}</li>
        <li>角色 腐食 ${byRole.scavenger ?? 0} · 猎人 ${byRole.hunter ?? 0} · 漂浮 ${byRole.floater ?? 0}</li>
        <li>出生 ${m.creaturesSpawned} · 死亡 ${m.deaths}</li>
        <li>生物互相击杀 ${m.creatureVsCreatureKills} · 饥饿死 ${m.starvationDeaths}</li>
        <li>成熟产生 ${m.matureCreated} · 顶点产生 ${m.apexCreated} · 顶点被击杀 ${m.apexKilled}</li>
        <li>残骸产生 ${m.remainsCreated} · 叠层尸体 ${m.stackedBodies} · 最大器官层数 ${m.maxEnemyOrganLayers}</li>
        <li>吸收器官 ${m.absorbedOrgans} · 进食 ${m.creatureConsumes}</li>
      </ul></div>
      <div><h4>角色克制循环（捕食计数）</h4><ul>${Object.entries(ex.eco.roleKills)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `<li>${k} → ${v}</li>`)
        .join("")}</ul>
        <h4>器官相性胜场</h4><ul>${Object.entries(ex.eco.archetypeKills)
          .map(([k, v]) => `<li>${k} → ${v}</li>`)
          .join("")}</ul></div>
      <div><h4>巢穴</h4><ul>${nests}</ul></div>
      <div><h4>器官最多的个体</h4><ul>${top}</ul></div>
    </div>
    <h4>各区生态</h4>
    <table class="eco-table"><tr><th>区域</th><th>存活</th><th>成熟</th><th>顶点</th><th>生物量</th><th>残骸</th><th>层数</th><th>巢穴</th></tr>${rows}</table>
    <p class="eco-note">连线 ${links.length} 条 · 已开捷径 ${[...ex.open].join(", ") || "无"} · 玩家所在 ${ex.district}</p>
  </div></div>`;
}
