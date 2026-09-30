async (page) => {
  await page.locator('[data-action="start-unlimited"]').click();
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    // Position fixture reaches the authored arena; encounter activation is the normal trigger.
    const w = eclipseSlice.world;
    w.player.x = 5720;
    w.player.y = 1360;
    w.player.vx = w.player.vy = 0;
  });
  await page.waitForFunction(() => eclipseSlice.world.rigBoss.phase === "anchored");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "output/playwright/rig-boss-browser/anchored.png" });
  const result = await page.evaluate(() => {
    const w = eclipseSlice.world,
      b = w.rigBoss;
    w.hit(b.anchors[0], 1000, true, 0, true);
    return {
      phase: b.phase,
      hp: b.core.hp,
      anchors: b.anchors.map((a) => ({ x: a.x, y: a.y, dead: a.dead })),
    };
  });
  if (result.phase !== "exposed") throw new Error(JSON.stringify(result));
  await page.waitForTimeout(100);
  await page.screenshot({ path: "output/playwright/rig-boss-browser/exposed.png" });
  return { ...result, note: "真实地图触发与渲染；定位和拆脚伤害为测试夹具，非完整真人击杀。" };
};
