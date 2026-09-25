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
  await page.evaluate(() => {
    eclipseSlice.world.god = true;
  });
  await page.waitForTimeout(600);

  // 1. Enemies are visible immediately at spawn, in the player's district or a neighbour.
  const seen = await page.evaluate(() => {
    const w = eclipseSlice.world,
      cam = eclipseSlice.cameras.main,
      out = [];
    for (const e of w.enemies) {
      if (e.dead) continue;
      const sx = e.x - cam.scrollX,
        sy = e.y - cam.scrollY;
      out.push({
        id: e.id,
        sx: Math.round(sx),
        sy: Math.round(sy),
        onScreen: sx > -80 && sx < 1360 && sy > -80 && sy < 800,
      });
    }
    return { total: w.enemies.length, list: out, onScreen: out.filter((e) => e.onScreen).length };
  });
  check(seen.total > 0, `出生即可见 ${seen.total} 只怪（不再是空世界）`);
  check(seen.onScreen > 0, `其中 ${seen.onScreen} 只在画面内 :: ${JSON.stringify(seen.list.slice(0, 6))}`);

  // 2. Screenshot so the fix is visually verifiable.
  await page.screenshot({ path: "output/playwright/expedition-spawn-visible.png" });

  // 3. The backdrop art must actually be active on the expedition map (it was gated to the tower).
  const art = await page.evaluate(() => {
    const w = eclipseSlice.world,
      cam = eclipseSlice.cameras.main;
    // Ask the same predicate the backdrop uses.
    return {
      bigMap: w.width >= 2000 && w.height >= 2000,
      tower: w.width === 3000 && w.height === 3300,
      hasTexture: eclipseSlice.textures.exists("sump-depth-v1"),
      worldSize: [w.width, w.height],
      cam: [Math.round(cam.scrollX), Math.round(cam.scrollY)],
    };
  });
  check(art.bigMap && !art.tower, "生态地图走大图背景分支（不再是沉井专属分支）");
  check(art.hasTexture, "沉井背景贴图已加载");
  check(art.cam[0] > 0 || art.cam[1] > 0, `相机跟随中 ${art.cam}`);

  // 4. Prove the map is climbable with the REAL physics: start on the BOTTOM district of a
  //    vertical connector and hold jump until the player reaches the top district's floor.
  const setup = await page.evaluate(async () => {
    const { districts } = await import("/src/game/expedition/ExpeditionMap.ts");
    const w = eclipseSlice.world,
      ex = w.expedition;
    const conn = ex.geometry.connectors.find(
      (c) => !c.sameFloor && c.kind !== "drop" && c.bottomSurface - c.topSurface > 400,
    );
    // The bottom district is the one whose floor sits at the connector's bottom surface.
    const bottom = districts.find((d) => Math.abs(d.floor - 12 - conn.bottomSurface) < 20);
    w.player.x = Math.max(bottom.x + 30, Math.min(conn.x, bottom.x + bottom.w - 30));
    w.player.y = conn.bottomSurface - 40;
    w.player.vx = 0;
    w.player.vy = 0;
    window.__conn = conn;
    window.__connTop = conn.topSurface;
    window.__startY = w.player.y;
    return { conn, bottom: bottom.id, x: Math.round(w.player.x), y: Math.round(w.player.y) };
  });
  await page.waitForTimeout(400);
  // Jump is edge-triggered (c.jump is the press edge, jumpHeld is separate), so climbing means
  // pressing repeatedly — holding the key does not re-jump. This mirrors real play.
  for (let i = 0; i < 60; i++) {
    await page.keyboard.down("Space");
    await page.waitForTimeout(60);
    await page.keyboard.up("Space");
    await page.waitForTimeout(90);
    if (await page.evaluate(() => eclipseSlice.world.player.y <= window.__connTop - 20)) break;
  }
  const climbed = await page.evaluate(() => {
    const w = eclipseSlice.world;
    return {
      startY: Math.round(window.__startY),
      endY: Math.round(w.player.y),
      topSurface: Math.round(window.__connTop),
      rose: Math.round(window.__startY - w.player.y),
      reachedTop: w.player.y <= window.__connTop - 20,
    };
  });
  check(
    climbed.reachedTop,
    `爬上 ${setup.conn.a}↔${setup.conn.b}（${setup.bottom} 起，${climbed.startY} → ${climbed.endY}，地板面 ${climbed.topSurface}，上升 ${climbed.rose}px）`,
  );
  await page.screenshot({ path: "output/playwright/expedition-climb.png" });

  return { checks, seen, art, climbed };
};
