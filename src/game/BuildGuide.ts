import { organs, weapons, secondaries, type OrganId, type WeaponId, type SecondaryId } from "./config";
import { habitats, sites, districts } from "./AscentMap";
import type { SliceWorld } from "./SliceWorld";

export const fieldBuilds: Record<
  string,
  { name: string; ids: OrganId[]; primary: WeaponId; secondary: SecondaryId; play: string; tradeoff: string }
> = {
  impact: {
    name: "撞墙放电",
    ids: ["ram", "battery", "discharge", "knock", "speed", "heavyArea"],
    primary: "hammer",
    secondary: "grenade",
    play: "冲刺或手雷把敌人推向实体墙，获得充能，用第三锤释放放电。先去西泵房，再上断电锻台。",
    tradeoff: "开阔处收益下降；需要主动选墙和控制站位。",
  },
  chain: {
    name: "印记扩散",
    ids: ["mark", "conduit", "spread", "speed", "leech", "multi"],
    primary: "handgun",
    secondary: "drone",
    play: "先分配命中挂印，再集中击杀一只，沿密集敌群传导与传播。东根室进入孢囊温床。",
    tradeoff: "单独首领没有传播收益；无人机会消耗储备。",
  },
  frost: {
    name: "冻结碎冰",
    ids: ["freeze", "shatter", "vulnerable", "speed", "heavyArea", "battery"],
    primary: "hammer",
    secondary: "turret",
    play: "连续命中冻结，再用重击碎冰；冷凝栈道补齐核心模块，货运站测试群体控制。",
    tradeoff: "需要多次命中与近身窗口；不能只靠一发重击启动。",
  },
  shield: {
    name: "回生燃盾",
    ids: ["leech", "overflow", "shieldBurst", "coolShield", "hot", "speed"],
    primary: "rifle",
    secondary: "shield",
    play: "击杀回血，溢出转盾；高热射击后散热补盾。温床与破顶温室补齐，热盾交替输出。",
    tradeoff: "燃盾会快速消耗护盾；要在输出和散热之间切换。",
  },
};
export function buildSources(w: SliceWorld, id: OrganId) {
  const result: { x: number; y: number; label: string }[] = [];
  for (const h of habitats)
    if (h.organ === id && w.enemies.some((e) => w.ascent?.homes.get(e.id)?.id === h.id && !e.dead))
      result.push({
        x: h.x,
        y: h.floor - 24,
        label:
          districts.find(
            (d) => h.x > d.x && h.x < d.x + d.w && h.floor - 24 > d.y && h.floor - 24 < d.y + d.h,
          )?.name ?? "上行检修井",
      });
  if (w.unlimited)
    for (const e of w.enemies) {
      const h = w.ascent?.homes.get(e.id);
      if (!e.dead && e.organ === id && h?.id.startsWith("incursion-"))
        result.push({ x: e.x, y: e.y, label: "异变增援" });
    }
  for (const s of sites)
    if (s.organ === id && !w.ascent?.opened.has(s.id)) result.push({ x: s.x, y: s.y, label: s.name });
  for (const d of w.drops) if (d.organ === id) result.push({ x: d.x, y: d.y, label: "地面掉落" });
  return result.sort(
    (a, b) => Math.hypot(a.x - w.player.x, a.y - w.player.y) - Math.hypot(b.x - w.player.x, b.y - w.player.y),
  );
}
export function recommendBuilds(w: SliceWorld) {
  return Object.entries(fieldBuilds)
    .map(([id, b]) => ({ id, ...b, owned: b.ids.filter((o) => w.has(o)).length }))
    .sort((a, b) => b.owned - a.owned);
}
export function nextBuildTarget(w: SliceWorld, id: string) {
  const b = fieldBuilds[id];
  if (!b) return null;
  return (
    b.ids
      .filter((o) => !w.has(o))
      .flatMap((o) => buildSources(w, o).map((s) => ({ ...s, organ: o })))
      .sort(
        (a, b) =>
          Math.hypot(a.x - w.player.x, a.y - w.player.y) - Math.hypot(b.x - w.player.x, b.y - w.player.y),
      )[0] ?? null
  );
}
export function guideHTML(w: SliceWorld) {
  return `<div class="slice-eyebrow">推荐 BUILD / 按当前已装模块排序 · 当前暂停</div><h1>下一件，为谁而找？</h1><p>每套推荐核心为六种模块；无限版可继续搭配其他模块。探索中选择推荐只追踪路线，不发放器官；按 1–9 或 B 自行切换武器。R 可随时打开。</p><div class="build-guide">${recommendBuilds(
    w,
  )
    .map(
      (b) =>
        `<article><div class="slice-eyebrow">已装 ${b.owned} / 6 ${w.ascent?.trackedBuild === b.id ? " · 正在追踪" : ""}</div><h2>${b.name}</h2><p>${weapons[b.primary].key} ${weapons[b.primary].name} ＋ ${secondaries[b.secondary].key} ${secondaries[b.secondary].name}</p><p>${b.play}</p><p class="slice-muted">取舍：${b.tradeoff}</p><ul>${b.ids.map((id) => `<li style="color:${w.has(id) ? organs[id].color : "#adc0b2"}">${w.has(id) ? "✓" : "○"} ${organs[id].name} ${w.has(id) ? `×${w.count(id)}` : `— ${buildSources(w, id)[0]?.label ?? (w.unlimited ? "等待后续增援掉落" : "本趟来源已耗尽")}`}</li>`).join("")}</ul><button class="slice-secondary" data-action="track-build" data-slot="${b.id}">${w.ascent?.trackedBuild === b.id ? "已追踪 · 返回探索" : "追踪缺少的模块"}</button></article>`,
    )
    .join("")}</div><button class="slice-primary" data-action="resume">返回探索 · R / Esc</button>`;
}
