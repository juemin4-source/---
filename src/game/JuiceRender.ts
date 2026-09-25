import type { Renderer } from "../engine/Renderer";
import type { Juice } from "./Juice";

/** World-space part of the feel layer: impact particles and flying bodies. */
export function renderJuice(art: Renderer, juice: Juice, time: number) {
  const g = art.g;
  for (const c of juice.corpses) {
    const t = c.life / c.maxLife,
      alpha = Math.min(1, t * 1.6),
      r = c.radius * (0.6 + t * 0.4);
    g.save();
    g.translateCanvas(c.x, c.y);
    g.rotateCanvas(c.angle);
    g.fillStyle(c.color, alpha * 0.75);
    g.fillCircle(0, 0, r);
    g.lineStyle(2, 0x1a1116, alpha * 0.6);
    g.strokeCircle(0, 0, r);
    g.fillStyle(0xffffff, alpha * 0.18);
    g.fillCircle(-r * 0.25, -r * 0.25, r * 0.3);
    g.restore();
  }
  for (const p of juice.particles) {
    const t = 1 - p.life / p.maxLife,
      alpha = p.kind === "ring" ? (1 - t) * 0.85 : 1 - t * t;
    if (p.kind === "ring") {
      g.lineStyle(4 * (1 - t) + 1, p.color, alpha);
      g.strokeCircle(p.x, p.y, p.vx * t * 0.5 + 6);
    } else if (p.kind === "streak") {
      g.lineStyle(2, p.color, alpha);
      g.lineBetween(p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.x, p.y);
    } else {
      g.fillStyle(p.color, alpha);
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  // Frenzy halo: the harder the streak, the hotter the ring around the player.
  void time;
}

/** Screen-space part: banners + flash + vignette, all DOM so they never fight the camera. */
export function juiceStyle(juice: Juice) {
  const flash = juice.flash * 0.42,
    vig = juice.hurtVignette * 0.85;
  return [
    flash > 0.004
      ? `background:radial-gradient(circle at 50% 45%, #${juice.flashColor.toString(16).padStart(6, "0")}${Math.round(
          flash * 255,
        )
          .toString(16)
          .padStart(2, "0")} 0%, transparent 62%)`
      : "",
    vig > 0.004
      ? `box-shadow:inset 0 0 ${Math.round(60 + vig * 120)}px ${Math.round(vig * 90)}px rgba(255,60,80,${vig.toFixed(2)})`
      : "",
  ]
    .filter(Boolean)
    .join(";");
}

export function juiceBannerHTML(juice: Juice) {
  if (!juice.banners.length) return "";
  return juice.banners
    .map((b) => {
      const t = b.life / b.maxLife,
        pop = Math.min(1, (1 - t) * 6);
      return `<div class="juice-banner tier-${b.tier}" style="opacity:${Math.min(1, t * 3).toFixed(2)};transform:scale(${(0.7 + pop * 0.3).toFixed(3)})"><b>${b.text}</b>${b.sub ? `<span>${b.sub}</span>` : ""}</div>`;
    })
    .join("");
}
