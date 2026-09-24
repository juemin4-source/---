async(page)=>{
 const before=await page.evaluate(()=>({mode:blackSun.mode,time:blackSun.world.time,held:!!blackSun.world.held}));
 await page.getByRole('button',{name:/继续探索/}).click();const r=await page.locator('canvas').boundingBox();await page.mouse.move(r.x+800*r.width/1280,r.y+586*r.height/720);await page.mouse.down({button:'right'});
 let error='';try{await page.waitForFunction(()=>blackSun.world.stableQueue.length>0,{},{timeout:3000});}catch(e){error=String(e);}
 const after=await page.evaluate(()=>({mode:blackSun.mode,time:blackSun.world.time,pending:blackSun.pending,held:blackSun.world.held?{x:blackSun.world.held.x,y:blackSun.world.held.y}:null,beam:{x:blackSun.world.phaseX,y:blackSun.world.phaseY,time:blackSun.world.phaseBeam,cool:blackSun.world.phaseCooldown},p:{x:blackSun.world.player.x,y:blackSun.world.player.y,aim:blackSun.world.player.aim},q:blackSun.world.stableQueue.length}));
 await page.mouse.up({button:'right'});await page.keyboard.press('Escape');return{before,after,error};
}
