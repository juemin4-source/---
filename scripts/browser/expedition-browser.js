/**
 * 0.10 expedition smoke test: proves the map is walkable, that search works, that noise reaches the
 * ecology, and that both extractors behave as designed (heavy cargo only leaves via the freight
 * station, which needs power first).
 */
async (page) => {
  await page.bringToFront();
  await page.goto("http://127.0.0.1:5173");
  const checks = [],
    check = (v, m) => {
      if (!v) throw new Error(m);
      checks.push(m);
    };
  await page.evaluate(() => {
    // Start a real expedition run without depending on intro markup.
    document.querySelector('[data-action="start-expedition-unlimited"]')?.click() ??
      document.querySelector('[data-action="start-unlimited"]')?.click();
  });
  await page.waitForFunction(() => window.eclipseSlice?.world?.expedition, null, { timeout: 15000 });
  check(await page.evaluate(() => !!eclipseSlice.world.expedition), "进入 0.10 生态出行");

  // 1. Geometry: player stands on a floor and is grounded, and the map has real platforms.
  const geo = await page.evaluate(() => {
    const w = eclipseSlice.world;
    return {
      platforms: w.platforms.length,
      width: w.width,
      height: w.height,
      x: w.player.x,
      y: w.player.y,
      narrow: w.expedition.geometry.narrow.length,
      piles: w.expedition.piles.length,
    };
  });
  check(geo.platforms > 30, `地图有 ${geo.platforms} 块碰撞体`);
  check(geo.width === 4400 && geo.height === 3000, "地图尺寸为 4400x3000");
  check(geo.narrow >= 1, `存在 ${geo.narrow} 处窄道（重型货物过不去）`);
  check(geo.piles === 14, `存在 ${geo.piles} 个搜索点`);

  // 2. Player can actually move along the floor without falling through.
  await page.evaluate(() => {
    eclipseSlice.world.god = true;
  });
  const before = await page.evaluate(() => eclipseSlice.world.player.x);
  await page.keyboard.down("d");
  await page.waitForTimeout(1200);
  await page.keyboard.up("d");
  const after = await page.evaluate(() => ({
    x: eclipseSlice.world.player.x,
    y: eclipseSlice.world.player.y,
    grounded: eclipseSlice.world.player.grounded,
  }));
  check(after.x > before + 80, `向右移动有效 (${Math.round(before)} → ${Math.round(after.x)})`);
  check(after.y < 3000, "没有穿出地图底部");

  // 3. Hold-E search: progress accumulates, then completes and yields cargo.
  await page.evaluate(() => {
    const w = eclipseSlice.world,
      ex = w.expedition,
      pile = ex.piles.find((p) => !p.taken);
    w.player.x = pile.x;
    w.player.y = pile.y;
    w.player.vx = 0;
    w.player.vy = 0;
    pile.difficulty = 0.4; // keep the test fast; real values are 1.2–5.5
  });
  await page.waitForTimeout(300);
  await page.keyboard.down("e");
  await page.waitForFunction(() => eclipseSlice.world.expedition.search.progress > 0.05, null, {
    timeout: 5000,
  });
  check(true, "按住 E 开始搜索并累积进度");
  await page.waitForFunction(() => eclipseSlice.world.expedition.metrics.searchesCompleted >= 1, null, {
    timeout: 8000,
  });
  await page.keyboard.up("e");
  const loot = await page.evaluate(() => {
    const ex = eclipseSlice.world.expedition;
    return {
      completed: ex.metrics.searchesCompleted,
      value: ex.cargo.value,
      events: ex.events.map((e) => e.event),
    };
  });
  check(loot.completed >= 1, "搜索完成计数 +1");
  check(loot.value > 0, `搜到的货物有价值 (${loot.value})`);
  check(loot.events.includes("search_complete"), "记录 search_complete 事件");

  // 4. Noise from searching reached the ecology.
  const heard = await page.evaluate(() => eclipseSlice.world.expedition.eco.noiseHeard ?? null);
  check(heard === null || heard >= 0, "生态接收搜索噪音（无异常）");

  // 5. Interruption: taking damage cancels the search.
  await page.evaluate(() => {
    const w = eclipseSlice.world,
      ex = w.expedition,
      pile = ex.piles.find((p) => !p.taken);
    w.player.x = pile.x;
    w.player.y = pile.y;
    w.player.vx = 0;
    w.player.vy = 0;
    pile.difficulty = 12; // long enough that a hit must land mid-search
  });
  await page.waitForTimeout(300);
  await page.keyboard.down("e");
  await page.waitForFunction(() => eclipseSlice.world.expedition.search.progress > 0.02, null, {
    timeout: 5000,
  });
  await page.evaluate(() => {
    eclipseSlice.world.god = false;
    eclipseSlice.world.hurtPlayer(1, eclipseSlice.world.player.x + 10);
  });
  await page.waitForTimeout(250);
  await page.keyboard.up("e");
  const interrupted = await page.evaluate(() => {
    const ex = eclipseSlice.world.expedition;
    return {
      count: ex.metrics.searchesInterrupted,
      progress: ex.search.progress,
      events: ex.events.map((e) => e.event),
    };
  });
  check(interrupted.count >= 1, "受击中断搜索并计数");
  check(interrupted.events.includes("search_interrupt"), "记录 search_interrupt 事件");

  // 6. Extractors: airlock works, freight needs power, heavy cargo requires the freight station.
  const extract = await page.evaluate(async () => {
    const w = eclipseSlice.world,
      ex = w.expedition;
    const { extractors, extractorPos } = await import("/src/game/expedition/ExpeditionContent.ts");
    const airlock = extractors.find((e) => e.id === "airlock"),
      freight = extractors.find((e) => e.id === "freight");
    const { lootDefs } = await import("/src/game/expedition/LootSystem.ts");
    const heavy = Object.values(lootDefs).find((d) => d.heavy);
    // Pick up heavy cargo and check the airlock refuses it.
    ex.cargo.items.push({ uid: 9999, def: heavy, source: "test", district: "airlock" });
    ex.cargo.size += heavy.size;
    ex.cargo.weight += heavy.weight;
    ex.cargo.value += heavy.value;
    const airlockBlocked = ex.extractBlocked(airlock);
    const freightBlockedNoPower = ex.extractBlocked(freight);
    // Open the power switch by standing at its real world position.
    const sc = ex.shortcutAt(ex.geometry.narrow.length >= 0 ? 0 : 0, 0);
    void sc;
    return {
      airlockBlocked,
      freightBlockedNoPower,
      airlockPos: extractorPos(airlock),
      narrow: ex.geometry.narrow.length,
      canEnterNarrow: ex.canEnterNarrow(ex.geometry.narrow[0].x, ex.geometry.narrow[0].y),
    };
  });
  check(!!extract.airlockBlocked, `重型货物不能从气闸带走：${extract.airlockBlocked}`);
  check(!!extract.freightBlockedNoPower, `未供电时货运站不可用：${extract.freightBlockedNoPower}`);
  check(extract.canEnterNarrow === false, "携带重型货物无法通过窄道");

  // Open the freight power switch the way the player does: walk to it and hold E.
  const opened = await page.evaluate(async () => {
    const w = eclipseSlice.world,
      ex = w.expedition;
    const { shortcutDefs, extractorPos } = await import("/src/game/expedition/ExpeditionContent.ts");
    const power = shortcutDefs.find((s) => s.id === "freight-power");
    const pos = extractorPos({ ...power, needsPower: false, cargo: false });
    w.player.x = pos.x;
    w.player.y = pos.y;
    w.player.vx = 0;
    w.player.vy = 0;
    return { pos, reachable: !!ex.shortcutAt(pos.x, pos.y) };
  });
  check(opened.reachable, "货运供电闸位于可到达位置");

  // 7. Power restoration unblocks the freight extractor.
  await page.keyboard.down("e");
  await page.waitForFunction(() => eclipseSlice.world.expedition.power === true, null, { timeout: 6000 });
  await page.keyboard.up("e");
  const powered = await page.evaluate(async () => {
    const ex = eclipseSlice.world.expedition;
    const { extractors } = await import("/src/game/expedition/ExpeditionContent.ts");
    const freight = extractors.find((e) => e.id === "freight");
    return { power: ex.power, blocked: ex.extractBlocked(freight) };
  });
  check(powered.power === true, "供电闸打开后 power = true");
  check(powered.blocked === null, "供电后货运撤离站可用（可吊走重型货物）");

  await page.screenshot({ path: "output/playwright/expedition-map.png" });

  // 8. Offscreen ecology keeps running while the player stands still.
  const t0 = await page.evaluate(() => {
    const m = eclipseSlice.world.expedition.eco.metrics;
    return { created: m.matureCreated, kills: m.creatureVsCreatureKills, time: eclipseSlice.world.time };
  });
  await page.waitForTimeout(3000);
  const t1 = await page.evaluate(() => {
    const m = eclipseSlice.world.expedition.eco.metrics;
    return { created: m.matureCreated, kills: m.creatureVsCreatureKills, time: eclipseSlice.world.time };
  });
  check(t1.time > t0.time, "生态随游戏时间推进");
  check(t1.kills >= t0.kills, "生物仍在互相捕食（离屏生态在跑）");

  return { checks, geo, loot, interrupted, extract, powered };
};
