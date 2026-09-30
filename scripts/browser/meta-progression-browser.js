async (page) => {
  const checks = [];
  const check = (ok, label) => {
    if (!ok) throw new Error(label);
    checks.push(label);
  };
  await page.bringToFront();
  const walkTo = async (target) => {
    const x = await page.evaluate(
      () => (eclipseSlice.campActive ? eclipseSlice.camp : eclipseSlice.world).player.x,
    );
    if (Math.abs(x - target) < 25) return;
    const key = x < target ? "d" : "a";
    await page.keyboard.down(key);
    await page.waitForFunction(
      ({ target, dir }) => {
        const p = (eclipseSlice.campActive ? eclipseSlice.camp : eclipseSlice.world).player;
        return dir > 0 ? p.x >= target - 20 : p.x <= target + 20;
      },
      { target, dir: x < target ? 1 : -1 },
      { timeout: 15000 },
    );
    await page.keyboard.up(key);
    await page.waitForTimeout(200);
  };
  const stations = { warehouse: 280, training: 690, research: 1100, facilities: 1530, overview: 2040 };
  const openStation = async (id) => {
    if (await page.evaluate(() => eclipseSlice.baseOpen))
      await page.locator('[data-action="base-close"]').click();
    await walkTo(stations[id]);
    await page.keyboard.press("e");
    await page.waitForFunction((id) => eclipseSlice.baseOpen && eclipseSlice.baseTab === id, id);
  };
  await page.locator('[data-action="base-open"]').click();
  await page.waitForFunction(() => eclipseSlice.campActive);
  check(
    await page.evaluate(() => eclipseSlice.camp.width === 3240 && !eclipseSlice.baseOpen),
    "进入独立可走动据点地图",
  );
  const originalTime = await page.evaluate(() => eclipseSlice.world.time);
  await page.keyboard.press("Space");
  await page.waitForTimeout(130);
  check(await page.evaluate(() => eclipseSlice.camp.player.y < 555), "据点复用跳跃操作");
  await page.waitForTimeout(850);
  await page.screenshot({ path: "output/playwright/meta-progression-browser/camp-warehouse.png" });
  await openStation("research");
  check(
    await page.locator('[data-action="meta-research"][data-slot="precision"]').isDisabled(),
    "走到工坊按 E，材料不足不能研究",
  );
  check(
    await page.evaluate((t) => eclipseSlice.world.time === t, originalTime),
    "据点活动不运行探索战斗或生态",
  );
  for (let run = 0; run < 3; run++) {
    await openStation("overview");
    await page.locator('[data-action="start-unlimited"]').click();
    await page.waitForFunction(
      () => !eclipseSlice.campActive && eclipseSlice.world.player.grounded && eclipseSlice.world.time > 0.15,
    );
    const target = await page.evaluate(
      () => eclipseSlice.world.expedition.piles.find((p) => p.source === "气闸储物柜").x,
    );
    await walkTo(target);
    await page.keyboard.down("e");
    await page.waitForFunction(() => eclipseSlice.world.expedition.cargo.items.length > 0, null, {
      timeout: 6000,
    });
    await page.keyboard.up("e");
    await walkTo(221);
    await page.keyboard.down("e");
    await page.waitForFunction(
      () => eclipseSlice.world.result === "extracted" && eclipseSlice.settled,
      null,
      { timeout: 6000 },
    );
    await page.keyboard.up("e");
    check(
      await page.evaluate(
        () => eclipseSlice.lastStored > 0 && eclipseSlice.save.meta.warehouse.sludgeSample > 0,
      ),
      `第 ${run + 1} 趟真实搜索撤离入库`,
    );
    await page.locator('[data-action="base-open"]').click();
    await openStation("warehouse");
    if (run === 0)
      await page.screenshot({ path: "output/playwright/meta-progression-browser/warehouse.png" });
    await page.locator('[data-action="meta-sell"][data-slot="sludgeSample"]').click();
  }
  await openStation("training");
  await page.locator('[data-action="meta-train"][data-slot="health"]').click();
  check(
    await page.evaluate(() => eclipseSlice.save.meta.training.health === 1),
    "在训练区使用真实带回收益训练",
  );
  await page.screenshot({ path: "output/playwright/meta-progression-browser/training.png" });
  await page.reload();
  await page.waitForFunction(() => window.eclipseSlice);
  await page.locator('[data-action="base-open"]').click();
  await openStation("overview");
  check(await page.evaluate(() => eclipseSlice.save.meta.training.health === 1), "刷新后训练进度保留");
  await page.locator('[data-action="meta-primary"][data-slot="dagger"]').click();
  await page.screenshot({ path: "output/playwright/meta-progression-browser/departure.png" });
  await page.locator('[data-action="start-unlimited"]').click();
  check(
    await page.evaluate(
      () =>
        eclipseSlice.world.player.maxHp === 110 &&
        eclipseSlice.world.armory.primary === "dagger" &&
        eclipseSlice.world.slots.length === 0,
    ),
    "从气闸出发：生命110、所选武器、器官重新收集",
  );
  await page.reload();
  await page.waitForFunction(() => window.eclipseSlice);
  await page.locator('[data-action="train-unlimited"]').click();
  check(await page.evaluate(() => eclipseSlice.world.player.maxHp === 100), "训练场不继承永久增益");
  // Separate recipe fixture, in this isolated browser only. No claim of distant route coverage.
  await page.evaluate(() =>
    localStorage.setItem(
      "ever-eclipse-slice-v1",
      JSON.stringify({
        version: 1,
        bank: 500,
        trips: 0,
        research: [],
        active: false,
        meta: {
          campaign: {
            residents: [
              { id: "lin", profession: "mechanic", knowledge: [], studying: null },
              { id: "tang", profession: "engineer", knowledge: [], studying: null },
            ],
          },
          warehouse: { bioPart: 1, maintenanceBook: 1, forgeBlueprint: 1, sensorSpine: 1 },
          training: {},
          unlocked: [],
          facilities: [],
        },
      }),
    ),
  );
  await page.reload();
  await page.waitForFunction(() => window.eclipseSlice);
  await page.locator('[data-action="base-open"]').click();
  await openStation("facilities");
  await page.locator('[data-action="meta-facility"][data-slot="workshop"]').click();
  await page.locator('[data-action="meta-facility"][data-slot="freight"]').click();
  await openStation("research");
  await page.locator('[data-action="meta-research"][data-slot="rapid"]').click();
  await page.locator('[data-action="meta-install"][data-slot="rapid"]').click();
  await page.screenshot({ path: "output/playwright/meta-progression-browser/research.png" });
  check(
    await page.evaluate(
      () => eclipseSlice.save.bank === 325 && eclipseSlice.save.meta.warehouse.forgeBlueprint === 0,
    ),
    "建设研究正确消耗设备、蓝图与金币",
  );
  await page.locator('[data-action="base-close"]').click();
  await walkTo(1600);
  await page.screenshot({ path: "output/playwright/meta-progression-browser/camp-facilities.png" });
  await page.reload();
  await page.waitForFunction(() => window.eclipseSlice);
  await page.locator('[data-action="start-unlimited"]').click();
  check(
    await page.evaluate(
      () =>
        eclipseSlice.world.permanent.attackSpeed === 1.15 &&
        eclipseSlice.world.permanent.weaponDamage === 0.9 &&
        eclipseSlice.world.expedition.cargo.capacity === 8,
    ),
    "研究安装与设施刷新后进入下一局",
  );
  return {
    checks,
    note: "前段真实键盘行走、搜索、撤离、出售、训练；后段配方使用独立材料夹具。用户存档不受影响。",
  };
};
