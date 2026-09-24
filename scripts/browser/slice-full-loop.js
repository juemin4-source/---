async (page) => {
  // Drives only normal keyboard/mouse actions. Game state is read for assertions/navigation.
  await page.goto("http://127.0.0.1:5173");
  await page.bringToFront();
  await page.getByRole("button", { name: /进入猎场|开始下一次出行/ }).click();
  if (!(await page.locator("#overlay").isHidden())) throw new Error("start overlay blocks gameplay");
  const box = await page.locator("canvas").boundingBox();
  const read = () =>
    page.evaluate(() => {
      const s = window.eclipseSlice,
        w = s.world;
      return {
        zone: w.zoneId,
        x: w.player.x,
        y: w.player.y,
        hp: w.player.hp,
        result: w.result,
        slots: w.slots,
        cargo: w.cargo,
        pending: w.pendingDrop?.organ,
        nearby: w.nearby(),
        drops: w.drops,
        metrics: w.metrics,
        enemies: w.enemies.filter((e) => !e.dead).map((e) => ({ x: e.x, y: e.y, hp: e.hp })),
        walls: w.platforms.filter((p) => !p.oneWay && p.h < 100),
        portals: w.zone.portals,
        searched: w.areas[w.zoneId].searched,
        chest: w.zone.chest,
      };
    });
  const aim = (x, y) => page.mouse.move(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);
  const move = async (dir) => {
    await page.keyboard.up(dir > 0 ? "a" : "d");
    if (dir) await page.keyboard.down(dir > 0 ? "d" : "a");
    else await page.keyboard.up("a");
  };
  const equip = async () => {
    const s = await read();
    if (!s.pending) return;
    if (s.slots.includes(s.pending)) await page.getByRole("button", { name: /暂时留下/ }).click();
    else if (s.slots.length < 6) await page.getByRole("button", { name: /接入第/ }).click();
    else {
      const priorities = [
        "glass",
        "speed",
        "knock",
        "leech",
        "ram",
        "battery",
        "discharge",
        "mark",
        "conduit",
        "spread",
      ];
      const old = priorities.find((id) => s.slots.includes(id));
      await page.locator(`button[data-action="equip"][data-slot="${s.slots.indexOf(old)}"]`).click();
    }
    if (!(await page.locator("#overlay").isHidden()))
      throw new Error("organ overlay blocks gameplay after equip");
  };
  const walk = async (x) => {
    let prev = -999;
    for (let i = 0; i < 100; i++) {
      const s = await read();
      if (s.result) throw new Error("Run ended while walking: " + s.result);
      if (Math.abs(s.x - x) < 42) break;
      await move(Math.sign(x - s.x));
      if (
        Math.abs(s.x - prev) < 4 ||
        s.walls.some((w) => Math.abs(w.x - s.x) < 90 && (w.x - s.x) * (x - s.x) > 0)
      )
        await page.keyboard.down("Space");
      else await page.keyboard.up("Space");
      prev = s.x;
      await page.waitForTimeout(110);
    }
    await move(0);
    await page.keyboard.up("Space");
    await page.waitForTimeout(180);
    if (Math.abs((await read()).x - x) > 78)
      throw new Error("Unreachable walk target " + x + " " + JSON.stringify(await read()));
  };
  const fight = async () => {
    for (let i = 0; i < 260; i++) {
      const s = await read();
      if (s.result) throw new Error("Run ended in fight: " + JSON.stringify(s));
      if (!s.enemies.length) break;
      if (s.hp < 58) await page.keyboard.press("h");
      if (s.nearby?.type === "drop" && !s.slots.includes(s.nearby.drop.organ)) {
        await move(0);
        await page.mouse.up();
        await page.keyboard.press("e");
        await page.waitForTimeout(60);
        await equip();
        continue;
      }
      const e = s.enemies.sort(
        (a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y),
      )[0];
      await aim(e.x, e.y);
      await page.mouse.down();
      const wall = s.walls.some((w) => w.x > Math.min(s.x, e.x) && w.x < Math.max(s.x, e.x));
      await move(Math.abs(e.x - s.x) > 250 || wall ? Math.sign(e.x - s.x) : 0);
      if (i % 10 === 0 && (wall || Math.abs(e.x - s.x) < 130)) {
        await page.keyboard.up("Space");
        await page.keyboard.down("Space");
      }
      if (i % 10 === 4) await page.keyboard.up("Space");
      if (i % 25 === 0 && Math.abs(e.x - s.x) < 350) await page.keyboard.press("q");
      if (i % 18 === 0 && s.slots.includes("ram") && Math.abs(e.x - s.x) < 160) {
        await move(Math.sign(e.x - s.x));
        await page.keyboard.press("Shift");
      }
      await page.waitForTimeout(130);
    }
    await page.mouse.up();
    await move(0);
    await page.keyboard.up("Space");
    if ((await read()).enemies.length) throw new Error("fight timed out " + JSON.stringify(await read()));
    const done = new Set();
    for (let i = 0; i < 12; i++) {
      const s = await read(),
        d = s.drops.find((d) => !s.slots.includes(d.organ) && !done.has(d.organ));
      if (!d) break;
      done.add(d.organ);
      const target = [d.x, d.x + 65, d.x - 65, d.x + 78, d.x - 78].find(
        (x) =>
          x > 25 &&
          x < 1255 &&
          !s.portals.some((p) => Math.abs(p.x - x) < 55) &&
          !(s.chest && !s.searched && Math.abs(s.chest.x - x) < 50),
      );
      await walk(target ?? d.x);
      const ready = await read();
      if (ready.nearby?.type !== "drop") continue;
      await page.keyboard.press("e");
      await page.waitForTimeout(80);
      if ((await read()).pending) await equip();
    }
    const s = await read();
    if (s.chest && !s.searched) {
      await walk(s.chest.x);
      await page.keyboard.press("e");
      await page.waitForTimeout(80);
      if ((await read()).pending) await equip();
    }
    return await read();
  };
  const travel = async (x, to) => {
    await walk(x);
    await page.keyboard.press("e");
    await page.waitForTimeout(180);
    if ((await read()).zone !== to)
      throw new Error("travel failed to " + to + " " + JSON.stringify(await read()));
  };
  const report = [];
  await travel(475, "west");
  report.push(await fight());
  await travel(1190, "forge");
  report.push(await fight());
  await travel(1190, "junction");
  report.push(await fight());
  await travel(330, "choir");
  report.push(await fight());
  await travel(75, "east");
  report.push(await fight());
  await page.screenshot({ path: "output/playwright/slice-six-slots.png" });
  await travel(75, "hub");
  await walk(180);
  await page.keyboard.down("e");
  await page.waitForTimeout(2300);
  await page.keyboard.up("e");
  await page.getByRole("heading", { name: "带回来了。" }).waitFor({ timeout: 3000 });
  await page.screenshot({ path: "output/playwright/slice-result.png" });
  const result = await page.evaluate(() => ({
    result: eclipseSlice.world.result,
    save: eclipseSlice.save,
    metrics: eclipseSlice.world.metrics,
    log: eclipseSlice.world.log,
  }));
  return {
    areas: report.map((s) => ({ zone: s.zone, hp: s.hp, cargo: s.cargo, slots: s.slots })),
    ...result,
  };
};
