async (page) => {
  await page.bringToFront();
  const checks = [], check = (v, label) => { if (!v) throw new Error(label); checks.push(label); };
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.locator('[data-action="train"]').click();
  check(await page.locator('.bench-catalog article').count() === 28, '训练台显示全部 28 种模块');
  await page.locator('#grant-stacks').fill('3');
  await page.locator('[data-action="preset"][data-slot="ice"]').click();
  check(await page.evaluate(() => eclipseSlice.world.count('freeze') === 3 && eclipseSlice.world.slots.length === 6), '三层冻结组合已接入六槽');
  await page.locator('[data-action="grant"][data-slot="freeze"]').click();
  check(await page.evaluate(() => eclipseSlice.world.count('freeze') === 6 && eclipseSlice.world.slots.length === 6), '同类追加层数没有占用新槽');
  await page.locator('[data-action="clear-enemies"]').click();
  await page.locator('#bench-kind').selectOption('elite');
  await page.locator('#bench-health').fill('10');
  await page.locator('#bench-count').fill('2');
  await page.locator('#bench-wave').fill('4');
  await page.locator('#bench-organ').selectOption('freeze');
  await page.locator('#bench-auto').uncheck();
  await page.locator('[data-action="spawn-bench"]').click();
  check(await page.evaluate(() => eclipseSlice.world.enemies.length === 2 && eclipseSlice.world.enemies.every(e => e.kind === 'elite' && e.organ === 'freeze' && e.maxHp > 10000)), '指定两只高血量 Boss 和冻结掉落生效');
  await page.screenshot({ path: 'output/playwright/training-bench.png' });
  await page.locator('[data-action="resume"]').click();
  await page.waitForFunction(() => eclipseSlice.world.time > 0.1);
  check(await page.locator('#slice-overlay').count() === 0 || await page.evaluate(() => eclipseSlice.overlay.hidden), '恢复后配装界面收起');
  const box = await page.locator('canvas').boundingBox();
  const aim = async (x,y) => page.mouse.move(box.x + x * box.width/1280, box.y + y * box.height/720);
  for (const [key, id] of [['1','handgun'],['2','rifle'],['3','sniper'],['4','dagger'],['5','hammer']]) {
    await page.keyboard.down(key); await page.waitForTimeout(120); await page.keyboard.up(key); await page.waitForTimeout(200);
    check(await page.evaluate(id => eclipseSlice.world.armory.primary === id, id), `按键 ${key} 切换 ${id}`);
  }
  for (const [key, id] of [['6','shield'],['7','grenade'],['8','drone'],['9','turret']]) {
    await page.keyboard.down(key); await page.waitForTimeout(120); await page.keyboard.up(key); await page.waitForTimeout(200);
    check(await page.evaluate(id => eclipseSlice.world.armory.secondary === id, id), `按键 ${key} 切换 ${id}`);
  }
  // A controlled close-range fixture tests real mouse input and proc feedback.
  await page.evaluate(() => { const w = eclipseSlice.world; w.god = true; w.player.x = 600; w.player.y = 580; w.player.vx = 0; w.platforms = w.platforms.filter(p => p.y >= 610); w.enemies.forEach((e,i) => { e.x=680+i*75; e.stun=100; e.impulseX=0; }); });
  await page.keyboard.press('5'); await aim(720,560);
  await page.mouse.down(); await page.waitForTimeout(1800); await page.mouse.up();
  check(await page.evaluate(() => eclipseSlice.world.metrics.freezes > 0 && eclipseSlice.world.metrics.shatters > 0), '真实鼠标重锤攻击触发冻结与碎冰');
  await page.keyboard.press('8'); await page.keyboard.down('q'); await page.waitForTimeout(100); await page.keyboard.up('q'); await page.waitForTimeout(150);
  check(await page.evaluate(() => eclipseSlice.world.armory.units.some(u => u.type === 'drone')), '真实 Q 部署无人机');
  await page.screenshot({ path: 'output/playwright/training-combat.png' });
  await page.keyboard.press('b'); await page.waitForTimeout(100);
  const t = await page.evaluate(() => eclipseSlice.world.time); await page.waitForTimeout(250);
  check(await page.evaluate(t => eclipseSlice.world.time === t, t), '训练台真正暂停战斗');
  await page.locator('[data-action="clear-enemies"]').click();
  await page.locator('#bench-auto').check(); await page.locator('[data-action="apply-bench"]').click();
  await page.locator('[data-action="resume"]').click(); await page.waitForTimeout(1500);
  check(await page.evaluate(() => eclipseSlice.world.wave === 5 && eclipseSlice.world.enemies.length > 0), '浏览器清场后自动进入下一波');
  // Simulate a minute of physical stress without waiting a minute of wall-clock time.
  const bossState = await page.evaluate(async () => {
    const { idleControls } = await import('/src/Player.ts'); const w = eclipseSlice.world;
    w.trainingAuto = false; const bosses = w.enemies.filter(e => e.kind === 'elite');
    for (let i=0;i<7200;i++) { if(i%120===0) bosses.forEach(e => w.push(e, i%240 ? 1800 : -1800)); w.update(1/120,idleControls()); }
    return bosses.map(e => ({ bottom:e.y+e.h/2,x:e.x,dead:e.dead }));
  });
  check(bossState.length > 0 && bossState.every(e => e.bottom <= 610.1 && e.x > 0 && e.x < 1280), 'Boss 经 60 秒冲锋击退仍留在地图内');
  check(errors.length === 0, '浏览器无未捕获异常');
  await page.keyboard.press('b');
  return { checks, bossState, errors };
}
