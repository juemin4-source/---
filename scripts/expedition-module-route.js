async(page)=>{
 const box=await page.locator('canvas').boundingBox(),trace=[];
 const aim=async(x,y)=>page.mouse.move(box.x+x*box.width/1280,box.y+y*box.height/720);
 const state=()=>page.evaluate(()=>({zone:blackSun.expedition.zoneId,state:blackSun.expedition.state,t:blackSun.expedition.seconds,x:blackSun.world.player.x,y:blackSun.world.player.y,hp:blackSun.world.player.hp,held:blackSun.world.held?.id,cargo:{...blackSun.expedition.cargo},enemies:blackSun.world.enemies.filter(e=>!e.dead).map(e=>({id:e.id,x:e.x,y:e.y,kind:e.kind})),modules:blackSun.world.modules.filter(m=>!m.dead).map(m=>({id:m.id,x:m.x,y:m.y,kind:m.kind,parent:!!m.parent,angle:m.angle,stable:m.stable})),loot:blackSun.expedition.state==='field'?blackSun.expedition.area.loot.filter(l=>!l.taken).map(l=>({id:l.id,x:l.x,y:l.y,kind:l.kind})):[]}));
 const walk=async(x)=>{for(let i=0;i<65;i++){const s=await state();if(s.state!=='field')throw new Error('returned early');if(Math.abs(s.x-x)<12){await page.keyboard.up('a');await page.keyboard.up('d');return;}await page.keyboard.up(s.x<x?'a':'d');await page.keyboard.down(s.x<x?'d':'a');await page.waitForTimeout(100);}throw new Error('walk blocked');};
 const gate=async(x,zone)=>{await walk(x);await page.keyboard.press('w',{delay:60});await page.waitForTimeout(150);if((await state()).zone!==zone)throw new Error('gate not reached '+zone);trace.push(await state());};
 const clear=async()=>{await page.mouse.down();for(let i=0;i<70;i++){const s=await state();if(s.state!=='field')throw new Error('combat death');const e=s.enemies[0];if(!e)break;await aim(e.x,e.y);await page.waitForTimeout(100);}await page.mouse.up();await page.waitForTimeout(80);};
 const search=async(id)=>{const l=(await state()).loot.find(l=>l.id===id);if(!l)return;await walk(l.x);await page.keyboard.down('w');await page.waitForTimeout(1600);await page.keyboard.up('w');};
 try{
  await page.getByRole('button',{name:/再次出发|开始第一次出行/}).click();await page.waitForTimeout(120);await gate(1200,'concourse');
  let id;
  for(let i=0;i<45;i++){
   const s=await state(),m=s.modules.find(m=>m.kind==='thruster'&&m.parent);if(!m)throw new Error('no attached thruster');id=m.id;
   await aim(m.x,m.y);
   if(Math.hypot(s.x-m.x,s.y-m.y)<95){await page.keyboard.up('d');await page.keyboard.press('f',{delay:70});await page.waitForTimeout(370);await page.keyboard.press('f',{delay:70});break;}
   await page.keyboard.down('d');await page.waitForTimeout(90);
  }
  await page.keyboard.up('d');await page.waitForTimeout(60);let s=await state(),m=s.modules.find(m=>m.id===id);if(!m||m.parent)throw new Error('thruster not detached');
  await aim(m.x,m.y);
  await page.keyboard.press('e',{delay:60});await page.waitForTimeout(80);s=await state();if(s.held!==id)throw new Error('thruster not picked up');await aim(s.x+150,s.y);await page.mouse.down({button:'right'});await page.waitForFunction(()=>blackSun.world.held?.stable,{},{timeout:3000});await page.mouse.up({button:'right'});await page.waitForTimeout(80);s=await state();m=s.modules.find(m=>m.id===id);if(!m.stable)throw new Error('phase missed held module');const turns=((6-Math.round(m.angle/(Math.PI/4)))%8+8)%8;for(let q=0;q<turns;q++)await page.keyboard.press('q',{delay:45});trace.push(await state());
  await clear();await aim(1200,586);await walk(740);await aim(1200,586);await page.waitForTimeout(70);await page.keyboard.press('e',{delay:60});await page.waitForTimeout(80);trace.push(await state());
  await walk(1190);
  for(let i=0;i<25;i++){s=await state();if(Math.abs(s.y-255)<55){await page.keyboard.press('w',{delay:60});await page.waitForTimeout(120);break;}await page.waitForTimeout(80);}
  if((await state()).zone!=='archive')throw new Error('did not reach archive');await clear();await search('archive-0');await page.screenshot({path:'output/playwright/expedition-archive.png'});trace.push(await state());
  await gate(65,'concourse');await gate(65,'airlock');await walk(175);await page.keyboard.down('w');await page.waitForTimeout(1700);await page.keyboard.up('w');
  const record=await page.evaluate(()=>blackSun.expedition.lastRecord);return{passed:record.outcome==='extracted'&&record.detached>0&&record.cargo.data>=5,record,trace};
 }catch(error){await page.keyboard.up('a');await page.keyboard.up('d');await page.keyboard.up('w');await page.mouse.up();await page.mouse.up({button:'right'});await page.keyboard.press('Escape');return{error:String(error),state:await state(),trace};}
}
