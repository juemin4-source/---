import { drawLandmarks } from "./RegionLandmarks";
import type { Renderer } from "./Renderer";
import type { Expedition } from "./Expedition";
import { moduleInfo } from "./EnemyModule";
export function renderExpedition(art: Renderer, e: Expedition) {
  if (e.state !== "field") return;
  const g = art.g,
    w = e.world,
    t = e.seconds;
  art.labels.get("sector")?.setText("DAWN 07 / EXPLORATION");
  art.labels.get("roommark")?.setText(e.zone.code.slice(0, 2));
  for (const enemy of w.enemies)
    if (!enemy.dead && e.rareIds.has(enemy.id)) {
      g.lineStyle(1, 0xe6c592, 0.65);
      g.strokeCircle(enemy.x, enemy.y, enemy.w / 2 + 15);
      art.label(
        `rare-${enemy.id}`,
        enemy.x - 45,
        enemy.y - enemy.h / 2 - 48,
        "稀有星骸 / 核心反应",
        "#e6c592",
        11,
      );
    }
  if (e.activity >= 60) {
    const alpha = (e.activity - 55) / 900;
    g.fillStyle(0x9b344a, alpha);
    g.fillRect(0, 0, w.width, w.height);
    g.lineStyle(1, 0xea796c, e.activity >= 100 ? 0.35 : 0.15);
    for (let i = 0; i < (e.activity >= 100 ? 13 : 4); i++) {
      const camera = g.scene.cameras.main;
      const y = camera.scrollY + 120 + ((i * 71 + t * 24) % 470);
      g.lineBetween(camera.scrollX + (i * 241) % 600, y, camera.scrollX + 800 + ((i * 71) % 400), y);
    }
  }
  drawLandmarks(art,e);
  for (const p of e.portals) {
    const back = p.to === "airlock" || p.id === "back",
      color = back ? 0xb6f3d3 : p.to === "core" ? 0xf5bc83 : 0x9ebdaf;
    g.fillStyle(color, 0.055);
    g.fillRect(p.x - 23, p.y - 44, 46, 86);
    g.lineStyle(2, color, 0.6);
    g.strokeRect(p.x - 23, p.y - 44, 46, 86);
    g.lineStyle(2, color, 0.8);
    g.lineBetween(p.x - 8, p.y, p.x + 8, p.y);
    g.lineBetween(p.x + 8, p.y, p.x + 2, p.y - 6);
    g.lineBetween(p.x + 8, p.y, p.x + 2, p.y + 6);
    const labelX = Math.max(20, Math.min(w.width-200, p.x - 52));
    art.label(
      `portal-${p.id}`,
      labelX,
      p.y - 66,
      p.label,
      back ? "#a8d5ba" : "#c4c6a5",
      11,
    );
  }
  if (e.zoneId === "airlock") {
    g.fillStyle(0xa5dfba, 0.06);
    g.fillRoundedRect(95, 450, 170, 160, 12);
    g.lineStyle(2, 0xa5dfba, 0.65);
    g.strokeRoundedRect(95, 450, 170, 160, 12);
    g.lineStyle(1, 0xa5dfba, 0.3);
    for (let y = 470; y < 605; y += 17) g.lineBetween(102, y, 258, y);
    art.label("extraction", 101, 426, "SAFE EXTRACTION", "#b6f3d3", 12);
    art.label("extraction2", 112, 475, "W / 安全撤离", "#e1e8c7", 14);
  }
  if (e.zoneId === "concourse") {
    g.lineStyle(1, 0xc8b780, 0.55);
    g.strokeEllipse(805, w.height - 155, 96, 12);
    for (let y = w.height - 230; y > w.height - 415; y -= 42) {
      g.lineBetween(795, y, 805, y - 10);
      g.lineBetween(805, y - 10, 815, y);
    }
    art.label(
      "launch-hint",
      680,
      w.height - 137,
      "接入推进囊 → 空中再按 Space，登上高架",
      "#b8b68b",
      10,
    );
    art.labels.get("ascent")?.setVisible(false);
  }
  for (const loot of e.area.loot) {
    if (loot.taken) continue;
    const x = loot.x,
      y = loot.y,
      bob = loot.kind === "drop" ? Math.sin(t * 5 + x) * 3 : 0;
    const color =
      loot.kind === "coolant"
        ? 0x8dddd1
        : loot.cargo.core
          ? 0xe0cea0
          : loot.cargo.data
            ? 0xb6bddb
            : 0xbac7aa;
    if (loot.kind === "drop") {
      g.fillStyle(color, 0.1);
      g.fillCircle(x, y + bob, 14);
      g.lineStyle(2, color, 0.85);
      g.strokeCircle(x, y + bob, 6);
      g.fillStyle(color);
      g.fillRect(x - 2, y - 2 + bob, 4, 4);
    } else {
      g.fillStyle(0x263931);
      g.fillRoundedRect(x - 20, y - 20, 40, 37, 4);
      g.lineStyle(1.5, color, 0.8);
      g.strokeRoundedRect(x - 20, y - 20, 40, 37, 4);
      g.lineBetween(x - 16, y - 9, x + 16, y - 9);
      g.fillStyle(color, 0.85);
      g.fillRect(x - 5, y - 4, 10, 9);
      g.lineStyle(1, color, 0.25);
      g.strokeCircle(x, y, 30 + Math.sin(t * 2) * 2);
      art.label(
        `salvage-${loot.id}`,
        Math.min(w.width-150, x - 32),
        y - 41,
        loot.kind === "coolant" ? "冷却泄流 −15%" : loot.label,
        "#acbca8",
        10,
      );
    }
  }
  for (const enemy of w.enemies) {
    if (enemy.dead) continue;
    if (enemy.windup > 0) {
      g.lineStyle(3, 0xf1b46a, 0.65);
      g.lineBetween(
        enemy.x,
        enemy.y + 25,
        enemy.x + enemy.chargeDirection * 210,
        enemy.y + 25,
      );
      art.label(
        "windup-" + enemy.id,
        enemy.x - 40,
        enemy.y - 85,
        "突袭准备 " + (enemy.chargeDirection > 0 ? "→" : "←"),
        "#edb66f",
        12,
      );
    } else if (enemy.stun > 0)
      art.label(
        "stun-" + enemy.id,
        enemy.x - 25,
        enemy.y - 70,
        "失衡",
        "#b8dcca",
        12,
      );
    const organs = enemy.modules.filter((m) => m.parent === enemy && !m.dead);
    if (organs.length && Math.abs(enemy.x - w.player.x) < 650)
      art.label(
        "organs-" + enemy.id,
        Math.max(20, Math.min(w.width-200, enemy.x - 40)),
        enemy.y - enemy.h / 2 - 28,
        enemy.salvageKind
          ? "可回收：" + moduleInfo[enemy.salvageKind].name
          : organs.map((m) => moduleInfo[m.kind].name).join(" / "),
        "#aab8a6",
        10,
      );
  }
  for (const module of e.rig.modules) {
    g.lineStyle(1, moduleInfo[module.kind].color, 0.45);
    g.lineBetween(w.player.x, w.player.y - 10, module.x, module.y);
  }
  for (const field of e.rig.implosions) {
    g.lineStyle(2, 0xb799ff, 0.65);
    g.strokeCircle(field.x, field.y, (118 * field.remaining) / 0.38);
  }
  for (const feature of e.discovery.features) {
    if (feature.zoneId !== e.zoneId) continue;
    if (feature.done && feature.kind !== "memory") continue;
    const blocked = e.discovery.blockedReason(feature, e.discoveryContext);
    const color =
      feature.kind === "survivor"
        ? 0xb2dfb2
        : feature.kind === "lift"
          ? 0x8cd9d0
          : feature.kind === "anomaly"
            ? 0xc59be4
            : 0xe4c893;
    const x = feature.x,
      y = feature.y;
    g.fillStyle(0x172928, 0.9);
    g.lineStyle(2, color, feature.done ? 0.25 : 0.8);
    if (feature.kind === "survivor") {
      g.fillStyle(color);
      g.fillCircle(x, y - 30, 8);
      g.fillRoundedRect(x - 7, y - 20, 14, 28, 4);
      g.strokeCircle(x, y - 20, 35 + Math.sin(t * 3) * 3);
    } else if (feature.kind === "lift") {
      g.strokeRect(x - 30, y - 90, 60, 118);
      g.lineBetween(x - 25, y - 15, x + 25, y - 15);
      g.lineBetween(x, y - 80, x, y + 5);
    } else if (feature.requires) {
      g.fillRoundedRect(x - 43, y - 80, 86, 107, 8);
      g.strokeRoundedRect(x - 43, y - 80, 86, 107, 8);
      g.lineBetween(x - 37, y - 47, x + 37, y - 47);
      if (!feature.done) {
        g.lineBetween(x - 35, y - 30, x + 35, y + 8);
        g.lineBetween(x - 35, y + 8, x + 35, y - 30);
      } else {
        g.lineStyle(3, 0xa7d18b);
        g.lineBetween(x, y + 12, x, y - 25);
        g.lineBetween(x, y - 6, x - 17, y - 21);
        g.lineBetween(x, y - 9, x + 17, y - 30);
      }
    } else {
      g.fillCircle(x, y - 12, 23);
      g.strokeCircle(x, y - 12, 23);
      g.lineBetween(x - 12, y - 12, x, y - 25);
      g.lineBetween(x, y - 25, x + 12, y - 12);
      g.lineBetween(x + 12, y - 12, x, y + 1);
      g.lineBetween(x, y + 1, x - 12, y - 12);
    }
    art.label(
      "feature-" + feature.id,
      Math.max(20, Math.min(w.width-200, x - 48)),
      y - (feature.kind === "lift" || feature.requires ? 112 : 65),
      feature.done
        ? "已取走"
        : feature.label + (feature.recorded ? " · 已记录" : ""),
      feature.done ? "#63776c" : "#d0cfad",
      11,
    );
    if (!feature.done && blocked)
      art.label(
        "feature-lock-" + feature.id,
        Math.max(20, Math.min(w.width-220, x - 65)),
        y - 43,
        feature.requires
          ? "牵引腕可打开"
          : feature.minActivity
            ? "70% 活化苏醒"
            : "",
        "#b193ba",
        10,
      );
  }
  if (e.discovery.escort) {
    const x = w.player.x - w.player.facing * 48,
      y = w.player.y + 12;
    g.fillStyle(0xbed6a3, 0.85);
    g.fillCircle(x, y - 18, 6);
    g.fillRect(x - 5, y - 12, 10, 22);
    g.lineStyle(1, 0xbed6a3, 0.35);
    g.lineBetween(x, y, w.player.x, w.player.y);
  }
  if (e.zoneId === "crater")
    art.label(
      "deep-signal",
      4200,
      e.zone.height-450,
      "UNRECORDED CORE / 未记录核心",
      "#c4b498",
      14,
    );
}
