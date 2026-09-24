async(page)=>{
  await page.bringToFront();await page.goto('http://127.0.0.1:5173');
  const checks=[],check=(v,m)=>{if(!v)throw new Error(m);checks.push(m);};
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.locator('[data-action="start-six"]').click();await page.waitForFunction(()=>eclipseSlice.world.time>0.1);
  check(await page.evaluate(()=>eclipseSlice.world.height===3300&&eclipseSlice.cameras.main.scrollY>2000),'进入连续地图，镜头处于底部');
  await page.keyboard.press('r');await page.locator('.build-guide').waitFor();
  check(await page.locator('.build-guide article').count()===4,'显示四套地图推荐 build');
  await page.locator('[data-action="track-build"][data-slot="impact"]').click();
  await page.waitForFunction(()=>eclipseSlice.overlay.hidden);
  check(await page.evaluate(()=>eclipseSlice.world.slots.length===0&&eclipseSlice.world.ascent.trackedBuild==='impact'),'追踪不发放模块');
  await page.screenshot({path:'output/playwright/ascent-tracker.png'});
  // Traversal fixture: invulnerability only, no teleport or movement/physics changes.
  await page.evaluate(()=>{eclipseSlice.world.god=true;});
  const state=()=>page.evaluate(()=>({x:eclipseSlice.world.player.x,y:eclipseSlice.world.player.y,ground:eclipseSlice.world.player.grounded}));
  const walk=async x=>{
    const p=await state(),key=x>p.x?'d':'a';
    if(Math.abs(x-p.x)>8){await page.keyboard.down(key);await page.waitForFunction(({x,dir})=>dir*(eclipseSlice.world.player.x-x)>=-8,{x,dir:x>p.x?1:-1},{timeout:6000});await page.keyboard.up(key);}
    await page.waitForTimeout(130);
  };
  const jump=async(x,top)=>{
    await page.keyboard.down('Space');const p=await state(),dir=x>p.x?1:-1;
    if(Math.abs(x-p.x)>12){await page.keyboard.down(dir>0?'d':'a');await page.waitForFunction(({x,dir})=>dir*(eclipseSlice.world.player.x-x)>=-8,{x,dir},{timeout:2500});await page.keyboard.up(dir>0?'d':'a');}
    try { await page.waitForFunction(top=>eclipseSlice.world.player.grounded&&Math.abs(eclipseSlice.world.player.y+24-top)<3,top,{timeout:3500}); } catch(e) { await page.keyboard.up("Space"); await page.keyboard.up("a"); await page.keyboard.up("d"); throw new Error(`jump to ${x},${top}: ${JSON.stringify(await state())}`); }
    await page.keyboard.up('Space');await page.waitForTimeout(70);
  };
  const flights=await page.evaluate(async()=>(await import('/src/slice/AscentMap.ts')).flights);
  await walk(flights[0].left[0]);
  for(const f of flights){
    if(f.bottom===2280){await walk(940);await jump(f.left[0],f.bottom-84);}
    else await walk(f.left[0]);
    for(let i=f.bottom===2280?1:0;i<4;i++)await jump(f.left[i],f.bottom-84*(i+1));
    await jump(Math.min(1220,f.left[3]),f.bottom-420);
  }
  check((await state()).y<600,'真实基础跳跃沿西侧从气闸登顶');
  await page.screenshot({path:'output/playwright/ascent-crown.png'});
  await page.keyboard.press('Tab');await page.locator('.ascent-map').waitFor();await page.screenshot({path:'output/playwright/ascent-map.png'});
  const t=await page.evaluate(()=>eclipseSlice.world.time);await page.waitForTimeout(150);check(await page.evaluate(t=>eclipseSlice.world.time===t,t),'地图暂停战斗');
  await page.locator('[data-action="recommend"]').click();await page.screenshot({path:'output/playwright/ascent-builds.png'});
  check(errors.length===0,'浏览器无未捕获异常');
  return {checks,position:await state(),errors};
}
