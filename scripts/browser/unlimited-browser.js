async (page) => {
  await page.bringToFront();
  await page.goto("http://127.0.0.1:5173");
  const checks = [],
    check = (v, m) => {
      if (!v) throw new Error(m);
      checks.push(m);
    };
  await page.locator('[data-action="start-unlimited"]').click();
  await page.waitForFunction(() => eclipseSlice.world.time > 0.1);
  check(
    await page.evaluate(() => eclipseSlice.world.unlimited && !!eclipseSlice.world.ascent),
    "独立无限版进入上行地图",
  );
  // Spawn drops as a fixture, collect by actual movement without E or equip actions.
  await page.evaluate(async () => {
    const { organIds } = await import("/src/game/config.ts");
    const w = eclipseSlice.world;
    for (const [i, id] of organIds.entries())
      w.drops.push({ id: 100 + i, x: w.player.x + 100, y: 3096, organ: id });
  });
  await page.keyboard.down("d");
  await page.waitForFunction(() => eclipseSlice.world.slots.length === 28);
  await page.keyboard.up("d");
  await page.waitForTimeout(200);
  check(
    await page.evaluate(() => !eclipseSlice.world.pendingDrop && eclipseSlice.overlay.hidden),
    "28 种自动接入不弹替换窗口",
  );
  check((await page.locator(".unlimited-slots .slice-slot").count()) === 28, "HUD 显示全部 28 种");
  await page.screenshot({ path: "output/playwright/unlimited-collection.png" });
  await page.keyboard.press("b");
  await page.locator(".bench-catalog").waitFor();
  check((await page.locator(".bench-catalog article").count()) === 28, "B 面板能查看全部模块效果");
  await page.screenshot({ path: "output/playwright/unlimited-inventory.png" });
  await page.locator('[data-action="resume"]').click();
  await page.evaluate(() => {
    const w = eclipseSlice.world;
    w.god = true;
    w.player.x = 850;
    w.player.y = 2676;
    w.ascent.nextIncursion = w.time;
  });
  await page.waitForFunction(() => eclipseSlice.world.ascent.reinforcements > 0);
  check(
    await page.evaluate(
      () =>
        eclipseSlice.world.ascent.pressure >= 4 &&
        eclipseSlice.world.enemies.some(
          (e) =>
            eclipseSlice.world.ascent.homes.get(e.id)?.id.startsWith("incursion-") && e.damageFactor > 1.1,
        ),
    ),
    "收集后产生更强增援",
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const t = await page.evaluate(() => eclipseSlice.world.time);
  await page.waitForTimeout(200);
  check(await page.evaluate((t) => eclipseSlice.world.time === t, t), "暂停不会偷偷推进增援");
  await page.goto("http://127.0.0.1:5173");
  await page.locator('[data-action="start-six"]').click();
  await page.evaluate(() => {
    const w = eclipseSlice.world;
    w.grant("ram");
    w.drops.push(
      { id: 222, x: w.player.x + 100, y: w.player.y, organ: "ram", stacks: 3 },
      { id: 223, x: w.player.x + 100, y: w.player.y, organ: "speed" },
    );
  });
  await page.keyboard.down("d");
  await page.waitForFunction(() => eclipseSlice.world.count("ram") === 4);
  await page.keyboard.up("d");
  check(
    await page.evaluate(
      () =>
        !eclipseSlice.world.unlimited &&
        eclipseSlice.world.count("ram") === 4 &&
        !eclipseSlice.world.has("speed") &&
        !eclipseSlice.world.pendingDrop,
    ),
    "六槽版只自动叠同类，新类型留在地上",
  );
  await page.goto("http://127.0.0.1:5173");
  return { checks };
};
