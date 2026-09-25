// Verifies the 0.9 feel layer in a real browser: hitstop, streaks, banners, particles, camera shake.
// Usage: node scripts/verify-feel.mjs   (requires `npm run dev`)
import { chromium } from "playwright-core";
import fs from "node:fs";

const out = "output/playwright/feel";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto("http://127.0.0.1:5173");
await page.waitForFunction(() => window.eclipseSlice);
const checks = [];
const check = (v, m) => {
  if (!v) throw new Error("FAIL: " + m);
  checks.push(m);
};

await page.locator('[data-action="train"]').first().click();
await page.keyboard.press("Escape");
await page.waitForFunction(() => window.eclipseSlice.started && window.eclipseSlice.world.time > 0.2);

// 1. Kill a line of enemies by real weapon fire and confirm feedback state.
await page.evaluate(async () => {
  const { Carrier } = await import("/src/game/SliceWorld.ts");
  const w = window.eclipseSlice.world;
  w.god = true;
  w.enemies = [];
  for (let i = 0; i < 12; i++) {
    const e = new Carrier("crawler", w.player.x + 150 + i * 45, 584, "ram", 1);
    e.hp = e.maxHp = 1;
    e.spawnGrace = 0;
    e.cooldown = 99;
    w.enemies.push(e);
  }
});
const box = await page.locator("canvas").boundingBox();
const aimNearest = async () => {
  const p = await page.evaluate(() => {
    const s = window.eclipseSlice,
      w = s.world,
      cam = s.cameras.main,
      alive = w.enemies.filter((e) => !e.dead);
    const e = alive.sort(
      (a, b) =>
        Math.hypot(a.x - w.player.x, a.y - w.player.y) - Math.hypot(b.x - w.player.x, b.y - w.player.y),
    )[0];
    return e ? { x: e.x - cam.scrollX, y: e.y - cam.scrollY } : null;
  });
  if (p) await page.mouse.move(box.x + (p.x * box.width) / 1280, box.y + (p.y * box.height) / 720);
  return !!p;
};
await page.mouse.down();
for (let i = 0; i < 30; i++) {
  if (!(await aimNearest())) break;
  if (i === 8) await page.screenshot({ path: `${out}/01-streak.png` });
  await page.waitForTimeout(110);
}
await page.mouse.up();
const state = await page.evaluate(() => {
  const j = window.eclipseSlice.world.juice;
  return {
    kills: j.totalKills,
    streak: j.streak,
    best: j.best,
    tier: j.tier,
    bannerText: [...document.querySelectorAll("#juice .juice-banner b")].map((b) => b.textContent),
    streakHud: document.querySelector("#juice .juice-streak b")?.textContent ?? null,
    particles: j.particles.length,
    banners: j.banners.length,
  };
});
check(state.kills >= 8, `实战击杀累计 ${state.kills}`);
check(state.best >= 5, `连杀记录 ${state.best}`);
check(state.tier >= 2, `进入狂热档位 ${state.tier}`);
check(state.streakHud !== null, "HUD 显示连杀计数");
check(state.particles > 0, `粒子系统在工作（${state.particles}）`);
check(state.bannerText.length > 0, `横幅已出现：${state.bannerText.join("/")}`);
await page.screenshot({ path: `${out}/02-frenzy.png` });

// 2. Hitstop really freezes the simulation while presentation keeps running.
const stop = await page.evaluate(async () => {
  const s = window.eclipseSlice,
    w = s.world;
  w.juice.hitstop = 0;
  w.juice.beat("heavy", w.player.x, w.player.y, 0xffffff, 0);
  await new Promise((r) => requestAnimationFrame(r));
  const frozenScale = s.timeScale;
  const t0 = w.time;
  const wall0 = performance.now();
  await new Promise((r) => setTimeout(r, 120));
  return {
    advanced: w.time - t0,
    wall: (performance.now() - wall0) / 1000,
    frozenScale,
    hitstop: w.juice.hitstop,
  };
});
check(stop.frozenScale === 0, `顿帧帧的模拟时间缩放为 0（实测 ${stop.frozenScale}）`);
check(
  stop.advanced < stop.wall * 0.7,
  `顿帧吃掉模拟时间：${stop.advanced.toFixed(3)}s / 墙钟 ${stop.wall.toFixed(3)}s`,
);

// 3. Camera shake offsets the camera without drifting the follow target.
const cam = await page.evaluate(async () => {
  const s = window.eclipseSlice,
    w = s.world;
  w.juice.trauma = 1;
  const seen = [];
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    seen.push({
      x: s.cameras.main.scrollX,
      angle: s.cameras.main.angle,
      rotation: s.cameras.main.rotation,
      trauma: w.juice.trauma,
      shake: w.juice.shake(w.juice.particles.length).angle,
    });
  }
  return seen;
});
const maxRot = Math.max(...cam.map((c) => Math.abs(c.rotation)));
check(new Set(cam.map((c) => Math.round(c.x))).size > 2, "镜头震动产生位移");
check(maxRot > 0.0004, `镜头震动带轻微旋转（最大 ${maxRot.toFixed(4)} rad）`);

// 4. Perfect dodge slow-motion through real input.
const dodge = await page.evaluate(async () => {
  const w = window.eclipseSlice.world;
  w.god = false;
  w.juice.slowmo = 0;
  w.player.invulnerable = 0.1;
  w.player.dashTime = 0.1;
  w.dashSerial += 1;
  w.hurtPlayer(10, w.player.x + 60);
  return { slowmo: w.juice.slowmo, dodges: w.metrics.perfectDodges };
});
check(dodge.slowmo > 0, "完美闪避触发慢动作");

console.log(JSON.stringify({ checks, state, stop, dodge, errors }, null, 2));
if (errors.length) throw new Error("browser errors: " + errors.join(" | "));
await browser.close();
