async(page)=>{
 await page.keyboard.press('Escape');const r=await page.locator('canvas').boundingBox();await page.mouse.move(r.x+800*r.width/1280,r.y+586*r.height/720);await page.mouse.down({button:'right'});await page.waitForTimeout(500);
 const result=await page.evaluate(()=>({mode:blackSun.mode,pending:blackSun.pending,buttons:blackSun.input.activePointer.buttons,left:blackSun.input.activePointer.leftButtonDown(),right:blackSun.input.activePointer.rightButtonDown(),p:{x:blackSun.world.player.x,y:blackSun.world.player.y,aim:blackSun.world.player.aim},beam:{x:blackSun.world.phaseX,y:blackSun.world.phaseY,time:blackSun.world.phaseBeam,cool:blackSun.world.phaseCooldown},modules:blackSun.world.modules.map(m=>({x:m.x,y:m.y,stable:m.stable,held:m.held,parent:!!m.parent}))}));
 await page.mouse.up({button:'right'});await page.keyboard.press('Escape');return result;
}
