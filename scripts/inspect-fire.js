async(page)=>{
 await page.keyboard.press('Escape');
 const r=await page.locator('canvas').boundingBox(),logs=[];
 await page.mouse.down({button:'left'});
 for(let i=0;i<15;i++){
  const target=await page.evaluate(()=>{const e=blackSun.world.enemies.find(e=>!e.dead);return e?{x:e.x,y:e.y}:null;});if(!target)break;
  await page.mouse.move(r.x+target.x*r.width/1280,r.y+target.y*r.height/720);await page.waitForTimeout(150);
  logs.push(await page.evaluate(()=>({p:{x:blackSun.world.player.x,y:blackSun.world.player.y},aim:blackSun.world.player.aim,fire:blackSun.pending.fire,buttons:blackSun.input.activePointer.buttons,mouse:{x:blackSun.input.activePointer.x,y:blackSun.input.activePointer.y},shots:blackSun.world.projectiles.map(p=>({x:p.x,y:p.y,team:p.team})),enemies:blackSun.world.enemies.map(e=>({x:e.x,y:e.y,hp:e.hp}))})));
 }
 await page.mouse.up({button:'left'});await page.keyboard.press('Escape');return logs;
}
