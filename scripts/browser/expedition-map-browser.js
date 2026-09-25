/** Verifies the 0.10 map view, the F3 ecology overlay, and the lean HUD all render real data. */
async (page) => {
  await page.bringToFront();
  await page.goto("http://127.0.0.1:5173");
  const checks = [],
    check = (v, m) => {
      if (!v) throw new Error(m);
      checks.push(m);
    };
  await page.evaluate(() => {
    document.querySelector('[data-action="start-expedition-unlimited"]')?.click() ??
      document.querySelector('[data-action="start-unlimited"]')?.click();
  });
  await page.waitForFunction(() => window.eclipseSlice?.world?.expedition, null, { timeout: 15000 });

  // Explore a couple of districts so the map has known territory to draw.
  await page.evaluate(() => {
    const w = eclipseSlice.world;
    w.god = true;
    for (const [x, y] of [
      [400, 2340],
      [1900, 2340],
    ]) {
      w.player.x = x;
      w.player.y = y;
    }
  });
  await page.waitForTimeout(600);

  // 1. Tab opens the 0.10 map with districts, extractors and the player marker.
  await page.keyboard.press("Tab");
  await page.waitForSelector(".ascent-map-layout", { timeout: 5000 });
  const map = await page.evaluate(() => {
    const svg = document.querySelector(".ascent-map");
    return {
      districts: svg.querySelectorAll("rect").length,
      paths: svg.querySelectorAll("path").length,
      circles: svg.querySelectorAll("circle").length,
      table: document.querySelectorAll(".eco-table tr").length,
      text: document.body.innerText.includes("货运撤离站"),
      legend: document.body.innerText.includes("重型货物"),
    };
  });
  check(map.districts >= 9, `地图画出 ${map.districts} 个区域`);
  check(map.paths >= 10, `地图画出 ${map.paths} 条连线/捷径`);
  check(map.circles >= 1, "地图画出玩家位置");
  check(map.table >= 1, `地图带生态统计表 (${map.table} 行)`);
  check(map.text, "地图标明货运撤离站");
  check(map.legend, "地图说明重型货物限制");
  await page.screenshot({ path: "output/playwright/expedition-map-view.png" });

  // 2. F3 opens the ecology debug overlay with live numbers. Fast-forward the offscreen ecology
  //    first, because predation pairings need real simulated time to appear.
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const ex = eclipseSlice.world.expedition;
    for (let i = 0; i < 2400; i++) ex.eco.update(0.5, { player: null, open: new Set() });
  });
  await page.keyboard.press("F3");
  await page.waitForSelector(".eco-overlay", { timeout: 5000 });
  const eco = await page.evaluate(() => {
    const el = document.querySelector(".eco-card");
    const txt = el ? el.textContent : "";
    return {
      hasMetrics: /存活 \d+/.test(txt),
      hasRoles: txt.includes("腐食") && txt.includes("猎人") && txt.includes("漂浮"),
      hasPairings: /→ \d+/.test(txt),
      hasNests: txt.includes("巢穴"),
      districts: document.querySelectorAll(".eco-table tr").length,
      apex: /顶点产生 \d+/.test(txt),
      sample: txt.slice(0, 400),
    };
  });
  check(eco.hasMetrics, "F3 显示存活数量");
  check(eco.hasRoles, "F3 显示三种角色数量");
  check(eco.hasPairings, "F3 显示捕食配对计数");
  check(eco.hasNests, "F3 显示巢穴状态");
  check(eco.apex, "F3 显示顶点产生/击杀计数");
  check(eco.districts >= 10, `F3 显示全部 ${eco.districts - 1} 个区域（含未探索）`);
  await page.screenshot({ path: "output/playwright/expedition-eco-overlay.png" });
  await page.keyboard.press("F3");
  await page.waitForTimeout(200);

  // 3. Lean HUD shows cargo value/weight/slots and threat instead of the legacy sample counter.
  const hud = await page.evaluate(() => {
    const t = document.querySelector(".slice-top").innerText,
      b = document.querySelector(".build-tracker")?.innerText ?? "";
    return { top: t, tracker: b };
  });
  check(hud.top.includes("携带价值"), "HUD 顶部显示携带价值");
  check(hud.top.includes("0.10"), "HUD 标注 0.10");
  check(hud.tracker.includes("威胁"), "HUD 显示当前威胁等级");
  check(hud.tracker.includes("货运站"), "HUD 显示货运站供电状态");
  check(hud.tracker.includes("F3"), "HUD 提示 F3 生态面板");

  return { checks, map, eco, hud };
};
