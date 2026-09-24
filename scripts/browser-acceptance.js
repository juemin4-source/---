async (page) => {
  const results = [];
  await page.bringToFront();
  try {
    const check = (value, label) => {
      if (!value) throw new Error(label);
      results.push(label);
    };
    await page.evaluate(() => {
      const s = window.blackSun;
      s.started = true;
      s.paused = false;
      s.world.enterRoom(0);
      s.world.campaign = false;
      s.world.enemies = [];
      s.world.modules = [];
      s.world.god = true;
    });
    const canvas = await page.locator("canvas").boundingBox();
    const aim = async (x, y) =>
      page.mouse.move(
        canvas.x + (x * canvas.width) / 1280,
        canvas.y + (y * canvas.height) / 720,
      );
    await aim(900, 580);
    await page.keyboard.down("d");
    await page.waitForTimeout(280);
    await page.keyboard.up("d");
    await page.waitForTimeout(250);
    let p = await page.evaluate(() => ({
      x: blackSun.world.player.x,
      vx: blackSun.world.player.vx,
    }));
    check(
      p.x > 155 && Math.abs(p.vx) < 2,
      "keyboard movement and quick braking",
    );
    await page.keyboard.down("Space");
    await page.waitForTimeout(220);
    await page.keyboard.up("Space");
    p = await page.evaluate(() => ({ y: blackSun.world.player.y }));
    check(p.y < 520, "keyboard jump");
    await page.keyboard.press("Shift", { delay: 35 });
    await page.waitForTimeout(30);
    check(
      await page.evaluate(() => blackSun.world.player.dashCooldown > 0),
      "short airborne dash",
    );
    await page.waitForTimeout(650);
    await page.mouse.down();
    await page.waitForTimeout(160);
    await page.mouse.up();
    check(
      await page.evaluate(() =>
        blackSun.world.projectiles.some((p) => p.team === "player"),
      ),
      "mouse continuous shooting",
    );
    await page.evaluate(() => {
      const w = blackSun.world;
      w.player.x = 160;
      w.player.y = 586;
      w.player.vx = 0;
      w.player.vy = 0;
      w.player.externalX = 0;
      w.spawnEnemy("crawler", 260, 586, "gun");
    });
    await aim(240, 544);
    await page.keyboard.press("f", { delay: 65 });
    await page.waitForTimeout(370);
    await page.keyboard.press("f", { delay: 65 });
    await page.waitForTimeout(80);
    check(
      await page.evaluate(() =>
        blackSun.world.modules.some((m) => !m.parent && !m.dead),
      ),
      "two actual F presses detach intact organ",
    );
    let m = await page.evaluate(() => {
      const m = blackSun.world.modules.find((m) => !m.parent);
      return { x: m.x, y: m.y };
    });
    await aim(m.x, m.y);
    await page.mouse.down({ button: "right" });
    await page.waitForTimeout(100);
    await page.mouse.up({ button: "right" });
    check(
      await page.evaluate(() => blackSun.world.stableQueue.length === 1),
      "right mouse phases detached organ",
    );
    await page.keyboard.press("e", { delay: 65 });
    await page.waitForTimeout(50);
    check(
      await page.evaluate(() => blackSun.world.held !== null),
      "E picks up salvaged module",
    );
    const old = await page.evaluate(() => blackSun.world.held.angle);
    await page.keyboard.press("q", { delay: 65 });
    await page.waitForTimeout(50);
    check(
      await page.evaluate((a) => blackSun.world.held.angle !== a, old),
      "Q rotates held organ",
    );
    await aim(450, 520);
    await page.keyboard.press("e", { delay: 65 });
    await page.waitForTimeout(50);
    check(
      await page.evaluate(() => blackSun.world.held === null),
      "E places salvaged module",
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
    const t = await page.evaluate(() => blackSun.world.time);
    await page.waitForTimeout(150);
    check(
      await page.evaluate((t) => blackSun.world.time === t, t),
      "pause freezes simulation",
    );
    await page.keyboard.press("r");
    await page.waitForTimeout(80);
    check(
      await page.evaluate(
        () => !blackSun.world.dead && blackSun.world.player.hp === 100,
      ),
      "R restarts room",
    );
    await page.keyboard.press("F1");
    await page.waitForTimeout(80);
    check(await page.locator("#debug").isVisible(), "F1 debug panel");
    await page.evaluate(() => {
      blackSun.paused = true;
      blackSun.world.campaign = true;
    });
    return { passed: results };
  } catch (error) {
    return {
      error: String(error),
      passed: results,
      state: await page.evaluate(() => {
        blackSun.paused = true;
        return {
          x: blackSun.world.player.x,
          y: blackSun.world.player.y,
          aim: blackSun.world.player.aim,
          keys: Object.fromEntries(
            Object.entries(blackSun.keys).map(([k, v]) => [
              k,
              { down: v.isDown, just: v._justDown },
            ]),
          ),
          modules: blackSun.world.modules.map((m) => ({
            x: m.x,
            y: m.y,
            parent: !!m.parent,
            connection: m.connection,
          })),
          passedTime: blackSun.world.time,
        };
      }),
    };
  }
}