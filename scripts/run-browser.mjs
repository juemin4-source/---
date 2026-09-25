// Runs a browser scenario script (scripts/browser/*.js) with playwright-core + local Chrome.
// Each script exports `async (page) => ({...})` as its default-ish expression body.
// Usage: node scripts/run-browser.mjs scripts/browser/slice-first-room.js
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const file = process.argv[2];
const startMode = process.argv[3] ?? "none"; // none | six | unlimited | train | train-unlimited
if (!file) {
  console.error("usage: node scripts/run-browser.mjs scripts/browser/<script>.js [startMode]");
  process.exit(2);
}
const source = fs.readFileSync(file, "utf8").replace(/^async \(page\) =>/, "async (page) =>");
const run = new Function(`return (${source.trim().replace(/;$/, "")})`)();

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shotDir = path.join("output", "playwright", path.basename(file, ".js"));
fs.mkdirSync(shotDir, { recursive: true });
try {
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.eclipseSlice);
  if (startMode !== "none") {
    await page.locator(`[data-action="${startMode}"]`).first().click();
    await page.waitForFunction(() => window.eclipseSlice.started && window.eclipseSlice.world.time > 0.2);
    if (startMode.startsWith("train")) await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  const result = await run(page);
  console.log(JSON.stringify({ script: file, result, errors }, null, 2));
  process.exitCode = errors.length ? 1 : 0;
} catch (e) {
  console.error(`[${file}] ${e.message}`);
  console.error(JSON.stringify({ errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
