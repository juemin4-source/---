import type { Renderer } from "./Renderer";
import type { Expedition } from "./Expedition";
import { shortcuts } from "./ExpeditionMap";
export function drawLandmarks(art: Renderer, e: Expedition) {
  const g = art.g,
    z = e.zone,
    floor = z.height - 110,
    cx = z.width / 2;
  if (e.area.lift) {
    const l = e.area.lift;
    g.lineStyle(3, 0xe0c68a, 0.8);
    g.strokeRect(l.x - 170, l.y - 110, 340, 120);
    art.label(
      "local-lift",
      l.x - 160,
      l.y - 145,
      "维护升降台 · 自动往返 / 可随时离开",
      "#e0c68a",
      15,
    );
  }
  if (z.depth >= 5) {
    const vx = g.scene.cameras.main.scrollX,
      vy = g.scene.cameras.main.scrollY;
    g.lineStyle(2, 0x91a8b7, 0.2);
    g.strokeCircle(vx + 930, vy + 165, 110);
    g.strokeCircle(vx + 943, vy + 160, 103);
    g.strokeTriangle(vx + 720, vy + 350, vx + 780, vy + 95, vx + 840, vy + 350);
    g.strokeEllipse(vx + 350, vy + 330, 420, 170);
    art.label(
      "surface-horizon",
      vx + 785,
      vy + 355,
      "远处：晨光塔",
      "#7999a5",
      12,
    );
  }
  g.lineStyle(3, z.quiet ? 0xc8b77f : z.depth >= 5 ? 0x8faaba : 0x637e73, 0.45);
  if (z.id === "turbine") {
    g.strokeCircle(cx, floor - 270, 220);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6 + e.seconds * 0.06;
      g.lineBetween(
        cx,
        floor - 270,
        cx + Math.cos(a) * 200,
        floor - 270 + Math.sin(a) * 200,
      );
    }
  } else if (["core", "tower"].includes(z.id)) {
    g.strokeRect(200, 130, 1650, floor - 130);
    for (let y = 180; y < floor; y += 250) {
      g.lineBetween(200, y, 1850, y);
      art.label(
        "height-" + y,
        220,
        y + 10,
        "↑ " + Math.round((floor - y) / 10) + " m / 上行",
        "#8dafa3",
        15,
      );
    }
  } else if (z.id === "station") {
    art.label("arrival-directions", 280, floor - 260, "西线 · 住宅与活人     东线 · 商业街与光塔     北线 · 坠落坑", "#cedbcb", 19);
    g.strokeRect(1800, floor - 470, 1700, 470);
    g.strokeTriangle(1800, floor - 470, 2650, floor - 650, 3500, floor - 470);
    art.label(
      "station-sign",
      2050,
      floor - 380,
      "冻结车站 / 西：活人  东：晨光塔  北：星骸",
      "#cedbcb",
      30,
    );
  } else if (["nursery", "dome"].includes(z.id)) {
    g.strokeEllipse(cx, floor - 230, z.width - 300, 650);
    for (let x = 500; x < z.width - 300; x += 400) {
      g.lineBetween(x, floor, x, floor - 130);
      g.lineBetween(x, floor - 70, x + 60, floor - 130);
    }
  } else if (z.id === "quarantine") {
    g.strokeRect(cx - 230, 150, 460, floor - 150);
    art.label(
      "surface-boundary",
      cx - 280,
      300,
      "地表隔离闸 / 门外是永夜",
      "#c9d9de",
      30,
    );
  } else {
    for (let x = 400; x < z.width - 200; x += 650) {
      g.strokeRect(x, floor - 340, 400, 340);
      for (let y = floor - 290; y < floor - 40; y += 80)
        g.strokeRect(x + 50, y, 300, 40);
    }
  }
  art.label(
    "landmark-name",
    cx - 200,
    Math.max(160, floor - 550),
    z.name + " / " + z.band,
    z.quiet ? "#c4ba91" : "#819fa9",
    28,
  );
  for (const s of shortcuts)
    if (s.from === e.zoneId) {
      const y = z.height - 134;
      g.lineStyle(
        3,
        e.profile.shortcuts.includes(s.id) ? 0x99ddb0 : 0xc4a566,
        0.8,
      );
      g.strokeRect(s.x - 40, y - 110, 80, 138);
      art.label(
        "shortcut-" + s.id,
        s.x - 100,
        y - 150,
        s.id +
          " " +
          (e.profile.shortcuts.includes(s.id)
            ? "已恢复 / 下行"
            : s.label + " / 材料 " + s.cost),
        "#d9c79c",
        15,
      );
    }
}
