async (page) => {
  const started=Date.now();
  const box=await page.locator('canvas').boundingBox(),trace=[];
  const aim=async(x,y)=>page.mouse.move(box.x+x*box.width/1280,box.y+y*box.height/720);
  const state=()=>page.evaluate(()=>({mode:blackSun.mode,state:blackSun.expedition.state,zone:blackSun.expedition.zoneId,t:blackSun.expedition.seconds,hp:blackSun.world.player.hp,x:blackSun.world.player.x,y:blackSun.world.player.y,cargo:{...blackSun.expedition.cargo},enemies:blackSun.world.enemies.filter(e=>!e.dead).map(e=>({id:e.id,x:e.x,y:e.y,kind:e.kind,hp:e.hp})),loot:blackSun.expedition.state==='field'?blackSun.expedition.area.loot.filter(l=>!l.taken).map(l=>({id:l.id,x:l.x,y:l.y,kind:l.kind})):[]}));
  const walk=async(x,fight=true)=>{
    if(fight)await page.mouse.down();
    for(let i=0;i<70;i++){
      const s=await state();if(s.state!=='field')throw new Error('run ended during movement');
      if(Math.abs(s.x-x)<15){await page.keyboard.up('a');await page.keyboard.up('d');await page.mouse.up();return;}
      const dir=s.x<x?'d':'a';await page.keyboard.up(dir==='d'?'a':'d');await page.keyboard.down(dir);
      const enemy=s.enemies.sort((a,b)=>Math.abs(a.x-s.x)-Math.abs(b.x-s.x))[0];
      if(fight&&enemy)await aim(enemy.x,enemy.y);
      await page.waitForTimeout(110);
    }
    throw new Error('movement blocked');
  };
  const clear=async()=>{await page.mouse.down();for(let i=0;i<100;i++){const s=await state();if(s.state!=='field')throw new Error('combat death');const enemy=s.enemies[0];if(!enemy)break;await aim(enemy.x,enemy.y);await page.waitForTimeout(100);}await page.mouse.up();};
  const search=async(id)=>{const s=await state(),l=s.loot.find(l=>l.id===id);if(!l)return;await clear();await walk(l.x);await page.keyboard.down('w');await page.waitForTimeout(1700);await page.keyboard.up('w');if((await state()).loot.some(item=>item.id===id))throw new Error('search interrupted '+id);trace.push(await state());};
  const gate=async(x,expected)=>{await walk(x);await page.keyboard.press('w',{delay:60});await page.waitForTimeout(150);const s=await state();if(s.zone!==expected)throw new Error('wrong destination '+s.zone+' expected '+expected);trace.push(s);};
  try{
    await page.getByRole('button',{name:/开始第一次出行|再次出发/}).click();
    await page.waitForFunction(()=>document.getElementById('overlay').hidden);
    const firstLayout=await page.evaluate(()=>({enemies:blackSun.expedition.areas.get('concourse').world.enemies.map(e=>e.kind),positions:blackSun.expedition.areas.get('concourse').loot.map(l=>l.x)}));
    await page.waitForTimeout(150);await search('airlock-0');await gate(1200,'concourse');
    await search('concourse-0');await gate(440,'service');await search('service-0');await search('service-1');
    await gate(65,'concourse');await gate(65,'airlock');await walk(175,false);await page.keyboard.down('w');await page.waitForTimeout(1700);await page.keyboard.up('w');
    await page.screenshot({path:'output/playwright/expedition-return.png'});
    const first=await page.evaluate(()=>blackSun.expedition.lastRecord);
    await page.getByRole('button',{name:/生命支撑 升级/}).click();
    await page.getByRole('button',{name:/再次出发/}).click();await page.waitForTimeout(150);
    const second=await page.evaluate(()=>({sortie:blackSun.expedition.profile.sorties,hp:blackSun.world.player.hp,upgrades:blackSun.expedition.profile.upgrades,enemies:blackSun.expedition.areas.get('concourse').world.enemies.map(e=>e.kind),positions:blackSun.expedition.areas.get('concourse').loot.map(l=>l.x)}));
    await page.keyboard.press('Escape');
    return {passed:!!first&&first.outcome==='extracted'&&second.hp===125&&JSON.stringify(firstLayout.enemies)!==JSON.stringify(second.enemies)&&JSON.stringify(firstLayout.positions)!==JSON.stringify(second.positions),wallSeconds:(Date.now()-started)/1000,first,firstLayout,second,trace};
  }catch(error){await page.keyboard.up('a');await page.keyboard.up('d');await page.keyboard.up('w');await page.mouse.up();await page.keyboard.press('Escape');return {error:String(error),state:await state(),trace};}
}
