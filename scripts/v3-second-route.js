async(page)=>{
 const trace=[],errors=[],started=Date.now();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const box=await page.locator('canvas').boundingBox();
 const aim=(x,y)=>page.mouse.move(box.x+x*box.width/1280,box.y+y*box.height/720);
 const state=()=>page.evaluate(()=>{const e=blackSun.expedition,w=e.world;return{state:e.state,mode:blackSun.mode,zone:e.zoneId,t:e.seconds,hp:w.player.hp,x:w.player.x,y:w.player.y,activity:e.activity,cargo:{...e.cargo},rig:e.rig.modules.map(m=>({kind:m.kind,id:m.id})),stats:{...e.rig.telemetry},escort:e.discovery.escort,lift:e.discovery.liftOpen,enemies:w.enemies.filter(e=>!e.dead).map(e=>({x:e.x,y:e.y,id:e.id,hp:e.hp,kind:e.kind,shield:e.modules.find(m=>m.parent===e&&!m.dead&&m.kind==='shield')?.id})),modules:w.modules.filter(m=>!m.dead&&!m.mounted).map(m=>({x:m.x,y:m.y,id:m.id,kind:m.kind,parent:!!m.parent})),loot:e.state==='field'?e.area.loot.filter(l=>!l.taken).map(l=>({id:l.id,x:l.x,y:l.y})):[],features:e.discovery.features.filter(f=>f.zoneId===e.zoneId&&!f.done).map(f=>({id:f.id,x:f.x,y:f.y})),last:e.lastRecord,bank:{...e.profile.bank},residents:[...e.profile.residents],findings:[...e.profile.discoveries]};});
 const release=async()=>{for(const k of ['a','d','w',' '])await page.keyboard.up(k);await page.mouse.up();};
 const walk=async(x,firing=false)=>{if(firing)await page.mouse.down();for(let i=0;i<90;i++){const s=await state();if(s.state!=='field')throw Error('run ended');if(Math.abs(s.x-x)<12){await page.keyboard.up('a');await page.keyboard.up('d');await page.mouse.up();return;}const d=s.x<x?'d':'a';await page.keyboard.up(d==='d'?'a':'d');await page.keyboard.down(d);if(firing&&s.enemies.length)await aim(s.enemies[0].x,s.enemies[0].y);await page.waitForTimeout(85);}throw Error('walk blocked');};
 const fight=async()=>{await page.mouse.down();for(let i=0;i<170;i++){const s=await state();if(s.state!=='field')throw Error('combat death');const enemy=s.enemies[0];if(!enemy)break;await aim(enemy.x,enemy.y);const shield=s.modules.find(m=>m.id===enemy.shield);if(shield){await page.mouse.up();if(Math.hypot(shield.x-s.x,shield.y-s.y)<103){await aim(shield.x,shield.y);await page.keyboard.press('f',{delay:60});await page.waitForTimeout(380);await page.keyboard.press('f',{delay:60});}else{await page.keyboard.down(s.x<shield.x?'d':'a');await page.waitForTimeout(160);await page.keyboard.up('a');await page.keyboard.up('d');}await page.mouse.down();}await page.waitForTimeout(90);}await page.mouse.up();trace.push({event:'fight',...(await state())});};
 const connect=async(kind)=>{let s=await state();if(s.rig.some(m=>m.kind===kind))return;const m=s.modules.find(m=>!m.parent&&m.kind===kind);if(!m)throw Error('no organ '+kind);await walk(m.x);await page.keyboard.press('e',{delay:70});await page.waitForTimeout(100);s=await state();if(!s.rig.some(n=>n.kind===kind))throw Error('wrong organ '+kind);trace.push({event:'connect '+kind,...s});};
 const channel=async(id)=>{const s=await state(),item=[...s.loot,...s.features].find(l=>l.id===id);if(!item)throw Error('missing '+id);await walk(item.x);await page.keyboard.down('w');await page.waitForTimeout(2700);await page.keyboard.up('w');await page.waitForTimeout(100);trace.push({event:id,...await state()});};
 const gate=async(x,zone)=>{await walk(x);await page.keyboard.press('w',{delay:70});await page.waitForTimeout(130);const s=await state();if(s.zone!==zone)throw Error('gate '+zone+' got '+s.zone);trace.push({event:'travel '+zone,...s});};

 const fly=async(x)=>{
   await page.keyboard.down('Space');await page.waitForTimeout(180);await page.keyboard.up('Space');await page.waitForTimeout(80);
   await page.keyboard.down('Space');await walk(x);await page.waitForTimeout(400);await page.keyboard.up('Space');
   trace.push({event:'boost to '+x,...await state()});
 };
 try{
  const initial=await state();if(initial.state==='field'){if(initial.mode)await page.locator('[data-action=resume]').click();}else await page.locator('[data-action=depart]').click();
  await gate(1200,'concourse');await fight();await connect('thruster');await connect('gun');
  await walk(790);await fly(1100);await walk(1190);await page.keyboard.press('w',{delay:80});await page.waitForTimeout(160);if((await state()).zone!=='archive')throw Error('boost route not reached');
  await fight();await connect('grapple');await walk(760);await fly(910);await channel('dawn-lens');
  await page.screenshot({path:'output/playwright/v3-lens.png'});
  await gate(65,'concourse');await gate(440,'service');await fight();await channel('roots');await gate(1200,'turbine');await fight();
  await channel('return-lift');await page.screenshot({path:'output/playwright/v3-implosion.png'});
  const preReturn=await state();await gate(1120,'airlock');await walk(175);await page.keyboard.down('w');await page.waitForTimeout(1800);await page.keyboard.up('w');await page.waitForTimeout(150);
  const final=await state();await page.screenshot({path:'output/playwright/v3-city-discoveries.png'});
  return{passed:final.last?.outcome==='extracted'&&final.findings.includes('dawn-lens')&&final.findings.includes('roots')&&preReturn.stats.implosions>0,wallSeconds:(Date.now()-started)/1000,preReturn,final,trace,errors};
 }catch(error){await release();const final=await state();if(final.state==='field'&&!final.mode)await page.keyboard.press('Escape');await page.screenshot({path:'output/playwright/v3-second-failure.png'});return{error:String(error),final,trace,errors};}
}