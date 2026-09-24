import { mapSVG } from "./RegionMapUI";
import type { Expedition } from "./Expedition";
import { moduleInfo } from "./EnemyModule";
import { rigInfo } from "./OrganRig";
import { discoveryInfo } from "./FieldDiscovery";
import { zones, zoneOrder } from "./ExpeditionMap";
import {
  upgrades,
  resourceNames,
  canUpgrade,
  type Cargo,
  type Resource,
  type Upgrade,
} from "./Progression";
export const formatTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const cargoHTML = (cargo: Cargo) =>
  Object.entries(resourceNames)
    .map(
      ([k, name]) =>
        `<span><i>${k === "material" ? "◇" : k === "core" ? "◉" : "▥"}</i><b>${cargo[k as Resource]}</b><small>${name}</small></span>`,
    )
    .join("");
export type OverlayMode = "" | "pause" | "map" | "rescue";
export class ExpeditionUI {
  hud = document.getElementById("hud")!;
  overlay = document.getElementById("overlay")!;
  signature = "";
  render(e: Expedition, mode: OverlayMode, muted: boolean) {
    const hub = e.state === "hub";
    this.hud.hidden = hub;
    if (!hub) this.field(e, muted);
    const signature = hub
      ? JSON.stringify([
          e.profile.bank,
          e.profile.upgrades,
          e.profile.sorties,
          e.lastRecord,
          e.store.available,
          e.profile.discoveries,
          e.profile.residents,
        ])
      : mode +
        (mode === "map"
          ? e.zoneId + e.activityStage + e.profile.shortcuts.join(",")
          : "");
    this.overlay.hidden = !hub && !mode;
    this.overlay.className = hub ? "exp-overlay hub-overlay" : "exp-overlay";
    if (signature === this.signature) return;
    this.signature = signature;
    if (hub) this.hub(e);
    else if (mode === "map")
      this.overlay.innerHTML = `<div class="exp-modal map-modal"><span class="eyebrow">FANG / DAWN 07 · 固定结构 / 本次局势</span><h1>房宿分野<span>曙光07人工黎明设施</span></h1><div class="facility-map">${mapSVG(e, true)}</div><div class="map-notes"><p><b>随时回头</b><br>所有地面通道始终开放。气闸是安全撤离点，不需要击败精英。</p><p><b>另一条路</b><br>S1 广场→主廊；S2 高架→涡轮；S3 光塔→货运。需从地表侧修复，永久保留。</p><p><b>值得冒险？</b><br>北线坠落坑在 70% 活化苏醒；西线生命信号可带回工坊。</p></div>${this.routeIdeas(e)}<button data-action="resume">收起地图 <span>Tab / Esc ↗</span></button></div>`;
    else if (mode === "pause" || mode === "rescue")
      this.overlay.innerHTML = `<div class="exp-modal"><span class="eyebrow">${mode === "rescue" ? "EMERGENCY RECOVERY" : "EXPEDITION PAUSED"}</span><h1>${mode === "rescue" ? "请求紧急回收" : "出行已暂停"}</h1><p>${mode === "rescue" ? "救援会清空临时模块，仅保留本次各项资源的 30%（向上取整）。此前积累与永久升级不会损失。" : "返回气闸可带回全部资源。地图、暂停期间活化度不会增长。"}</p><button data-action="resume">继续探索 <span>Esc ↗</span></button><button class="secondary" data-action="${mode === "rescue" ? "rescue-confirm" : "rescue"}">${mode === "rescue" ? "确认回收 · 保留 30%" : "紧急回收…"} <span>↗</span></button></div>`;
  }
  field(e: Expedition, muted: boolean) {
    const w = e.world,
      p = w.player,
      target = e.interaction(),
      rate =
        target && target.duration
          ? Math.min(1, e.interactionProgress / target.duration)
          : 0;
    this.hud.innerHTML = `<div class="topbar"><div class="brand"><b class="sigil">◉</b><b>EVER ECLIPSE</b><span>房宿分野</span><small>GREYBOX / 0.4</small></div><div class="topmeta">SORTIE ${String(e.profile.sorties).padStart(2, "0")} <span>${formatTime(e.seconds)}</span></div></div><div class="room-info"><span>${e.zone.code}</span><h2>${e.zone.name}</h2><div class="zone-detail">${e.zoneId === "airlock" ? "安全区 · 左侧 W 撤离" : `${e.zone.band} · 离家风险 ${e.zone.depth}`}</div></div><div class="activity-box ${e.activity >= 80 ? "hot" : ""}"><div>STARFALL ACTIVITY <b>${Math.floor(e.activity)}%</b></div><div class="activity-track"><i style="width:${e.activity}%"></i><span style="left:30%"></span><span style="left:60%"></span><span style="left:80%"></span></div><small>${e.activityStage}${e.activity >= 80 ? " · 高价值残留增加" : ""}</small></div><div class="status"><div class="health-label">房日兔 <span>${Math.ceil(p.hp)} / ${p.maxHp}</span></div><div class="health"><i style="width:${(p.hp / p.maxHp) * 100}%"></i></div><div class="phase-label">临时定相 <span>${w.stableQueue.length} / ${w.phaseCapacity}</span></div><div class="exp-slots">${Array.from({ length: w.phaseCapacity }, (_, i) => `<i class="${w.stableQueue[i] ? "filled" : ""}"></i>`).join("")}</div><small>${w.god ? "无敌 ON · 调试" : p.dashCooldown > 0 ? "冲刺恢复中" : "冲刺就绪"}${muted ? " · 静音" : ""}</small></div><div class="cargo-box"><small>本次背包 / 撤离后存入</small><div class="cargo-numbers">${cargoHTML(e.cargo)}</div></div><div class="field-minimap">${mapSVG(e)}<small>Tab 区域地图</small></div>${e.messageTime > 0 ? `<div class="exp-toast">${e.message}</div>` : ""}${w.messageTime > 0 ? `<div class="combat-toast">${w.message}</div>` : ""}${target ? `<div class="interact-prompt"><kbd>W</kbd> ${target.blocked ? "未满足" : target.duration ? "长按" : "按下"} ${target.blocked || target.label}${target.duration ? `<i style="width:${rate * 100}%"></i>` : ""}</div>` : ""}<div class="bottom"><div class="keys"><span><kbd>A D</kbd>移动</span><span><kbd>Space / S</kbd>跳跃 / 下落</span><span><kbd>Shift</kbd>冲刺</span><span><kbd>左键</kbd>射击</span><span><kbd>F</kbd>震脱</span><span><kbd>右键</kbd>定相</span><span><kbd>E</kbd>接入</span><span><kbd>G</kbd>部署</span><span><kbd>V</kbd>搬运</span><span><kbd>Q / 滚轮</kbd>旋转</span><span><kbd>W</kbd>搜索 / 通行</span></div><div class="bottom-meta"><span>${e.zoneId === "airlock" ? "气闸已隔离星骸 · 可安全撤离" : "背包不会自动存入据点 · 退回气闸保住本次收益"}</span><span>Tab 地图 · Esc 暂停 · R 紧急回收 · M 声音 · F1 调试</span></div></div>`;
    this.hud.innerHTML +=
      this.rigMarkup(e) +
      '<div class="route-compass">H 医疗针 ×' +
      e.medkits +
      " · " +
      e.portals
        .map(
          (p) =>
            p.label +
            " [" +
            Math.round(
              Math.hypot(p.x - e.world.player.x, p.y - e.world.player.y) / 10,
            ) +
            "m]",
        )
        .join(" / ") +
      "</div>";
  }
  rigMarkup(e: Expedition) {
    const nearest = e.rig.nearest(e.world);
    const slots = Array.from({ length: e.world.phaseCapacity }, (_, i) => {
      const m = e.rig.modules[i];
      return (
        '<div class="rig-slot ' +
        (i === e.rig.selected ? "selected" : "") +
        '"><kbd>' +
        (i + 1) +
        "</kbd><b>" +
        (m ? moduleInfo[m.kind].name : "空链路") +
        "</b><small>" +
        (m
          ? m.kind === "thruster"
            ? e.rig.boostReady
              ? "喷跳就绪"
              : "落地充能"
            : m.kind === "gun"
              ? (e.rig.gunOverheated ? "过热 · 散热中" : "热量 " + Math.round(e.rig.gunHeat) + "%")
              : m.kind === "shield"
                ? "随瞄准挡弹"
                : (e.rig.comboCooldown > 0 ? "聚爆 " + e.rig.comboCooldown.toFixed(1) + "s" : "聚拢 / 聚爆就绪")
          : "E 接入器官") +
        "</small></div>"
      );
    }).join("");
    return (
      '<div class="rig-bar">' +
      slots +
      '</div><div class="next-goal">' +
      e.nextGoal +
      "</div>" +
      (e.rig.combos.length
        ? '<div class="combo-readout">' +
          e.rig.combos
            .map((c) => "<b>⟡ " + c.name + "</b> " + c.hint)
            .join(" / ") +
          "</div>"
        : "") +
      (nearest
        ? '<div class="organ-prompt"><kbd>E</kbd> 接入 ' +
          moduleInfo[nearest.kind].name +
          "<small>" +
          rigInfo[nearest.kind].hint +
          "</small>" +
          '<span class="organ-durability '+(nearest.hp/nearest.maxHp<=.25?'critical':'')+'"><i style="width:'+Math.max(0,nearest.hp/nearest.maxHp*100)+'%"></i></span><small class="durability-value">耐久 '+Math.ceil(nearest.hp)+' / '+nearest.maxHp+'</small>' +
          "</div>"
        : "") +
      (e.discovery.escort
        ? '<div class="escort-status">◉ 工程师同行 · 撤离后点亮工坊</div>'
        : "")
    );
  }
  routeIdeas(e: Expedition) {
    const survivor = e.discovery.features.find(
      (f) => f.kind === "survivor" && !f.done,
    );
    return (
      '<div class="route-ideas"><p><b>推进冲城</b> 推进囊＋甲壳盾 → Shift 震脱敌盾。涡轮大厅可取得甲壳。</p><p><b>牵引聚爆</b> 牵引腕＋炮腕 → 命中先聚拢再爆裂。旧档案库可找到牵引。</p><p>' +
      (survivor
        ? "◉ 生命信号：" + zones[survivor.zoneId].name
        : "◉ 工程师：" + (e.discovery.escort ? "正在同行" : "已回到据点")) +
      " · 冻结温室层有根种；晨光塔上层有透镜。</p></div>"
    );
  }
  cityMarkup(e: Expedition) {
    const live = e.profile.residents.includes("engineer"),
      found = e.profile.discoveries;
    const color = live ? "#e4b96c" : "#344f48";
    return (
      '<div class="city-trace"><svg viewBox="0 0 320 100" aria-label="据点留下的探索痕迹"><path d="M5 92H310 M20 92V48H95V92 M110 92V23H212V92 M230 92V57H300V92" fill="#162b29" stroke="#466159"/><path d="M32 62H47V78H32Z M63 62H78V78H63Z M128 40H145V57H128Z M163 40H180V57H163Z M245 67H265V82H245Z" fill="' +
      color +
      '"/>' +
      (live
        ? '<circle cx="194" cy="75" r="5" fill="#ddcba0"/><path d="M194 80V91" stroke="#ddcba0" stroke-width="5"/>'
        : "") +
      (found.includes("roots")
        ? '<path d="M277 91V72M277 80Q252 62 270 68M277 78Q300 56 282 68" fill="none" stroke="#afd69a" stroke-width="3"/>'
        : "") +
      (found.includes("dawn-lens")
        ? '<circle cx="60" cy="23" r="11" fill="#e2c481" opacity=".8"/>'
        : "") +
      (found.includes("outward-scar")
        ? '<path d="M225 12L244 24L226 42L218 22Z" fill="#889ba6"/>'
        : "") +
      "</svg><span>" +
      (live ? "工坊已亮灯 · 工程师住在这里" : "废弃工坊 · 等待有人回来") +
      " / 探索痕迹 " +
      found.length +
      "/3</span></div>"
    );
  }
  hub(e: Expedition) {
    const record = e.lastRecord,
      up = e.profile.upgrades;
    this.overlay.innerHTML = `<div class="hub-shell"><header><div class="brand"><b class="sigil">◉</b><b>EVER ECLIPSE</b><span>永蚀 / 房宿分野</span></div><span class="hub-status">● 安全据点 / ${e.store.available ? "本机进度已保存" : "存储不可用 · 当前会话仍可游玩"}</span></header>${this.cityMarkup(e)}<div class="hub-heading"><div><span class="eyebrow">FANG TERRITORY / GREYBOX 04</span><h1>带回来。<em>再出发。</em></h1><p>这一趟，拼出什么。下一趟，为谁回来。</p></div><div class="bank"><small>据点储备 · 永久保留</small><div class="cargo-numbers">${cargoHTML(e.profile.bank)}</div></div></div><div class="hub-stations"><section class="station research"><div class="station-id">01 / RESEARCH</div><h2>研究台 <span>出行成果</span></h2>${
      record
        ? `<div class="report-result ${record.outcome === "extracted" ? "success" : ""}">${record.outcome === "extracted" ? "成功撤离 / 全部带回" : record.outcome === "interrupted" ? "出行中断 / 救援回收" : "救援返回 / 保留 30%"}</div><div class="report-resources">${Object.entries(
            resourceNames,
          )
            .map(
              ([k, name]) =>
                `<div><span>${name}</span><b>+${record.banked[k as Resource]}</b>${record.lost[k as Resource] ? `<small>损失 ${record.lost[k as Resource]}</small>` : ""}</div>`,
            )
            .join(
              "",
            )}</div><div class="report-meta"><span>探索 ${formatTime(record.seconds)}</span><span>最高离家风险 ${Math.max(...record.route.map((id) => zones[id as keyof typeof zones]?.depth ?? 0))} 级</span></div><p class="station-note">${record.escort ? (record.outcome === "extracted" ? "工程师已回到据点" : "工程师未带回，下趟仍可寻找") : ""}${record.findings?.length ? "<br>发现：" + record.findings.map((id) => discoveryInfo[id]?.name ?? id).join("、") : ""}${record.build?.length ? "<br>本趟：" + record.build.map((k) => rigInfo[k as keyof typeof rigInfo]?.name ?? k).join(" / ") : ""}<br>完整拆件 ${record.detached} · 定相 ${record.phased}<br>返回活化 ${Math.floor(record.activity)}% · 临时模块已清空</p>`
        : `<div class="empty-report"><span>—</span><p>还没有出行记录。<br>先去主廊搜到一箱材料，<br>再决定要不要继续。</p></div><p class="station-note">死亡不会清空全部收益。<br>救援保留每类资源约 30%。</p>`
    }</section><section class="station workshop"><div class="station-id">02 / WORKSHOP</div><h2>工具台 <span>仅三项永久升级</span></h2>${(
      Object.keys(upgrades) as Upgrade[]
    )
      .map((key) => {
        const item = upgrades[key],
          owned = up[key];
        return `<button class="upgrade-card ${owned ? "owned" : ""}" data-upgrade="${key}" ${!canUpgrade(e.profile, key) ? "disabled" : ""}><div><b>${item.name}</b><span>${owned ? "已安装 ✓" : canUpgrade(e.profile, key) ? "升级 ↗" : "材料不足"}</span></div><p>${item.description}</p><small>${Object.entries(
          item.cost,
        )
          .filter(([, v]) => v)
          .map(([k, v]) => `${v} ${resourceNames[k as Resource]}`)
          .join(" · ")}</small></button>`;
      })
      .join(
        "",
      )}</section><section class="station terminal"><div class="station-id">03 / DEPARTURE</div><h2>出发终端</h2><div class="destination"><span>房宿分野 / FANG</span><h3>曙光 07</h3><p>人工黎明设施</p><div class="terminal-map">${mapSVG(e)}</div><small>固定分支地图 · 每趟局势不同<br>西线救援 / 东线光塔 / 北线星骸</small></div><button class="depart-button" data-action="depart">${e.profile.sorties ? "再次出发" : "开始第一次出行"} <span>↗</span></button><div class="closed-sectors"><span>心宿分野 <i>未开放</i></span><span>危宿分野 <i>未开放</i></span><span>尾宿分野 <i>未开放</i></span></div></section></div><footer><span>E 一键接入 · Space 喷跳 · Shift 冲撞 · W 搜索与通行</span><span>临时模块离场清空 · 刷新未完成出行按 30% 救援结算</span></footer></div>`;
  }
}
