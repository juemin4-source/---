async(page)=>{
 const box=await page.locator('canvas').boundingBox();
 const aim=async(x,y)=>page.mouse.move(box.x+x*box.width/1280,box.y+y*box.height/720);
 await page.getByRole('button',{name:/再次出发|开始第一次出行/}).click();await page.waitForTimeout(150);
 await page.keyboard.down('d');await page.waitForTimeout(2950);await page.keyboard.up('d');await page.keyboard.press('w',{delay:60});await page.waitForTimeout(150);
 const before=await page.evaluate(()=>({zone:blackSun.expedition.zoneId,player:{x:blackSun.world.player.x,y:blackSun.world.player.y},enemies:blackSun.world.enemies.map(e=>({x:e.x,y:e.y,hp:e.hp}))}));
 await page.mouse.down();
 for(let i=0;i<25;i++){const target=await page.evaluate(()=>blackSun.world.enemies.filter(e=>!e.dead).map(e=>({x:e.x,y:e.y}))[0]);if(!target)break;await aim(target.x,target.y);await page.waitForTimeout(100);}
 await page.mouse.up();const after=await page.evaluate(()=>({hp:blackSun.world.player.hp,enemies:blackSun.world.enemies.map(e=>({x:e.x,y:e.y,hp:e.hp,dead:e.dead})),shots:blackSun.world.projectiles.length,aim:blackSun.world.player.aim,pointer:{x:blackSun.input.activePointer.x,y:blackSun.input.activePointer.y,buttons:blackSun.input.activePointer.buttons}}));await page.keyboard.press('Escape');return{before,after};
}
