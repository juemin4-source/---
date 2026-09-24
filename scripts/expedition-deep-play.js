async(page)=>{
  const started=Date.now(),runs=[],errors=[],box=await page.locator('canvas').boundingBox();
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const aim=(x,y)=>page.mouse.move(box.x+x*box.width/1280,box.y+y*box.height/720);
  // Every page.evaluate below is read-only. All game actions use mouse/keyboard or visible buttons.
  const state=()=>page.evaluate(()=>{
    const e=blackSun.expedition,w=blackSun.world;
    return {mode:blackSun.mode,state:e.state,zone:e.zoneId,t:e.seconds,x:w.player.x,y:w.player.y,hp:w.player.hp,activity:e.activity,held:w.held?.id,cargo:{...e.cargo},stats:{...e.totals},debugUsed:e.debugUsed,god:w.god,sorties:e.profile.sorties,lastRecord:e.lastRecord,enemies:w.enemies.filter(x=>!x.dead).map(x=>({id:x.id,x:x.x,y:x.y,hp:x.hp,kind:x.kind})),modules:w.modules.filter(x=>!x.dead).map(x=>({id:x.id,x:x.x,y:x.y,kind:x.kind,parentId:x.parent?.id,stable:x.stable})),loot:e.state==='field'?e.area.loot.filter(x=>!x.taken).map(x=>({id:x.id,x:x.x,y:x.y,kind:x.kind})):[]};
  });
  const release=async()=>{await page.keyboard.up('a');await page.keyboard.up('d');await page.keyboard.up('w');await page.keyboard.up('Space');await page.mouse.up();await page.mouse.up({button:'right'});};
  const walk=async(x,fight=true)=>{
    let lastMelee=0,lastJump=0;
    for(let i=0;i<90;i++){
      const s=await state();if(s.state!=='field')throw new Error('death during movement');
      if(Math.abs(s.x-x)<15){await release();return;}
      const dir=s.x<x?'d':'a';await page.keyboard.up(dir==='d'?'a':'d');await page.keyboard.down(dir);
      const enemy=s.enemies.sort((a,b)=>Math.abs(a.x-s.x)-Math.abs(b.x-s.x))[0];
      if(fight&&enemy){
        await aim(enemy.x,enemy.y);await page.mouse.down();
        if(Math.hypot(enemy.x-s.x,enemy.y-s.y)<145&&Date.now()-lastMelee>390){await page.keyboard.press('f',{delay:35});lastMelee=Date.now();}
        if(Math.abs(enemy.x-s.x)<160&&Date.now()-lastJump>1100){await page.keyboard.press('Space',{delay:140});lastJump=Date.now();}
      }else await page.mouse.up();
      await page.waitForTimeout(95);
    }
    await release();throw new Error('movement blocked');
  };
  const gate=async(x,expected,run)=>{await walk(x);await page.keyboard.press('w',{delay:60});await page.waitForTimeout(130);const s=await state();run.trace.push({event:'travel',zone:s.zone,t:s.t,hp:s.hp,cargo:s.cargo,activity:s.activity});if(s.zone!==expected)throw new Error('did not reach '+expected);};
  const clear=async(maxMs=6500)=>{
    const end=Date.now()+maxMs;
    while(Date.now()<end){const s=await state();if(s.state!=='field')throw new Error('death during combat');if(!s.enemies.length)break;const enemy=s.enemies.sort((a,b)=>Math.abs(a.x-s.x)-Math.abs(b.x-s.x))[0];await aim(enemy.x,enemy.y);await page.mouse.down();if(Math.abs(enemy.x-s.x)<100)await page.keyboard.press('f',{delay:40});await page.waitForTimeout(130);}
    await page.mouse.up();
  };
  const search=async(id,run)=>{
    const loot=(await state()).loot.find(x=>x.id===id);if(!loot)return;
    await walk(loot.x);let s=await state();if(s.enemies.some(x=>Math.abs(x.x-s.x)<210))await clear(3500);
    await page.keyboard.down('w');await page.waitForTimeout(1650);await page.keyboard.up('w');s=await state();
    if(s.state!=='field')throw new Error('death during search');
    run.trace.push({event:'search '+id,zone:s.zone,t:s.t,hp:s.hp,cargo:s.cargo,activity:s.activity});
  };
  const cannon=async(run)=>{
    // Remove the first charging body from a distance without aiming at the gun carrier.
    let s=await state(),gun=s.modules.find(x=>x.kind==='gun'&&x.parentId),other=s.enemies.find(x=>x.id!==gun?.parentId);
    if(other){const id=other.id;for(let i=0;i<32;i++){s=await state();other=s.enemies.find(x=>x.id===id);if(!other)break;await aim(other.x,other.y);await page.mouse.down();await page.waitForTimeout(100);}await page.mouse.up();}
    s=await state();gun=s.modules.find(x=>x.kind==='gun'&&x.parentId);if(!gun){run.trace.push({event:'no intact attached gun',t:s.t,hp:s.hp});return false;}
    const id=gun.id;
    for(let i=0;i<65;i++){
      s=await state();if(s.state!=='field')throw new Error('death approaching gun');gun=s.modules.find(x=>x.id===id);if(!gun)break;
      await aim(gun.x,gun.y);
      if(!gun.parentId)break;
      if(Math.hypot(gun.x-s.x,gun.y-s.y)<97){await release();await aim(gun.x,gun.y);await page.keyboard.press('f',{delay:60});await page.waitForTimeout(370);}
      else{const dir=gun.x>s.x?'d':'a';await page.keyboard.up(dir==='d'?'a':'d');await page.keyboard.down(dir);await page.waitForTimeout(90);}
    }
    await release();s=await state();gun=s.modules.find(x=>x.id===id);
    if(!gun||gun.parentId){run.trace.push({event:'gun detach failed',t:s.t,hp:s.hp});return false;}
    await aim(gun.x,gun.y);await page.keyboard.press('e',{delay:60});await page.waitForTimeout(80);s=await state();gun=s.modules.find(x=>x.id===id);
    if(s.held===id)await aim(s.x+160,s.y);else if(gun)await aim(gun.x,gun.y);
    await page.mouse.down({button:'right'});await page.waitForTimeout(380);await page.mouse.up({button:'right'});
    s=await state();gun=s.modules.find(x=>x.id===id);run.trace.push({event:'cannon attempt',held:s.held===id,stable:!!gun?.stable,t:s.t,hp:s.hp,stats:s.stats});
    return !!gun?.stable;
  };
  for(let attempt=1;attempt<=2&&Date.now()-started<230000;attempt++){
    const run={attempt,trace:[],startedAt:Date.now()};
    try{
      const before=await state();if(before.state!=='hub')throw new Error('expected a fresh hub');
      await page.getByRole('button',{name:/开始第一次出行|再次出发/}).click();await page.waitForTimeout(140);
      await search('airlock-0',run);await gate(1200,'concourse',run);run.cannonUsed=await cannon(run);await clear(4500);
      await search('concourse-0',run);await search('concourse-1',run);
      let s=await state();
      if(s.hp>=40){
        run.trace.push({event:'decision: enter turbine',hp:s.hp,cargo:s.cargo,t:s.t});await gate(1200,'turbine',run);await search('turbine-0',run);s=await state();
        await page.screenshot({path:'output/playwright/deep-'+attempt+'-turbine.png'});
        if(s.hp>=38){
          run.trace.push({event:'decision: attempt core',hp:s.hp,cargo:s.cargo,t:s.t});await gate(1200,'core',run);await search('core-0',run);
          await page.screenshot({path:'output/playwright/deep-'+attempt+'-core.png'});await gate(65,'turbine',run);
        }else run.trace.push({event:'decision: retreat from turbine',hp:s.hp,cargo:s.cargo,t:s.t});
        await gate(65,'concourse',run);
      }else run.trace.push({event:'decision: retreat before turbine',hp:s.hp,cargo:s.cargo,t:s.t});
      await gate(65,'airlock',run);await walk(175,false);await page.keyboard.down('w');await page.waitForTimeout(1750);await page.keyboard.up('w');
    }catch(error){run.error=String(error);await release();}
    const final=await state();run.wallSeconds=(Date.now()-run.startedAt)/1000;run.final=final;await page.screenshot({path:'output/playwright/deep-'+attempt+'-result.png'});runs.push(run);
    if(final.state==='field'){await page.keyboard.press('Escape');break;}
    if(final.lastRecord?.outcome==='extracted'&&final.lastRecord.route.includes('core'))break;
  }
  await release();return {kind:'real-input-browser-play',stateMutations:false,debugUsed:false,wallSeconds:(Date.now()-started)/1000,runs,consoleAndPageErrors:errors};
}
