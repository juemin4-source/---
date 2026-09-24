async (page) => {
  const box = await page.locator("canvas").boundingBox();
  const aim = async (x, y) =>
    page.mouse.move(
      box.x + (x * box.width) / 1280,
      box.y + (y * box.height) / 720,
    );
  await page.evaluate(() => {
    const s = blackSun,
      w = s.world;
    s.started = true;
    s.paused = false;
    s.debugTools.visible = false;
    s.debugTools.panel.hidden = true;
    w.campaign = true;
    w.enterRoom(1);
    w.god = true;
    const t = w.modules.find((m) => m.kind === "thruster");
    t.detach();
    w.enemies.forEach((e) => w.damageEnemy(e, 99999));
    t.x = 870;
    t.y = 595;
    t.vx = 0;
    t.vy = 0;
    t.angle = -Math.PI / 2;
    w.stabilize(t);
    w.player.x = 870;
    w.player.y = 580;
  });
  await aim(1205, 230);
  await page.waitForTimeout(220);
  await page.keyboard.down("d");
  let top = 720;
  for (let i = 0; i < 22; i++) {
    await page.waitForTimeout(80);
    const p = await page.evaluate(() => ({
      y: blackSun.world.player.y,
      room: blackSun.world.roomIndex,
    }));
    top = Math.min(top, p.y);
    if (p.room === 2) break;
  }
  await page.keyboard.up("d");
  const ascent = await page.evaluate(() => ({
    room: blackSun.world.roomIndex,
    x: blackSun.world.player.x,
    y: blackSun.world.player.y,
  }));
  await page.evaluate(() => {
    const w = blackSun.world;
    w.enterRoom(3);
    w.campaign = false;
    w.god = true;
    w.enemies.forEach((e) => w.damageEnemy(e, 9999));
    const t = w.modules.find((m) => m.kind === "thruster" && !m.dead),
      s = w.modules.find((m) => m.kind === "shield" && !m.dead);
    t.x = 300;
    t.y = 595;
    t.angle = 0;
    s.x = 415;
    s.y = 562;
    w.stabilize(t);
    w.stabilize(s);
    w.spawnEnemy("crawler", 650, 580, "gun");
    w.player.x = 170;
  });
  await aim(650, 570);
  await page.waitForTimeout(550);
  await page.screenshot({ path: "output/playwright/combination.png" });
  await page.waitForTimeout(700);
  const combo = await page.evaluate(() => ({
    rams: blackSun.world.stats.rams,
    shield: blackSun.world.modules
      .filter((m) => m.kind === "shield")
      .map((m) => ({ x: m.x, vx: m.vx })),
    enemyHP: blackSun.world.enemies.filter((e) => !e.dead).map((e) => e.hp),
  }));
  await page.evaluate(() => {
    blackSun.paused = true;
  });
  return {
    ascent: { ...ascent, top, passed: ascent.room === 2 },
    combo: { ...combo, passed: combo.rams > 0 },
  };
}