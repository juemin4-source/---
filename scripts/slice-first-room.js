async (page) => {
  const check = (v, label) => { if (!v) throw new Error(label); console.log("PASS " + label); };
  const read = () => page.evaluate(() => {
    const s = window.eclipseSlice, w = s.world;
    return { zone: w.zoneId, x: w.player.x, y: w.player.y, hp: w.player.hp, result: w.result, paused: s.paused, slots: w.slots, drops: w.drops, enemies: w.enemies.filter(e => !e.dead).map(e => ({ x: e.x, y: e.y })), time: w.time };
  });
  const box = await page.locator("canvas").boundingBox();
  const aim = (x, y) => page.mouse.move(box.x + x * box.width / 1280, box.y + y * box.height / 720);
  await aim(700, 580);
  await page.keyboard.down("d"); await page.waitForTimeout(850); await page.keyboard.up("d");
  check((await read()).x > 400, "real keyboard movement");
  await page.keyboard.press("e"); await page.waitForTimeout(150);
  check((await read()).zone === "west", "walk through west doorway");
  await page.keyboard.down("Space"); await page.waitForTimeout(190); await page.keyboard.up("Space");
  check((await read()).y < 560, "real keyboard jump");
  await page.waitForTimeout(500);
  for (let i = 0; i < 80; i++) {
    const s = await read(); if (!s.enemies.length || s.result) break;
    const target = s.enemies.sort((a,b)=>Math.abs(a.x-s.x)-Math.abs(b.x-s.x))[0];
    await aim(target.x, target.y); await page.mouse.down();
    if (s.hp < 55) await page.keyboard.press("h");
    await page.waitForTimeout(180);
  }
  await page.mouse.up();
  const s = await read(); console.log(JSON.stringify(s));
  check(s.drops.length > 0 && !s.result, "combat kills create deterministic organ drops");
  const d = s.drops[0];
  for (let i = 0; i < 30; i++) {
    const p = await read(); if (Math.abs(p.x - d.x) < 60) break;
    const k = p.x < d.x ? "d" : "a"; await page.keyboard.down(k); await page.waitForTimeout(100); await page.keyboard.up(k);
  }
  await page.keyboard.press("e");
  await page.getByRole("button", { name: /接入第 1 槽/ }).waitFor({ timeout: 3000 });
  const before = (await read()).time; await page.waitForTimeout(350); check((await read()).time === before, "organ choice pauses world");
  await page.screenshot({ path: "output/playwright/slice-organ-choice.png" });
  await page.getByRole("button", { name: /接入第 1 槽/ }).click();
  check((await read()).slots.length === 1, "organ equipped through UI");
  await page.keyboard.press("Tab");
  await page.getByRole("heading", { name: "决定下一步。" }).waitFor();
  await page.screenshot({ path: "output/playwright/slice-map.png" });
  await page.keyboard.press("Tab");
  await page.screenshot({ path: "output/playwright/slice-field.png" });
  await page.keyboard.press("Escape");
}
