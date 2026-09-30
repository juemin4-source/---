async (page) => {
  await page.locator('[data-action="start-unlimited"]').click();
  await page.evaluate(async () => {
    const { extractorPos, shortcutDefs } = await import("/src/game/expedition/ExpeditionContent.ts");
    const w = eclipseSlice.world,
      s = shortcutDefs.find((s) => s.id === "freight-power"),
      p = extractorPos(s);
    w.god = true;
    w.player.x = p.x;
    w.player.y = p.y;
    w.player.vx = 0;
    w.player.vy = 0;
    const pile = w.expedition.piles.find((p) => p.source === "聚变燃料柜");
    pile.x = p.x;
    pile.y = p.y;
  });
  await page.waitForTimeout(300);
  await page.keyboard.down("e");
  await page.waitForTimeout(2400);
  const held = await page.evaluate(() => ({
    power: eclipseSlice.world.expedition.power,
    searches: eclipseSlice.world.expedition.metrics.searchesStarted,
  }));
  if (!held.power || held.searches !== 0) throw new Error(JSON.stringify(held));
  await page.keyboard.up("e");
  await page.waitForTimeout(150);
  await page.keyboard.down("e");
  await page.waitForFunction(() => eclipseSlice.world.expedition.metrics.searchesCompleted === 1, null, {
    timeout: 6000,
  });
  await page.keyboard.up("e");
  const searched = await page.evaluate(() => eclipseSlice.world.expedition.metrics.searchesCompleted);
  if (searched !== 1) throw new Error("松开重新按住未能搜索");
  return { held, searched, note: "隔离场景强制重叠箱与开关，使用真实 E 键验证，未改用户存档" };
};
