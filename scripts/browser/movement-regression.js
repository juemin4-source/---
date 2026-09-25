async (page) => {
  const results = [];
  for (const mode of ["start-six", "start-unlimited", "train-unlimited"]) {
    await page.goto("http://127.0.0.1:5173");
    await page.waitForFunction(() => window.eclipseSlice);
    await page.locator(`[data-action="${mode}"]`).first().click();
    if (mode.startsWith("train")) await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    const snap = () =>
      page.evaluate(() => {
        const s = window.eclipseSlice,
          w = s.world,
          p = w.player;
        return {
          x: p.x,
          y: p.y,
          vx: p.vx,
          time: w.time,
          paused: s.paused,
          bench: s.benchOpen,
          scale: s.timeScale,
          acc: s.accumulator,
          down: s.keys.D.isDown,
          result: w.result,
          pending: !!w.pendingDrop,
        };
      });
    const before = await snap();
    await page.keyboard.down("d");
    await page.waitForTimeout(600);
    const after = await snap();
    await page.keyboard.up("d");
    if (after.x - before.x < 100) throw new Error(`${mode}: movement blocked (${before.x} -> ${after.x})`);
    results.push({ mode, before, after });
  }
  return results;
};
