async (page) => {
  await page.locator('[data-action="start-unlimited"]').click();
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => {
    const w = eclipseSlice.world;
    w.player.x = 3750;
    w.player.y = 1498;
    w.player.vx = w.player.vy = 0;
    return JSON.stringify(w.platforms);
  });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "output/playwright/pump-art-browser/bridge.png" });
  await page.keyboard.down("d");
  await page.keyboard.press("Space");
  await page.waitForTimeout(350);
  await page.keyboard.up("d");
  await page.screenshot({ path: "output/playwright/pump-art-browser/jump.png" });
  const result = await page.evaluate(() => {
    const w = eclipseSlice.world;
    return { x: w.player.x, y: w.player.y, finite: Number.isFinite(w.player.y), geometry: JSON.stringify(w.platforms) };
  });
  if (!result.finite || result.geometry !== before) throw new Error("Art altered geometry or invalid player state");
  await page.evaluate(() => {
    const p = eclipseSlice.world.player;
    p.x = 4390; p.y = 1654; p.vx = p.vy = 0;
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "output/playwright/pump-art-browser/east.png" });
  return { geometryUnchanged: true, moved: result.x > 3750, finite: result.finite,
    note: "定位夹具进入泵厅；真实键盘移动跳跃，截图检查背景与碰撞。" };
};
