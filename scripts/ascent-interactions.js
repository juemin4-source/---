async(page)=>{
  await page.bringToFront();await page.goto('http://127.0.0.1:5173');
  const backup=await page.evaluate(()=>localStorage.getItem('ever-eclipse-slice-v1'));
  const checks=[],check=(v,m)=>{if(!v)throw new Error(m);checks.push(m);};
  try{
    await page.locator('[data-action="start-six"]').click();
    // Controlled fixtures isolate camera aiming, interaction and the return route.
    await page.evaluate(()=>{const w=eclipseSlice.world;w.god=true;w.player.x=850;w.player.y=2676;w.enemies.forEach(e=>e.stun=100);});
    await page.waitForTimeout(700);
    const target=await page.evaluate(()=>{const w=eclipseSlice.world,e=w.enemies[0],c=eclipseSlice.cameras.main;return{x:e.x-c.scrollX,y:e.y-c.scrollY};});
    const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+target.x*box.width/1280,box.y+target.y*box.height/720);
    await page.mouse.down();await page.waitForTimeout(1100);await page.mouse.up();await page.waitForFunction(()=>eclipseSlice.world.enemies[0].dead);
    check(await page.evaluate(()=>eclipseSlice.world.enemies[0].dead),'滚动镜头下鼠标瞄准真实击杀高处敌人');
    check(await page.evaluate(()=>eclipseSlice.world.drops[0].y===2676),'掉落保留在泵房平台高度');
    await page.evaluate(()=>{const w=eclipseSlice.world,d=w.drops[0];w.player.x=d.x;w.player.y=d.y;});
    await page.keyboard.press('e');await page.locator('[data-action="equip"]').first().click();
    check(await page.evaluate(()=>eclipseSlice.world.has('ram')),'E 接入掉落');
    await page.evaluate(()=>{const p=eclipseSlice.world.player;p.x=460;p.y=2566;p.vx=0;p.vy=0;});await page.waitForTimeout(150);
    await page.keyboard.press('e');await page.locator('[data-action="equip"]').first().click();
    check(await page.evaluate(()=>eclipseSlice.world.has('knock')&&eclipseSlice.world.ascent.opened.has('pump-cache')),'高台宝箱产出指定模块');
    await page.keyboard.press('r');await page.locator('.build-guide').waitFor();
    check((await page.locator('.build-guide article').first().innerText()).includes('已装 2 / 6'),'推荐按已有模块排序并更新进度');
    await page.locator('[data-action="track-build"][data-slot="impact"]').click();
    await page.evaluate(()=>{const p=eclipseSlice.world.player;p.x=1540;p.y=1836;p.vx=0;p.vy=0;});await page.waitForTimeout(100);
    await page.keyboard.press('e');await page.waitForTimeout(150);
    check(await page.evaluate(()=>eclipseSlice.world.ascent.lifts[0].unlocked),'E 接通下井升降台');
    await page.evaluate(()=>{eclipseSlice.world.player.x=1480;});await page.keyboard.press('e');
    await page.waitForFunction(()=>eclipseSlice.world.player.y>3000,null,{timeout:8000});
    await page.waitForTimeout(300);
    await page.keyboard.down('a');await page.waitForFunction(()=>eclipseSlice.world.player.x<920);await page.keyboard.up('a');await page.waitForTimeout(150);
    check(await page.evaluate(()=>eclipseSlice.world.nearby()?.type==='exit'),'升降台下行后走回独立撤离点');
    await page.keyboard.down('e');await page.waitForFunction(()=>eclipseSlice.world.result==='extracted',null,{timeout:5000});await page.keyboard.up('e');
    check(await page.evaluate(()=>eclipseSlice.world.result==='extracted'&&eclipseSlice.lastReward>=35),'按住 E 成功带回宝箱和击杀收益');
    await page.screenshot({path:'output/playwright/ascent-extraction.png'});
    return{checks};
  }finally{await page.keyboard.up('a');await page.keyboard.up('e');await page.mouse.up();await page.evaluate(backup=>{if(backup===null)localStorage.removeItem('ever-eclipse-slice-v1');else localStorage.setItem('ever-eclipse-slice-v1',backup);},backup);}
}
