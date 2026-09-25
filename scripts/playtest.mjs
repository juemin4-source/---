// Bot playtest: plays the real ascent map and reports combat metrics that proxy for "feel".
// Usage: node scripts/playtest.mjs [seconds] [mode]
import { chromium } from "playwright-core";

const seconds = Number(process.argv[2] ?? 90);
const mode = process.argv[3] ?? "unlimited";
const god = process.argv[4] !== "mortal";
const pickIds = (source) => {
  const block = source.slice(source.indexOf("export const organs"), source.indexOf("export const organIds"));
  return [...block.matchAll(/^ {2}([a-zA-Z]+): \{/gm)].map((m) => m[1]);
};
const organIds = pickIds(await (await import("node:fs/promises")).readFile("src/game/config.ts", "utf8"));
// The six-slot mode cannot hold all 28 organs, so it gets a realistic mixed build instead.
const grantIds = mode === "six" ? ["mark", "conduit", "spread", "speed", "leech", "heavyArea"] : organIds;
if (!organIds.length) throw new Error("could not read organ ids from config.ts");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://127.0.0.1:5173");
await page.waitForFunction(() => window.eclipseSlice);
await page
  .locator(`[data-action="${mode === "six" ? "start-six" : "start-unlimited"}"]`)
  .first()
  .click();
await page.waitForFunction(() => window.eclipseSlice.started && window.eclipseSlice.world.time > 0.2);

// Give the bot a build so it can actually kill things, and keep it alive to measure output.
await page.evaluate(
  async ({ god, ids }) => {
    const w = window.eclipseSlice.world;
    for (const id of ids) w.grant(id);
    w.pendingDrop = null;
    w.god = god;
    w.juice.beats = 0;
    w.juice.kills = 0;
    const j = w.juice;
    const original = j.beat.bind(j);
    j.beat = (kind, ...rest) => {
      j.beats++;
      if (kind === "kill" || kind === "eliteKill") j.kills++;
      return original(kind, ...rest);
    };
    // Time-to-kill sampling: record the first damage timestamp of each enemy.
    w._firstHit = new Map();
    w._ttk = [];
    const originalHit = w.hit.bind(w);
    w.hit = (e, ...rest) => {
      if (!e.dead && !w._firstHit.has(e.id)) w._firstHit.set(e.id, w.time);
      const wasAlive = !e.dead;
      const r = originalHit(e, ...rest);
      if (wasAlive && e.dead) {
        const t = w._firstHit.get(e.id);
        if (t !== undefined) w._ttk.push(w.time - t);
        w._firstHit.delete(e.id);
      }
      return r;
    };
  },
  { god, ids: grantIds },
);
const box = await page.locator("canvas").boundingBox();
// The bot cannot platform, so it relocates to the nearest fight instead of walking the whole shaft.
const reposition = async () => {
  await page.evaluate(() => {
    const w = window.eclipseSlice.world,
      p = w.player;
    const e = w.enemies
      .filter((e) => !e.dead)
      .sort(
        (a, b) =>
          Math.abs(a.x - p.x) + Math.abs(a.y - p.y) * 2 - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y) * 2),
      )[0];
    if (!e) return;
    if (Math.abs(e.y - p.y) > 140 || Math.abs(e.x - p.x) > 520) {
      p.x = e.x - Math.sign(e.x - p.x || 1) * 300;
      p.y = e.y - 20;
      p.vx = 0;
      p.vy = 0;
      w.juice.trauma = 0;
    }
  });
};
const drive = async () => {
  const s = await page.evaluate(() => {
    const sc = window.eclipseSlice,
      w = sc.world,
      cam = sc.cameras.main,
      p = w.player;
    const alive = w.enemies.filter((e) => !e.dead && Math.abs(e.y - p.y) < 260);
    const e = alive.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    return {
      aimX: (e?.x ?? p.x + 200 * p.facing) - cam.scrollX,
      aimY: (e?.y ?? p.y) - cam.scrollY,
      dx: e ? e.x - p.x : 0,
      time: w.time,
      dealt: w.metrics.dealt,
      kills: w.stats.kills,
      streak: w.juice.streak,
      best: w.juice.best,
      tier: w.juice.tier,
      damage: w.metrics.damage,
      dodges: w.metrics.perfectDodges,
    };
  });
  await page.mouse.move(box.x + (s.aimX * box.width) / 1280, box.y + (s.aimY * box.height) / 720);
  const dir = s.dx > 140 ? "d" : s.dx < -140 ? "a" : null;
  if (dir) await page.keyboard.down(dir);
  return { s, dir };
};
await page.mouse.down();
const t0 = Date.now();
let last = null;
let held = null;
while ((Date.now() - t0) / 1000 < seconds) {
  await reposition();
  const { s, dir } = await drive();
  if (held && held !== dir) await page.keyboard.up(held);
  held = dir;
  last = s;
  if (Math.random() < 0.06) await page.keyboard.press("Shift");
  if (Math.random() < 0.05) await page.keyboard.press("Space");
  await page.waitForTimeout(120);
}
await page.mouse.up();
if (held) await page.keyboard.up(held);
const final = await page.evaluate(() => {
  const w = window.eclipseSlice.world,
    j = w.juice;
  const ttk = w._ttk ?? [];
  ttk.sort((a, b) => a - b);
  return {
    time: w.time,
    kills: w.stats.kills,
    dealt: Math.round(w.metrics.dealt),
    shots: w.metrics.shots,
    hits: w.metrics.hits,
    damageTaken: Math.round(w.metrics.damage),
    dodges: w.metrics.perfectDodges,
    staggers: w.metrics.staggers,
    best: j.best,
    totalKills: j.totalKills,
    beats: j.beats,
    organs: w.slots.length,
    layers: w.totalLayers,
    ttkMedian: ttk.length ? +ttk[Math.floor(ttk.length / 2)].toFixed(2) : null,
    ttkSamples: ttk.length,
    result: w.result,
  };
});
console.log(
  JSON.stringify(
    {
      mode,
      wallSeconds: (Date.now() - t0) / 1000,
      killsPerMin: +((final.kills / final.time) * 60).toFixed(1),
      accuracy: +((final.hits / Math.max(1, final.shots)) * 100).toFixed(1),
      dps: +(final.dealt / final.time).toFixed(1),
      beatsPerMin: +((final.beats / final.time) * 60).toFixed(1),
      bestStreak: final.best,
      staggersPerKill: +(final.staggers / Math.max(1, final.kills)).toFixed(2),
      ttkMedian: final.ttkMedian,
      dodges: final.dodges,
      final,
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
