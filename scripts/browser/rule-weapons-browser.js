async (page) => {
  const checks = [];
  const check = (ok, n) => {
    if (!ok) throw new Error(n);
    checks.push(n);
  };
  await page.locator('[data-action="train-unlimited"]').click();
  check((await page.locator("#bench-primary option").count()) === 11, "配装台显示十一种主武器");
  check((await page.locator('[data-action="grant"]').count()) === 42, "配装台显示四十二种器官");
  await page.evaluate(() => {
    const w = eclipseSlice.world;
    w.trainingAuto = false;
    w.enemies = [];
    w.god = true;
  });
  const weapon = async (id) => {
    if (!(await page.evaluate(() => eclipseSlice.benchOpen))) await page.keyboard.press("b");
    await page.locator("#bench-primary").selectOption(id);
    await page.locator("#bench-auto").uncheck();
    await page.locator('[data-action="apply-bench"]').click();
    await page.locator('[data-action="resume"]').click();
    await page.waitForFunction(() => eclipseSlice.world.player.fireCooldown <= 0);
    await page.waitForTimeout(100);
  };
  await weapon("recoil");
  await page.waitForFunction(() => eclipseSlice.world.player.grounded);
  const down = await page.evaluate(() => {
    const s = eclipseSlice,
      p = s.world.player,
      c = s.cameras.main,
      canvas = s.game.canvas,
      r = canvas.getBoundingClientRect();
    return {
      x: r.left + ((p.x - c.scrollX) * r.width) / c.width,
      y: r.top + ((p.y - c.scrollY + 90) * r.height) / c.height,
    };
  });
  await page.mouse.move(down.x, down.y);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
  check(
    await page.evaluate(() => eclipseSlice.world.metrics.shots >= 7 && eclipseSlice.world.player.grounded),
    "逆冲霰炮地面下射产生散射但不强制起飞",
  );
  await weapon("nail");
  await page.mouse.move(950, 650);
  await page.mouse.down();
  await page.waitForTimeout(550);
  await page.mouse.up();
  await page.mouse.move(400, 650);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  check(
    await page.evaluate(
      () => eclipseSlice.world.rules.anchors.length >= 2 && eclipseSlice.world.rules.lines.length > 0,
    ),
    "磁钉实际命中地形形成连线",
  );
  await page.screenshot({ path: "output/playwright/rule-weapons-browser/nail.png" });
  await weapon("harpoon");
  await page.evaluate(async () => {
    const { Carrier } = await import("/src/game/SliceWorld.ts");
    const w = eclipseSlice.world;
    const e = new Carrier("elite", w.player.x + 200, 600, "armor", 1);
    e.y = w.player.y;
    e.hp = e.maxHp = 900;
    w.enemies = [e];
  });
  const aim = await page.evaluate(() => {
    const w = eclipseSlice.world,
      e = w.enemies[0],
      c = eclipseSlice.cameras.main;
    return { x: e.x - c.scrollX, y: e.y - c.scrollY };
  });
  await page.mouse.move(aim.x, aim.y);
  await page.mouse.down();
  await page.waitForFunction(() => eclipseSlice.world.rules.tether !== null, null, { timeout: 3000 });
  await page.mouse.up();
  checks.push("捕鲸索命中重型敌人建立牵引");
  await weapon("blade");
  await page.evaluate(() => {
    eclipseSlice.world.enemies = [];
  });
  await page.evaluate(() => {
    const w = eclipseSlice.world;
    w.rules.tether = null;
    w.player.externalX = 0;
  });
  const up = await page.evaluate(() => {
    const s = eclipseSlice,
      p = s.world.player,
      c = s.cameras.main,
      r = s.game.canvas.getBoundingClientRect();
    return {
      x: r.left + ((p.x - c.scrollX) * r.width) / c.width,
      y: r.top + ((p.y - c.scrollY - 220) * r.height) / c.height,
    };
  });
  await page.mouse.move(up.x, up.y);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
  await page.waitForFunction(() => (eclipseSlice.world.rules.events.counts.ProjectileReturn ?? 0) > 0, null, {
    timeout: 2000,
  });
  checks.push("回航刃实际飞行后转入回程");
  await weapon("gravity");
  await page.mouse.move(950, 450);
  await page.mouse.down();
  await page.waitForTimeout(550);
  check(await page.evaluate(() => eclipseSlice.world.rules.bubble?.radius > 40), "按住膨胀重力泡");
  await page.screenshot({ path: "output/playwright/rule-weapons-browser/gravity.png" });
  await page.mouse.up();
  await page.waitForTimeout(150);
  check(await page.evaluate(() => eclipseSlice.world.rules.bubble === null), "松开坍缩清理重力泡");
  await weapon("rift");
  await page.mouse.move(850, 350);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  check(
    await page.evaluate(() => eclipseSlice.world.rules.lines.some((l) => l.rift)),
    "裂隙刀留下实际持续裂痕",
  );
  await page.keyboard.press("x");
  await page.waitForTimeout(80);
  check(await page.evaluate(() => eclipseSlice.world.armory.primary === "handgun"), "X 从裂隙刀循环回手炮");
  await page.keyboard.press("z");
  await page.waitForTimeout(80);
  check(await page.evaluate(() => eclipseSlice.world.armory.primary === "rift"), "Z 反向切回裂隙刀");
  await page.keyboard.press("b");
  await page.locator('[data-action="preset"][data-slot="recoilReturn"]').click();
  check(
    await page.evaluate(
      () =>
        eclipseSlice.world.has("returnMembrane") &&
        eclipseSlice.world.has("mirrorEye") &&
        eclipseSlice.world.has("split"),
    ),
    "新预设实际接入规则模块",
  );
  await page.screenshot({ path: "output/playwright/rule-weapons-browser/bench.png" });
  return { checks, note: "真实键鼠使用六种武器；重敌为隔离夹具，未验证探索经济或最终平衡。" };
};
