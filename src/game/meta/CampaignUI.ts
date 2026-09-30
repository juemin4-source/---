import { structureInterface } from "./StructureInterface";
import type { MetaAccount } from "./MetaProgression";
import {
  people,
  professions,
  courses,
  constructions,
  weaponRecipes,
  heroes,
  partners,
  branches,
} from "./CampaignContent";
import { lootDefs } from "../expedition/LootSystem";
import { organs, weapons, secondaries, type OrganId } from "../config";
import type { HubTab } from "./MetaUI";
const button = (action: string, id: string, title: string, disabled = false) =>
  `<button class="slice-secondary" data-action="meta-${action}" data-slot="${id}" ${disabled ? "disabled" : ""}>${title}</button>`;
const card = (title: string, description: string, actions: string) =>
  `<article class="meta-card"><h3>${title}</h3><p>${description}</p>${actions}</article>`;
const price = (cost: number, needs: Readonly<Record<string, number>>) =>
  `${cost} 金币 · ${Object.entries(needs)
    .map(([id, n]) => `${lootDefs[id]?.name ?? id} ×${n}`)
    .join(" / ")}`;
export function campaignHTML(a: MetaAccount, tab: HubTab) {
  const p = a.meta.campaign;
  if (tab === "overview")
    return `<h2>角色与支援</h2><div class="meta-grid">${Object.entries(heroes)
      .map(([id, h]) =>
        card(
          h.name,
          `G · ${h.skill}：${h.description}`,
          button("hero", id, p.hero === id ? "已选择" : "选择", p.hero === id),
        ),
      )
      .join("")}</div><p>T 发动支援，支援联络在首次救援后开放。</p><div class="meta-options">${Object.entries(
      partners,
    )
      .map(([id, h]) =>
        button("partner", id, h.name, p.partner === id || (id !== "none" && !p.residents.length)),
      )
      .join("")}</div><p>${partners[p.partner].description}</p>`;
  if (tab === "training")
    return `<h2>${heroes[p.hero].name} · 技能养成</h2><p>养成点 ${p.points} · 有效技能使用 ${p.skillUses[p.hero]} 次 · 技能进阶 ${p.skillLevel[p.hero]}/2。每完成 3 次有效操作可进阶一级。分支互斥，可免费重置。</p>${button("special-training", "point", "特训：30 金币 + 特训券 → 1 点")}${button("skill-upgrade", "level", "行为达标后升级技能", p.skillLevel[p.hero] >= 2 || p.skillUses[p.hero] < (p.skillLevel[p.hero] + 1) * 3)}<div class="meta-grid">${Object.entries(
      branches,
    )
      .map(([id, b]) =>
        card(
          b.name,
          b.description,
          button(
            "branch",
            id,
            p.trees[p.hero] === id ? "已选择" : "投入 1 点",
            !!p.trees[p.hero] || p.points < 1,
          ),
        ),
      )
      .join("")}</div>${button("reset-branch", "reset", "重置分支并返还点数", !p.trees[p.hero])}`;
  if (tab === "research")
    return `<h2>武器制造与强化</h2><p>需要机械师。制造后永久可用，训练场仍可测试全部武器。强化上限三级，武器威力每级 +5%，盾牌每级额外减少格挡后的伤害 5%；第三级需要大型机床建成精密加工工坊。</p><div class="meta-grid">${Object.entries(
      { ...weapons, ...secondaries },
    )
      .map(([id, w]) => {
        const owned = p.ownedWeapons.includes(id),
          r = weaponRecipes[id as keyof typeof weaponRecipes],
          level = p.reinforcement[id] ?? 0;
        return card(
          w.name,
          owned
            ? `已拥有 · 强化 ${level}/3 · 下级 ${25 * (level + 1)} 金币 + 锂 ×${level + 1}`
            : price(r.cost, r.needs),
          owned ? button("reinforce", id, "强化", level >= 3) : button("manufacture", id, "制造"),
        );
      })
      .join(
        "",
      )}</div><h2>器官结构研究</h2><p>需要器官研究站和完整样本，每项 35 金币。研究不会给予局内器官层数。一个结构接口可与一种机匣改造搭配。</p><div class="meta-grid">${
      Object.entries(lootDefs)
        .filter(([id, d]) => d.organ && ((a.meta.warehouse[id] ?? 0) > 0 || p.samples.includes(d.organ)))
        .map(([id, d]) =>
          card(
            d.name,
            p.samples.includes(d.organ!)
              ? `已解析 · ${structureInterface(d.organ!).description}`
              : "成功带回的完整样本，可消耗研究",
            p.samples.includes(d.organ!)
              ? button(
                  "interface",
                  d.organ!,
                  p.interface === d.organ ? "已安装接口" : "安装接口",
                  p.interface === d.organ,
                )
              : button("organ-research", d.organ!, "消耗样本研究"),
          ),
        )
        .join("") || "尚无样本：探索按 P 切换封装，再靠近器官按 E。"
    }</div>${button("interface", "none", "卸下结构接口", !p.interface)}`;
  if (tab === "facilities")
    return `<h2>人员设施与永久工程</h2><div class="meta-grid">${Object.entries(constructions)
      .map(([id, c]) =>
        card(
          c.name,
          `${c.description}<br>${price(c.cost, c.needs)}<br>人员：${professions[c.worker]}`,
          button("construct", id, p.built.includes(id) ? "已建成" : "投入建设", p.built.includes(id)),
        ),
      )
      .join("")}</div>`;
  if (tab === "residents")
    return `<h2>居民与知识</h2><p>安置 ${p.residents.length}/${p.built.includes("housing") ? 8 : 3}。课程需要知识学习室与书籍；开始后完成一趟至少一分钟的出行即可学成，死亡也推进学习。</p><div class="meta-grid">${
      p.residents
        .map((r) =>
          card(
            `${people[r.id].name} · ${professions[r.profession]}`,
            `${people[r.id].age} · ${r.studying ? `正在学习 ${courses[r.studying].name}` : "可以工作 / 学习"}<br>已学：${r.knowledge.map((k) => courses[k as keyof typeof courses]?.name).join("、") || "无"}`,
            Object.entries(courses)
              .map(([id, c]) =>
                button(
                  "learn",
                  `${r.id}:${id}`,
                  `${c.name} · ${lootDefs[c.book].name}`,
                  !!r.studying || r.knowledge.includes(id),
                ),
              )
              .join(""),
          ),
        )
        .join("") || "尚无居民。维修工区的林叔等待救援；靠近按 E，带他一起到撤离点。"
    }</div>`;
  if (tab === "commerce")
    return `<h2>补给商店</h2><p>物品进入仓库；医疗包在下次出发携带，最多额外两个。基础供应开放，后续可扩展商人库存。</p><div class="meta-options">${button("buy", "medkit", "医疗包 · 15 金币")}${button("buy", "trainingTicket", "特训券 · 25 金币")}${button("buy", "batteryCell", "锂电池 · 20 金币")}${button("buy", "maintenanceBook", "维修手册 · 35 金币")}${button("buy", "medicalBook", "急救基础 · 45 金币")}${button("buy", "pythonBook", "Python 入门 · 55 金币")}</div><h2>材料提炼</h2><p>需要机械师建成提炼台；实际消耗仓库物品。</p>${button("refine", "batteryCell", "电池 ×1 → 锂 ×2")}${button("refine", "fuelCell", "聚变燃料 ×1 → 超重氢 ×1")}`;
  return "";
}
