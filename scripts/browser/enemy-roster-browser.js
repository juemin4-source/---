async (page) => {
  await page.locator('[data-action="start-unlimited"]').click();
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => {
    const w = eclipseSlice.world,
      eco = w.expedition.eco;
    const existing = eco.creatures[0],
      before = existing.maxHp;
    // Advance the ecology through real ticks, then inspect births rather than editing final kits.
    for (let i = 0; i < 480; i++) eco.update(1, { player: null, open: new Set() });
    eco.refreshStats(existing);
    const late = eco.creatures.filter((c) => c.bornAt >= 240);
    return {
      count: late.length,
      roles: [...new Set(late.map((c) => c.combatRole))],
      tiers: [...new Set(late.map((c) => c.combatTier))],
      before,
      population: eco.alive.length,
    };
  });
  if (result.count === 0 || !result.roles.includes("miner") || !result.roles.includes("medic"))
    throw new Error(JSON.stringify(result));
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "output/playwright/enemy-roster-browser/expedition.png" });
  return { ...result, note: "加速实际生态 tick 验证后续出生阵容；不代表完整真人平衡验收。" };
};
