import type { World } from "./World";
import { EnemyModule, type ModuleKind } from "./EnemyModule";
import type { EnemyKind } from "./Enemy";
export class DebugTools {
  visible = false;
  hitboxes = false;
  panel = document.getElementById("debug")!;
  constructor(private world: () => World) {
    this.panel.innerHTML = `<div class="debug-title">FIELD LAB <span>F1 关闭</span></div><small>生成独立模块</small><div class="debug-row">${[
      "thruster:推进囊",
      "gun:炮腕",
      "shield:甲壳盾",
      "grapple:牵引腕",
    ]
      .map((v) => {
        const [id, name] = v.split(":");
        return `<button data-module="${id}">${name}</button>`;
      })
      .join("")}</div><small>生成敌人</small><div class="debug-row">${[
      "crawler:爬行",
      "floater:浮游",
      "reclaimer:回收",
      "elite:精英",
    ]
      .map((v) => {
        const [id, name] = v.split(":");
        return `<button data-enemy="${id}">${name}</button>`;
      })
      .join(
        "",
      )}</div><div class="debug-row"><button data-action="clear">清除敌人</button><button data-action="god">无敌 OFF</button><button data-action="hit">Hitbox OFF</button></div><small>跳转房间</small><div class="debug-row">${[1, 2, 3, 4, 5].map((i) => `<button data-room="${i - 1}">0${i}</button>`).join("")}</div>`;
    this.panel.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.panel.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      const w = this.world();
      if (b.dataset.module) {
        const m = new EnemyModule(
          b.dataset.module as ModuleKind,
          Math.min(1120, w.player.x + 95),
          540,
        );
        m.cooldown = 2;
        w.modules.push(m);
      }
      if (b.dataset.enemy)
        w.spawnEnemy(
          b.dataset.enemy as EnemyKind,
          Math.min(1100, w.player.x + 350),
          b.dataset.enemy === "floater" ? 370 : 550,
        );
      if (b.dataset.action === "clear") {
        w.enemies.forEach((e) => w.damageEnemy(e, 99999));
      }
      if (b.dataset.action === "god") {
        w.god = !w.god;
        b.textContent = `无敌 ${w.god ? "ON" : "OFF"}`;
      }
      if (b.dataset.action === "hit") {
        this.hitboxes = !this.hitboxes;
        b.textContent = `Hitbox ${this.hitboxes ? "ON" : "OFF"}`;
      }
      if (b.dataset.room !== undefined) w.enterRoom(Number(b.dataset.room));
      b.blur();
    });
  }
  toggle() {
    this.visible = !this.visible;
    this.panel.hidden = !this.visible;
  }
}
