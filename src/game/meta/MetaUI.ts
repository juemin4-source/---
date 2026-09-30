import { hasWorker } from "./CampaignProgress";
import { constructions, courses, weaponRecipes, professions } from "./CampaignContent";
import { campaignHTML } from "./CampaignUI";
import { lootDefs } from "../expedition/LootSystem";
import { weapons, secondaries } from "../config";
import {
  benefits,
  drills,
  facilities,
  missing,
  projects,
  type MetaAccount,
  type Drill,
  type Modification,
  type Facility,
} from "./MetaProgression";
export const hubTabs = {
  residents: "居民与学习",
  commerce: "商店与提炼",
  overview: "出发准备",
  warehouse: "战利品仓库",
  training: "角色训练",
  research: "武器研究",
  facilities: "据点设施",
};
export type HubTab = keyof typeof hubTabs;
const button = (action: string, id: string, label: string, disabled = false) =>
  `<button class="slice-secondary" data-action="meta-${action}" data-slot="${id}" ${disabled ? "disabled" : ""}>${label}</button>`;
const costLabel = (coins: number, needs: Readonly<Record<string, number>>) =>
  `${coins} 金币${Object.entries(needs)
    .map(([id, n]) => ` · ${lootDefs[id].name} ×${n}`)
    .join("")}`;
const card = (title: string, text: string, footer: string) =>
  `<article class="meta-card"><h3>${title}</h3><p>${text}</p>${footer}</article>`;
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function hubHTML(a: MetaAccount, tab: HubTab, notice: string, spatial = false) {
  const m = a.meta,
    b = benefits(m);
  let body = "";
  if (tab === "overview")
    body = `<p>带回物资，选择出售或投入研究。永久成长在下一趟生效；器官仍需在局内重新收集。</p><div class="meta-stats"><span>初始生命 <b>${100 + b.health}</b></span><span>散热 <b>×${b.cooling.toFixed(2)}</b></span><span>体力恢复 <b>×${b.recovery.toFixed(2)}</b></span><span>货物容量 <b>${b.capacity}</b></span><span>医疗包 <b>${2 + b.medkits}</b></span><span>初始充能 <b>${b.energy}</b></span></div><h2>出发主武器</h2><div class="meta-options">${Object.entries(
      weapons,
    )
      .map(([id, w]) =>
        button(
          "primary",
          id,
          `${m.primary === id ? "✓ " : ""}${w.name}`,
          m.primary === id || !m.campaign.ownedWeapons.includes(id),
        ),
      )
      .join("")}</div><h2>出发副武器</h2><div class="meta-options">${Object.entries(secondaries)
      .map(([id, w]) =>
        button(
          "secondary",
          id,
          `${m.secondary === id ? "✓ " : ""}${w.name}`,
          m.secondary === id || !m.campaign.ownedWeapons.includes(id),
        ),
      )
      .join(
        "",
      )}</div><h2>武器改造 · 同时安装一种</h2><p>${m.installed ? `${projects[m.installed].name}：${projects[m.installed].description}` : "标准结构 · 在武器研究中解锁改造"}</p><div class="meta-options">${button("install", "none", "标准结构", !m.installed)}${m.unlocked.map((id) => button("install", id, projects[id].name, m.installed === id)).join("")}</div><p class="slice-muted">探索需要制造高级武器；训练场保留全部武器，不产出局外资源。</p>`;
  if (tab === "warehouse")
    body = `<p>货物成功带回后入库，不自动折现。每次出售一件；研究和设施会消耗对应物品。</p><div class="meta-grid">${
      Object.entries(m.warehouse)
        .filter(([, n]) => n > 0)
        .map(([id, n]) => {
          const uses: string[] = [
            ...Object.values(projects),
            ...Object.values(facilities),
            ...Object.values(constructions),
          ]
            .filter((p) => Object.hasOwn(p.needs, id))
            .map((p) => p.name);
          if (Object.values(courses).some((c) => c.book === id)) uses.push("居民学习");
          if (Object.values(weaponRecipes).some((r) => Object.hasOwn(r.needs, id))) uses.push("武器制造");
          if (id === "batteryCell" || id === "fuelCell") uses.push("材料提炼");
          if (id === "lithium") uses.push("武器强化");
          if (id === "trainingTicket") uses.push("特训养成点");
          if (id.startsWith("sample-")) uses.push("器官结构研究");
          return card(
            `${lootDefs[id].name} ×${n}`,
            `${uses.length ? `可用于：${uses.join("、")}` : "可出售换取训练与建设资金"}。出售后这件物品将离开仓库。`,
            button("sell", id, `出售 1 件 · +${lootDefs[id].value} 金币`),
          );
        })
        .join("") ||
      `<p class="meta-empty">仓库为空。先搜索气闸储物柜，再回撤离点按住 E 带回。只带回一次样本也会保留在这里。</p>`
    }</div>`;
  if (tab === "training")
    body = `<p>使用金币即时训练，每项最多 3 级。死亡保留已完成训练；不会赠送局内器官。</p><div class="meta-grid">${(
      Object.keys(drills) as Drill[]
    )
      .map((id) => {
        const d = drills[id],
          level = m.training[id],
          cost = d.cost * (level + 1);
        return card(
          `${d.name} · ${level}/3`,
          d.description,
          `<small>${level === 3 ? "已完成" : `${cost} 金币 · ${missing(a, cost, {}) || "可以训练"}`}</small>${button("train", id, level === 3 ? "已达上限" : "训练一级", level === 3 || a.bank < cost)}`,
        );
      })
      .join("")}</div>`;
  if (tab === "research")
    body = `<p>消耗材料研究，永久解锁。安装与切换免费，一次只选一种；修改主武器，不增加无人机或炮台伤害。</p><div class="meta-grid">${(
      Object.keys(projects) as Modification[]
    )
      .map((id) => {
        const p = projects[id],
          unlocked = m.unlocked.includes(id),
          reason =
            p.workshop && !m.facilities.includes("workshop")
              ? "需要工坊技术升级"
              : missing(a, p.cost, p.needs);
        return card(
          p.name,
          p.description,
          unlocked
            ? button("install", id, m.installed === id ? "已安装" : "安装改造", m.installed === id)
            : `<small>${costLabel(p.cost, p.needs)}<br>${reason || "材料齐备"}</small>${button("research", id, "研究解锁", !!reason)}`,
        );
      })
      .join("")}</div>`;
  if (tab === "facilities")
    body = `<p>用带回的技术资料和大型设备建设。每项建成一次，永久保留。</p><div class="meta-grid">${(
      Object.keys(facilities) as Facility[]
    )
      .map((id) => {
        const f = facilities[id],
          built = m.facilities.includes(id),
          reason = !hasWorker(a, f.worker) ? `需要${professions[f.worker]}` : missing(a, f.cost, f.needs);
        return card(
          f.name,
          f.description,
          `<small>${built ? "已建成 · 后续出行生效" : `${costLabel(f.cost, f.needs)}<br>${reason || "材料齐备"}`}</small>${button("facility", id, built ? "已建成" : "投入建设", built || !!reason)}`,
        );
      })
      .join(
        "",
      )}</div><p class="slice-muted">人员救回后可建造更多设施；前往居住区安排学习，训练区选择互斥技能分支。</p>`;
  body += campaignHTML(a, tab);
  return `<div class="slice-eyebrow">EVER ECLIPSE / BASE CAMP</div><div class="meta-heading"><h1>${spatial ? hubTabs[tab] : "沉井据点"}</h1><b>${Math.floor(a.bank)} 金币</b></div>${spatial ? "" : `<nav class="meta-tabs" aria-label="据点功能">${(Object.keys(hubTabs) as HubTab[]).map((id) => `<button class="slice-secondary ${tab === id ? "selected" : ""}" data-action="base-tab" data-slot="${id}" aria-pressed="${tab === id}">${hubTabs[id]}</button>`).join("")}</nav>`}<p class="meta-notice" role="status">${escape(notice || "选择一项成长目标，再出发寻找需要的物资。")}</p>${body}<div class="meta-footer">${!spatial || tab === "overview" ? `<button class="slice-primary" data-action="start-unlimited">携带当前配置出发 · 无限接入 ↗</button><button class="slice-secondary" data-action="start-six">六槽对照探索</button>` : ""}<button class="slice-secondary" data-action="base-close">${spatial ? "返回据点地图 · Esc" : "返回"}</button></div>`;
}
