import { builds, organs, organIds, weapons, secondaries } from "./config";
import type { OrganId } from "./config";
import type { SliceWorld } from "./SliceWorld";

export const number = (v: number) =>
  v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
export function stackEffect(id: OrganId, n: number, exploration = false) {
  const raw = n;
  const diminished: OrganId[] = [
    "speed",
    "glass",
    "fullRange",
    "airPower",
    "hot",
    "shieldBurst",
    "rage",
    "leech",
    "conduit",
    "heavyArea",
    "shatter",
    "vulnerable",
    "multi",
    "discharge",
  ];
  if (exploration && diminished.includes(id) && n > 2) n = Math.round((2 + Math.log2(n - 1)) * 100) / 100;
  const effects: Partial<Record<OrganId, string>> = {
    vitality: `生命 +${20 * n}`,
    armor: `护甲 ${12 * raw} / 减伤 ${(100 * (1 - 1 / (1 + 0.12 * n))).toFixed(1)}%`,
    speed: `攻速 +${25 * n}%`,
    glass: `生命上限 ×${(0.7 ** raw).toFixed(2)} / 攻速 +${40 * n}%`,
    ram: `冲撞伤害 ${12 * raw}`,
    battery: `每次 +${n} 充能 / 上限 ${3 + Math.max(0, n - 1) * 2}`,
    discharge: `重击额外 ${32 * n} / 放电 ${35 * n}`,
    mark: `${Math.max(1, Math.ceil(3 / (1 + 0.35 * (n - 1))))} 击挂印 / ${8 + 2 * (n - 1)} 秒`,
    conduit: `传导 ${exploration ? Math.min(85, 60 + 8 * (n - 1)) : 60 + 30 * (n - 1)}%`,
    spread: `传播半径 ${280 + 60 * (n - 1)}`,
    knock: `击退 +${65 * n}%`,
    leech: `生命 +${10 * raw} / 击杀恢复 ${5 * n}`,
    freeze: `每击冻结积累 ${n} / 阈值 5`,
    hot: `高热伤害 +${35 * n}%`,
    coolShield: `散热获得 ${25 * n} 护盾`,
    shieldBurst: `伤害 +${50 * n}% / 护盾每秒 −${12 * raw}`,
    overflow: `溢出治疗转盾 ${100 * n}%`,
    airJump: `最多储存 ${n} 次凌空跳`,
    airPower: `凌空伤害 +${30 * n}% / 范围 +${20 * n}%`,
    perfect: `完美闪避 +${n} 充能`,
    stunRegen: `眩晕恢复 ${12 * raw} 体力`,
    fullRange: `满体力范围 +${30 * n}%`,
    rage: `每失去 1% 生命，伤害 +${(0.8 * n).toFixed(1)}%`,
    vent: `消耗印记散热 ${25 * n}`,
    stunKnock: `对眩晕目标击退 +${100 * n}%`,
    vulnerable: `易伤 +${20 * n}%`,
    shatter: `碎冰伤害 ${45 * n} / 半径 ${170 + 30 * (n - 1)}`,
    multi: `每多一个目标伤害 +${15 * n}%`,
    heavyArea: `范围伤害 ${35 + 15 * (n - 1)}% / 半径 ${105 + 35 * n}`,
    slam: `高度增幅 ×${n}`,
  };
  return effects[id] ?? `效果 ×${n}`;
}
export function trainingPanel(w: SliceWorld, amount: number) {
  const select = (id: string, values: Record<string, { name: string }>, current: string) =>
    `<select id="${id}">${Object.entries(values)
      .map(([v, data]) => `<option value="${v}" ${current === v ? "selected" : ""}>${data.name}</option>`)
      .join("")}</select>`;
  return `<div class="bench-top"><div><div class="slice-eyebrow">${w.training ? "ENDLESS TRAINING" : "FIELD ARMORY"} / 当前暂停</div><h1>训练与配装台</h1></div><button class="slice-primary" data-action="resume">继续战斗 <span>B / Esc</span></button></div>
  <p>九件武器快捷键 1–9。${w.unlimited ? "无限收集：所有模块靠近自动接入，不限种类，下面可查看全部效果。" : "同类靠近自动叠层；六槽限制的是不同种类。"}</p>
  <div class="bench-settings"><label>主武器${select("bench-primary", weapons, w.armory.primary)}</label><label>副武器${select("bench-secondary", secondaries, w.armory.secondary)}</label>
  ${w.training ? `<label>敌人主武器${select("bench-enemy-weapon", { auto: { name: "按种类配置" }, ...weapons }, w.trainingWeapon)}</label><label>敌人副武器${select("bench-enemy-secondary", { none: { name: "无副武器" }, ...secondaries }, w.trainingSecondary)}</label><label>刷怪种类${select("bench-kind", { mixed: { name: "混合生态" }, crawler: { name: "近战爬行者" }, reclaimer: { name: "冲锋回收者" }, floater: { name: "浮游射手" }, elite: { name: "母体 Boss" } }, w.trainingKind)}</label><label>起始生命倍率<input id="bench-health" type="number" min="1" max="1000" value="${w.trainingHealth}"></label><label>每波数量<input id="bench-count" type="number" min="1" max="24" value="${w.trainingCount}"></label><label>设定波次<input id="bench-wave" type="number" min="1" max="100" value="${Math.max(1, w.wave)}"></label><label>指定掉落${select("bench-organ", { cycle: { name: `${organIds.length} 种轮换` }, ...organs }, w.trainingOrgan)}</label><label class="bench-check"><input id="bench-auto" type="checkbox" ${w.trainingAuto ? "checked" : ""}>持续增压刷怪</label>` : ""}</div>
  <p class="slice-muted">${weapons[w.armory.primary].hint} · ${secondaries[w.armory.secondary].hint}<br>当前层数会实际改变数值；非线性效果和触发阈值见每张卡片。训练的资源与构筑不写入探索档案。</p>
  <div class="slice-actions"><button class="slice-secondary" data-action="apply-bench">应用配置</button>${w.training ? '<button class="slice-secondary" data-action="spawn-bench">立即召唤所选怪物</button><button class="slice-secondary" data-action="next-wave">开始下一波</button><button class="slice-secondary" data-action="resupply">恢复生命 / 弹药储备</button><button class="slice-secondary" data-action="clear-enemies">清除当前敌人</button>' : ""}</div>
  ${
    w.training
      ? `<div class="bench-stack-input"><label>本次接入层数 <input id="grant-stacks" type="number" min="1" max="100" value="${amount}"></label><span>预设组合也使用这个层数</span></div>
  <div class="bench-presets">${Object.entries(builds)
    .map(
      ([id, b]) =>
        `<button class="slice-secondary" data-action="preset" data-slot="${id}">${b.name}</button>`,
    )
    .join("")}<button class="slice-secondary" data-action="clear-build">清空构筑</button></div>
  <div class="bench-equipped">${w.slots.map((id, i) => `<button data-action="remove-organ" data-slot="${i}" style="--organ:${organs[id].color}">${organs[id].name} ×${w.count(id)}<small>移除这组</small></button>`).join("") || "当前六槽为空"}</div>
  <div class="bench-catalog">${organIds.map((id) => `<article style="--organ:${organs[id].color}"><div><b>${organs[id].name}</b><small>${w.count(id) ? `已装 ×${w.count(id)}` : organs[id].tag}</small></div><p>${organs[id].description}</p><strong>${stackEffect(id, w.count(id) || 1)}</strong><button data-action="grant" data-slot="${id}">${w.has(id) ? "追加叠层" : "接入模块"} ＋${amount}</button></article>`).join("")}</div>`
      : `<p>探索器官来自敌人和宝箱。已装 ${w.slots.length} 种 / ${w.totalLayers} 层。</p><div class="bench-catalog">${w.slots.map((id) => `<article style="--organ:${organs[id].color}"><b>${organs[id].name} ×${w.count(id)}</b><p>${organs[id].description}</p><strong>${stackEffect(id, w.count(id), !!w.expedition)}</strong></article>`).join("")}</div>`
  }`;
}
