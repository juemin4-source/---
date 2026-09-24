async (page) => {
  // Controlled fixtures isolate browser input, visual feedback, and persistence.
  // These checks are not a claim of an unassisted player completing the game.
  const results=[];
  const check=(v,label)=>{if(!v)throw new Error(label);results.push(label);};
  const backup=await page.evaluate(()=>localStorage.getItem("ever-eclipse-slice-v1"));
  const box=await page.locator("canvas").boundingBox();
  const aim=(x,y)=>page.mouse.move(box.x+x*box.width/1280,box.y+y*box.height/720);
  const state=()=>page.evaluate(()=>({energy:eclipseSlice.world.energy,metrics:eclipseSlice.world.metrics,result:eclipseSlice.world.result,save:eclipseSlice.save,slots:eclipseSlice.world.slots,cargo:eclipseSlice.world.cargo,shortcut:eclipseSlice.world.shortcut,extraction:eclipseSlice.world.extraction}));
  const setup=async mode=>{
    await page.evaluate(async mode=>{
      const {SliceWorld,Carrier}=await import("/src/slice/SliceWorld.ts");
      const s=eclipseSlice,w=new SliceWorld();s.world=w;s.started=true;s.paused=false;s.mapOpen=false;s.helpOpen=false;s.settled=false;s.overlayKey="";s.resetInput();
      if(mode==="wall"){
        w.slots=["ram","battery","discharge"];w.player.x=1110;
        const e=new Carrier("crawler",1215,584,"ram",1);e.hp=e.maxHp=999;w.enemies=[e];
      }
      if(mode==="mark"){
        w.slots=["mark","conduit","spread"];w.player.x=180;
        w.enemies=[new Carrier("crawler",450,584,"mark",1),new Carrier("crawler",590,584,"conduit",1),new Carrier("crawler",650,584,"spread",1)];
        w.enemies[0].hp=70;
      }
      if(mode==="swap"){
        w.slots=["ram","battery","discharge","mark","conduit","spread"];
        const d={id:1,x:200,y:585,organ:"leech"};w.drops.push(d);w.pendingDrop=d;
      }
      if(mode==="extract"){w.cargo=125;w.relay=true;w.slots=["mark","conduit","spread"];}
    },mode);await page.waitForTimeout(120);
  };
  try {
    await setup("wall");await aim(1244,584);await page.keyboard.down("d");await page.keyboard.press("Shift");await page.waitForTimeout(150);await page.keyboard.up("d");await page.waitForTimeout(170);
    check((await state()).metrics.wallCharges>0,"native dash collides with enemy and generates wall charge");
    await page.screenshot({path:"output/playwright/slice-wall-charge.png"});
    for(let i=0;i<12;i++){const e=await page.evaluate(()=>eclipseSlice.world.enemies.find(e=>!e.dead));await aim(e.x,e.y);await page.mouse.down();await page.waitForTimeout(140);}
    await page.mouse.up();check((await state()).metrics.chargedHits>0,"native fifth shot consumes charge and lands powered hit");
    await setup("mark");
    for(let i=0;i<22;i++){
      const e=await page.evaluate(()=>{const e=eclipseSlice.world.enemies.find(e=>!e.dead);return e?{x:e.x,y:e.y}:null;});if(!e)break;
      await aim(e.x,e.y);await page.mouse.down();await page.waitForTimeout(140);
    }
    await page.mouse.up();const chain=await state();check(chain.metrics.spreads>0&&chain.metrics.transmissions>0,"native shots cause mark death spread and nonrecursive transmission");
    await page.screenshot({path:"output/playwright/slice-mark-chain.png"});
    await setup("swap");await page.screenshot({path:"output/playwright/slice-swap.png"});
    await page.locator('button[data-action="equip"][data-slot="1"]').click();
    check(await page.locator("#overlay").isHidden(),"equip dismisses overlay instead of intercepting canvas input");
    check((await state()).slots[1]==="leech","seventh organ replaces selected slot through UI");
    await page.keyboard.press("Tab");await page.getByRole("heading",{name:"决定下一步。"}).waitFor();await page.screenshot({path:"output/playwright/slice-map.png"});await page.keyboard.press("Tab");
    await setup("extract");const before=(await state()).save.bank;
    await page.keyboard.down("e");await page.waitForTimeout(1000);await page.keyboard.up("e");await page.waitForTimeout(80);
    check(!(await state()).result&&(await state()).extraction===0,"releasing extraction key cancels partial extraction");
    await page.keyboard.down("e");await page.waitForTimeout(2200);await page.keyboard.up("e");await page.waitForTimeout(100);
    const win=await state();check(win.result==="extracted"&&win.save.bank===before+125&&win.save.shortcut,"extraction banks cargo and unlocks shortcut");
    await page.waitForTimeout(200);check((await state()).save.bank===before+125,"settlement happens only once");
    await page.locator("#slice-feedback").fill("自动化验收夹具：验证结算与记录，不计入真人体验样本。");
    const downloadPromise=page.waitForEvent("download");await page.getByRole("button",{name:"导出本局试玩记录"}).click();const download=await downloadPromise;
    await download.saveAs("output/playwright/slice-scenario-record.json");
    await page.screenshot({path:"output/playwright/slice-result-fixture.png"});
    await page.getByRole("button",{name:/再出发/}).click();check((await state()).slots.length===0&&(await state()).shortcut,"next expedition resets slots and retains unlocked route");
    check(await page.locator("#overlay").isHidden(),"restart dismisses result overlay");
    await page.evaluate(()=>{const w=eclipseSlice.world;w.cargo=90;w.player.invulnerable=0;w.hurtPlayer(100,0);});await page.waitForTimeout(100);
    check((await state()).result==="dead"&&(await state()).save.bank===before+125,"death loses current cargo without erasing bank");
    await page.screenshot({path:"output/playwright/slice-death.png"});
    await page.getByRole("button",{name:/再出发/}).click();await page.evaluate(()=>{eclipseSlice.world.cargo=333;});await page.reload();
    await page.getByText(/上一趟出行中断/).waitFor();check((await state()).save.bank===before+125,"reload reports interrupted expedition and preserves settled progress");
    await page.goto("http://127.0.0.1:5173/?legacy");await page.getByRole("button",{name:/开始第一次出行|再次出发/}).first().waitFor({timeout:5000});results.push("legacy entry renders");
    await page.goto("http://127.0.0.1:5173/?combat");await page.getByRole("button",{name:/进入试验场/}).waitFor({timeout:5000});results.push("old combat entry renders");
    return {passed:results,chainMetrics:chain.metrics};
  } finally {
    await page.evaluate(backup=>{if(backup===null)localStorage.removeItem("ever-eclipse-slice-v1");else localStorage.setItem("ever-eclipse-slice-v1",backup);},backup);
    await page.goto("http://127.0.0.1:5173");
  }
}
