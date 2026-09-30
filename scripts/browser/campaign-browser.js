async (page) => {
  const checks = [];
  const check = (ok, name) => {
    if (!ok) throw new Error(name);
    checks.push(name);
  };
  const walk = async (target, camp = false) => {
    const x = await page.evaluate((c) => (c ? eclipseSlice.camp : eclipseSlice.world).player.x, camp);
    const key = x < target ? "d" : "a";
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(
        ({ target, camp, right }) => {
          const p = (camp ? eclipseSlice.camp : eclipseSlice.world).player;
          return right ? p.x > target - 16 : p.x < target + 16;
        },
        { target, camp, right: x < target },
        { timeout: 12000 },
      );
    } finally {
      await page.keyboard.up(key);
    }
    await page.waitForTimeout(150);
  };
  await page.locator('[data-action="start-unlimited"]').click();
  await page.waitForFunction(() => eclipseSlice.world.player.grounded);
  // Route regression only: invulnerability isolates navigation from balance.
  await page.evaluate(() => {
    eclipseSlice.world.god = true;
  });
  await walk(1100);
  await page.keyboard.down("d");
  await page.keyboard.press("Space");
  await page.waitForTimeout(550);
  await page.keyboard.up("d");
  await walk(1420);
  await page.keyboard.press("e");
  await page.waitForTimeout(150);
  check(
    await page.evaluate(
      () => eclipseSlice.world.expedition.objectives.rescue.find((r) => r.id === "lin").following,
    ),
    "真实行走跨越工作台并救援林叔",
  );
  await page.screenshot({ path: "output/playwright/campaign-browser/rescue.png" });
  await walk(1320);
  await page.keyboard.down("a");
  await page.keyboard.press("Space");
  await page.waitForTimeout(600);
  await page.keyboard.up("a");
  await walk(221);
  await page.waitForTimeout(2000);
  await page.keyboard.down("e");
  await page.waitForFunction(() => eclipseSlice.world.result === "extracted" && eclipseSlice.settled, null, {
    timeout: 8000,
  });
  await page.keyboard.up("e");
  check(
    await page.evaluate(() => eclipseSlice.save.meta.campaign.residents.some((r) => r.id === "lin")),
    "护送人员抵达撤离点后永久入驻",
  );
  await page.reload();
  await page.waitForFunction(() => window.eclipseSlice);
  check(
    await page.evaluate(() => eclipseSlice.save.meta.campaign.residents.some((r) => r.id === "lin")),
    "人员入驻刷新后保留",
  );
  // Isolated recipe inventory, not a claim that distant loot was physically collected.
  await page.evaluate(() => {
    const s = eclipseSlice.save;
    s.bank = 1000;
    s.meta.warehouse = {
      bioPart: 8,
      maintenanceBook: 3,
      batteryCell: 3,
      pythonBook: 1,
      neuralSample: 1,
      "sample-speed": 1,
      machineTool: 1,
    };
    eclipseSlice.persist();
  });
  await page.locator('[data-action="base-open"]').click();
  const station = async (id, x) => {
    if (await page.evaluate(() => eclipseSlice.baseOpen))
      await page.locator('[data-action="base-close"]').click();
    await walk(x, true);
    await page.keyboard.press("e");
    await page.waitForFunction((id) => eclipseSlice.baseOpen && eclipseSlice.baseTab === id, id);
  };
  const click = async (a, id) => page.locator(`[data-action="meta-${a}"][data-slot="${id}"]`).click();
  await station("facilities", 1530);
  await click("construct", "academy");
  await click("construct", "refinery");
  await station("commerce", 2880);
  await click("refine", "batteryCell");
  check(
    await page.evaluate(() => eclipseSlice.save.meta.warehouse.lithium === 2),
    "走到商店提炼真实消耗一枚电池",
  );
  await station("research", 1100);
  await click("manufacture", "rifle");
  check(
    await page.evaluate(() => eclipseSlice.save.meta.campaign.ownedWeapons.includes("rifle")),
    "机械师与材料制造步枪",
  );
  await station("residents", 2460);
  await click("learn", "lin:computing");
  check(
    await page.evaluate(
      () =>
        eclipseSlice.save.meta.campaign.residents[0].studying === "computing" &&
        eclipseSlice.save.meta.warehouse.pythonBook === 0,
    ),
    "课程实际消耗书籍并进入学习状态",
  );
  await page.screenshot({ path: "output/playwright/campaign-browser/residents.png" });
  await station("overview", 2040);
  await click("primary", "rifle");
  await click("hero", "rabbit");
  await click("partner", "qiao");
  await page.locator('[data-action="start-unlimited"]').click();
  await page.keyboard.press("g");
  await page.keyboard.press("t");
  await page.waitForTimeout(150);
  check(
    await page.evaluate(
      () =>
        eclipseSlice.world.skills.burning &&
        eclipseSlice.world.skills.haste > 0 &&
        eclipseSlice.world.armory.primary === "rifle",
    ),
    "下趟使用制造的步枪及G角色技能/T支援",
  );
  await page.keyboard.press("p");
  await page.waitForTimeout(150);
  check(await page.evaluate(() => eclipseSlice.world.expedition.objectives.packing), "P切换器官封装模式");
  await page.evaluate(() => {
    const w = eclipseSlice.world;
    w.drops.push({ id: 990, x: w.player.x, y: w.player.y, organ: "speed", stacks: 2 });
  });
  await page.keyboard.press("e");
  await page.waitForTimeout(150);
  check(
    await page.evaluate(
      () =>
        eclipseSlice.world.expedition.cargo.items.some((i) => i.def.id === "sample-speed") &&
        eclipseSlice.world.count("speed") === 0,
    ),
    "E封装器官入货物，不同时吸收",
  );
  return {
    checks,
    note: "救援路线使用无敌隔离战斗数值；制造学习使用独立材料夹具。没有伪造救援/撤离/学习结果；不代表完整平衡验收。",
  };
};
