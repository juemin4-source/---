import { World } from "../../engine/World";
import type { Controls } from "../../engine/Player";
import type { Renderer } from "../../engine/Renderer";
import type { MetaProgress } from "./MetaProgression";
import type { HubTab } from "./MetaUI";

export const campStations: readonly {
  tab: HubTab;
  x: number;
  name: string;
  subtitle: string;
  color: number;
}[] = [
  { tab: "warehouse", x: 280, name: "物资仓库", subtitle: "入库 / 出售 / 保留材料", color: 0xc2a475 },
  { tab: "training", x: 690, name: "训练区", subtitle: "体能 / 散热 / 耐力", color: 0x89b7a0 },
  { tab: "research", x: 1100, name: "机械工坊", subtitle: "研究 / 安装武器改造", color: 0x91b4c6 },
  { tab: "facilities", x: 1530, name: "设施控制室", subtitle: "技术 / 治疗 / 货运 / 能源", color: 0xc0a0c6 },
  { tab: "overview", x: 2040, name: "出发气闸", subtitle: "选择装备 / 进入沉井", color: 0xe0c17c },
  { tab: "residents", x: 2460, name: "居民生活区", subtitle: "安置 / 书籍 / 职业学习", color: 0xb5c7a1 },
  { tab: "commerce", x: 2880, name: "补给与提炼", subtitle: "商店 / 锂 / 超重氢", color: 0xc4a884 },
];
/** A separate safe map: only locomotion runs, never combat, ecology or expedition settlement. */
export class CampWorld extends World {
  constructor() {
    super(false);
    this.width = 3240;
    this.height = 720;
    this.enemies = [];
    this.modules = [];
    this.platforms = [{ x: 1620, y: 660, w: 3240, h: 140 }];
    this.player.x = 230;
    this.player.y = 566;
    this.player.boundsWidth = this.width;
    this.player.grounded = true;
  }
  station() {
    return (
      campStations.find((s) => Math.abs(s.x - this.player.x) < 100 && Math.abs(this.player.y - 566) < 70) ??
      null
    );
  }
  step(dt: number, c: Controls) {
    this.time += dt;
    this.player.update(dt, { ...c, fire: false, melee: false, phase: false, grab: false }, this.platforms);
  }
  draw(art: Renderer, meta: MetaProgress) {
    // Standard renderer updates the shared hero sprite and clears the expedition backdrop.
    art.render(this, false, this.player.x + 60, this.player.y);
    for (const t of art.labels.values()) t.setVisible(false);
    const g = art.g;
    g.clear();
    if (art.skin.campBackdrop()) {
      const near = this.station();
      for (const [i, station] of campStations.entries()) {
        const selected = station === near;
        g.fillStyle(0x101b23, selected ? 0.9 : 0.65);
        g.fillRoundedRect(station.x - 130, 610, 260, selected ? 78 : 40, 5);
        art.label(
          `camp-title-${i}`,
          station.x - 112,
          620,
          station.name,
          selected ? "#f6d7a3" : "#a5b6ba",
          19,
        );
        if (selected) {
          art.label(`camp-sub-${i}`, station.x - 112, 650, station.subtitle, "#c1c8bd", 12);
          art.label(
            "camp-prompt",
            this.player.x - 80,
            this.player.y - 96,
            `E · ${station.name}`,
            "#ffe0a3",
            16,
          );
          g.lineStyle(2, station.color, 0.8);
          g.lineBetween(station.x - 70, 591, station.x + 70, 591);
        }
      }
      art.label("camp-life", 2330, 432, `已安置 ${meta.campaign.residents.length} 位居民`, "#d6c8a9", 13);
      art.label(
        "camp-stock",
        160,
        428,
        `库存 ${Object.values(meta.warehouse).reduce((a, n) => a + n, 0)} 件`,
        "#d6c8a9",
        13,
      );
      g.fillStyle(0x071018, 0.3);
      g.fillEllipse(this.player.x, 590, 36, 6);
      return;
    }
    g.fillStyle(0x101920);
    g.fillRect(0, 0, this.width, 720);
    // Recessed service gallery behind the five inhabited bays.
    g.fillStyle(0x1c303b);
    g.fillRect(40, 145, this.width - 80, 360);
    g.fillStyle(0x263e48);
    g.fillRect(60, 170, this.width - 120, 130);
    for (let x = 70; x < this.width - 20; x += 170) {
      g.fillStyle(0x17272f);
      g.fillRect(x, 160, 12, 345);
      g.lineStyle(2, 0x4b6267, 0.35);
      g.lineBetween(x, 240, x + 160, 240);
    }
    g.fillStyle(0x131f26);
    g.fillRect(0, 310, this.width, 280);
    g.lineStyle(7, 0x344a50);
    g.lineBetween(30, 333, this.width - 30, 333);
    g.lineStyle(2, 0x779184, 0.5);
    g.lineBetween(30, 328, this.width - 30, 328);
    g.fillStyle(0x26343b);
    g.fillRect(0, 590, this.width, 130);
    g.fillStyle(0x849390);
    g.fillRect(0, 590, this.width, 5);
    g.fillStyle(0x10181d);
    g.fillRect(0, 620, this.width, 100);
    for (let x = 20; x < this.width; x += 110) {
      g.lineStyle(1, 0x4a5b60, 0.5);
      g.lineBetween(x, 595, x + 25, 620);
    }
    const near = this.station();
    for (const [i, s] of campStations.entries()) {
      const x = s.x;
      // Lamps and a quiet cone distinguish places without filling them with particles.
      g.fillStyle(s.color, 0.045);
      g.fillTriangle(x, 205, x - 165, 590, x + 165, 590);
      g.fillStyle(0x11191d);
      g.fillRect(x - 45, 200, 90, 14);
      g.fillStyle(s.color, 0.9);
      g.fillRect(x - 35, 211, 70, 3);
      g.fillStyle(0x33434a);
      g.fillRect(x - 172, 355, 344, 214);
      g.fillStyle(0x1a282f);
      g.fillRect(x - 165, 362, 330, 207);
      art.label(`camp-title-${i}`, x - 105, 265, s.name, "#d9e3df", 23);
      art.label(`camp-sub-${i}`, x - 105, 298, s.subtitle, "#8fa5a9", 12);
      if (s.tab === "warehouse") {
        for (const [dx, y, w] of [
          [-135, 492, 85],
          [-40, 514, 104],
          [-118, 429, 66],
          [76, 484, 65],
        ]) {
          g.fillStyle(0x665a45);
          g.fillRect(x + dx, y, w, 588 - y);
          g.lineStyle(2, 0xb9a478, 0.55);
          g.strokeRect(x + dx + 5, y + 5, w - 10, 583 - y);
          g.lineBetween(x + dx + 7, y + 8, x + dx + w - 7, 580);
        }
        const count = Object.values(meta.warehouse).reduce((a, n) => a + n, 0);
        art.label("camp-stock", x - 100, 388, `已保管 ${count} 件物资`, "#d9c598", 14);
      } else if (s.tab === "training") {
        g.lineStyle(5, 0x6c8985);
        g.lineBetween(x - 100, 372, x - 100, 585);
        g.lineBetween(x - 100, 372, x + 45, 372);
        g.lineStyle(2, 0x9bada7);
        g.lineBetween(x + 30, 372, x + 30, 420);
        g.fillStyle(0x786058);
        g.fillRoundedRect(x + 7, 420, 46, 105, 12);
        g.fillStyle(0x53796c);
        g.fillRect(x - 90, 579, 160, 10);
        const levels = Object.values(meta.training).reduce((a, n) => a + n, 0);
        art.label("camp-drills", x - 135, 390, `训练进度 ${levels} / 9`, "#a5c5b2", 12);
      } else if (s.tab === "research") {
        g.fillStyle(0x536873);
        g.fillRect(x - 133, 515, 266, 14);
        g.fillStyle(0x293c47);
        g.fillRect(x - 123, 529, 26, 60);
        g.fillRect(x + 100, 529, 26, 60);
        g.fillStyle(0x101e25);
        g.fillRect(x - 108, 416, 100, 76);
        g.lineStyle(2, 0x8cb9c9);
        g.strokeRect(x - 104, 420, 92, 68);
        g.lineBetween(x - 90, 469, x - 75, 440);
        g.lineBetween(x - 75, 440, x - 30, 463);
        g.fillStyle(0x9dabb0);
        g.fillRect(x + 30, 493, 63, 10);
        g.fillRect(x + 66, 481, 12, 24);
        art.label("camp-research", x - 125, 380, `改造档案 ${meta.unlocked.length} / 3`, "#a9c6d0", 12);
      } else if (s.tab === "facilities") {
        for (const [j, id] of (["workshop", "infirmary", "freight", "generator"] as const).entries()) {
          const bx = x - 139 + j * 72,
            built = meta.facilities.includes(id);
          g.fillStyle(built ? 0x384e51 : 0x263238);
          g.fillRoundedRect(bx, 418, 61, 170, 5);
          g.fillStyle(built ? 0xb8d4ae : 0x655d58);
          g.fillCircle(bx + 30, 444, 5);
          g.lineStyle(2, built ? 0x92b6a1 : 0x425057);
          g.strokeRect(bx + 12, 462, 37, 75);
        }
        art.label("camp-built", x - 133, 380, `运行设施 ${meta.facilities.length} / 4`, "#c8b7cd", 12);
      } else if (s.tab === "residents" || s.tab === "commerce") {
        g.fillStyle(0x56675e);
        g.fillRoundedRect(x - 130, 494, 260, 75, 8);
        g.fillStyle(0xb0b6a1);
        g.fillRect(x - 120, 490, 65, 15);
        art.label(
          `camp-extra-${s.tab}`,
          x - 125,
          389,
          s.tab === "residents" ? `已安置 ${meta.campaign.residents.length} 人` : "商店与材料处理",
          "#c5d0bb",
          14,
        );
      } else {
        g.fillStyle(0x4a5150);
        g.fillRect(x - 80, 350, 160, 240);
        g.fillStyle(0x17252b);
        g.fillRect(x - 67, 363, 134, 227);
        g.lineStyle(3, 0xc0aa78);
        g.strokeRect(x - 60, 370, 120, 215);
        g.lineStyle(2, 0x526f71);
        g.lineBetween(x, 374, x, 584);
        g.fillStyle(0x9ac8ac);
        g.fillRect(x - 34, 390, 68, 6);
        art.label("camp-depart", x - 36, 455, "沉井\n  ↓", "#e5cc94", 19);
      }
      if (near === s) {
        g.lineStyle(2, s.color, 0.9);
        g.lineBetween(x - 75, 605, x + 75, 605);
        art.label("camp-prompt", this.player.x - 95, this.player.y - 115, `E · ${s.name}`, "#ffe2a4", 16);
      }
    }
    if (!art.skin.heroReady) {
      g.fillStyle(0xdde3dd);
      g.fillRoundedRect(this.player.x - 10, this.player.y - 22, 20, 46, 5);
    }
    g.fillStyle(0, 0.25);
    g.fillEllipse(this.player.x, 590, 36, 5);
  }
}
