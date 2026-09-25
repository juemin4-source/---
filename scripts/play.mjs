// Scripted play session with screenshots. Usage: node scripts/play.mjs [label] [mode]
// Requires `npm run dev` on 127.0.0.1:5173 and a local Chrome install.
import { chromium } from "playwright-core";
import fs from "node:fs";

const label = process.argv[2] ?? "play";
const mode = process.argv[3] ?? "train"; // train | unlimited | six
const out = `output/playwright/${label}`;
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto("http://127.0.0.1:5173");
await page.waitForFunction(() => window.eclipseSlice);
await page.screenshot({ path: `${out}/00-home.png` });
const action = { train: "train", unlimited: "start-unlimited", six: "start-six" }[mode];
await page.locator(`[data-action="${action}"]`).first().click();
if (mode === "train") {
  // Close the bench panel so combat runs.
  await page.keyboard.press("Escape");
}
await page.waitForTimeout(400);
const canvas = page.locator("canvas");
const box = await canvas.boundingBox();
const aimAtNearest = async () => {
  const p = await page.evaluate(() => {
    const s = window.eclipseSlice,
      w = s.world,
      cam = s.cameras.main,
      e = w.enemies
        .filter((e) => !e.dead)
        .sort((a, b) => Math.abs(a.x - w.player.x) - Math.abs(b.x - w.player.x))[0];
    const t = e ?? { x: w.player.x + 300 * w.player.facing, y: w.player.y };
    return { x: t.x - cam.scrollX, y: t.y - cam.scrollY, px: w.player.x, ex: e?.x };
  });
  await page.mouse.move(box.x + (p.x * box.width) / 1280, box.y + (p.y * box.height) / 720);
  return p;
};
await page.evaluate(() => (window.eclipseSlice.world.god = true));
let shot = 1;
for (let t = 0; t < 12; t++) {
  const p = await aimAtNearest();
  await page.mouse.down();
  if (p.ex !== undefined) {
    const key = p.ex > p.px ? "d" : "a";
    if (Math.abs(p.ex - p.px) > 220) await page.keyboard.down(key);
    if (t % 3 === 1) await page.keyboard.press("Shift");
    if (t % 4 === 2) await page.keyboard.press("Space");
    await page.waitForTimeout(250);
    await page.keyboard.up(key);
  }
  await page.waitForTimeout(250);
  await page.mouse.up();
  if (t % 3 === 2) await page.screenshot({ path: `${out}/${String(shot++).padStart(2, "0")}-combat.png` });
}
const stats = await page.evaluate(() => {
  const w = window.eclipseSlice.world;
  return { time: w.time, dealt: Math.round(w.metrics.dealt), hits: w.metrics.hits, kills: w.stats.kills };
});
console.log(JSON.stringify({ stats, errors }, null, 2));
await browser.close();
