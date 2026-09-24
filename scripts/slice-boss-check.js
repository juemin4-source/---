async (page) => {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("button",{name:/进入猎场|开始下一次出行/}).waitFor();
  await page.evaluate(async()=>{
    const {SliceWorld}=await import("/src/slice/SliceWorld.ts");
    const s=eclipseSlice,w=new SliceWorld();s.world=w;s.started=true;s.paused=false;s.mapOpen=false;s.settled=false;s.overlayKey="";s.resetInput();
    w.enter("core");w.slots=["ram","battery","discharge","mark","leech","speed"];w.energy=3;
  });
  const box=await page.locator("canvas").boundingBox();
  let sawWindup=false,sawProjectiles=false;
  for(let i=0;i<150;i++){
    const s=await page.evaluate(()=>{const w=eclipseSlice.world;return {hp:w.player.hp,x:w.player.x,result:w.result,bossDead:!w.enemies.some(e=>!e.dead&&e.kind==="elite"),enemies:w.enemies.filter(e=>!e.dead).map(e=>({x:e.x,y:e.y,windup:e.windup})),shots:w.projectiles.some(p=>p.team==="enemy")};});
    if(s.result)throw new Error("boss fixture died before checking defeat");if(s.bossDead)break;
    sawWindup ||= s.enemies.some(e=>e.windup>0);sawProjectiles ||= s.shots;
    const e=s.enemies.sort((a,b)=>Math.abs(a.x-s.x)-Math.abs(b.x-s.x))[0];
    await page.mouse.move(box.x+e.x*box.width/1280,box.y+e.y*box.height/720);await page.mouse.down();
    if(s.hp<65)await page.keyboard.press("h");
    if(i%12===0)await page.keyboard.down("Space");if(i%12===4)await page.keyboard.up("Space");
    if(i%20===0)await page.keyboard.press("q");
    if(i===18)await page.screenshot({path:"output/playwright/slice-boss.png"});
    await page.waitForTimeout(140);
  }
  await page.mouse.up();await page.keyboard.up("Space");
  const r=await page.evaluate(()=>({bossDead:!eclipseSlice.world.enemies.some(e=>!e.dead&&e.kind==="elite"),result:eclipseSlice.world.result,cargo:eclipseSlice.world.cargo,log:eclipseSlice.world.log}));
  if(!r.bossDead||r.result||!r.log.some(e=>e.event==="boss"))throw new Error("Boss defeat incorrectly ends run or fails to reward");
  await page.keyboard.press("Escape");
  return {fixture:"pre-equipped character, otherwise full normal core encounter",sawWindup,sawProjectiles,...r};
}
