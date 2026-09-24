async (page) => {
  const report={kind:'controlled-browser-validation',url:'http://127.0.0.1:5173/',checks:[],consoleErrors:[],pageErrors:[]};
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  page.on('pageerror',error=>report.pageErrors.push(String(error)));
  const ready=()=>page.waitForFunction(()=>window.blackSun?.expedition&&window.blackSun?.ui);
  const check=(name,passed,details)=>{report.checks.push({name,passed,details});if(!passed)throw new Error(name);};
  const snapshot=()=>page.evaluate(()=>({state:blackSun.expedition.state,bank:{...blackSun.expedition.profile.bank},upgrades:{...blackSun.expedition.profile.upgrades},active:blackSun.expedition.profile.active,history:blackSun.expedition.profile.history,modules:blackSun.world.modules.length}));
  try{
    await ready();
    await page.evaluate(()=>localStorage.removeItem('black-sun-expedition-v1'));
    await page.reload();await ready();
    report.setup=await page.evaluate(()=>{
      const s=blackSun,e=s.expedition;
      e.profile.bank={material:100,core:10,data:10};
      const purchases=['health','weapon','phase'].map(key=>e.buy(key));
      const bank={...e.profile.bank},upgrades={...e.profile.upgrades};
      e.start(321);e.world.player.x=1200;e.world.player.y=560;e.travelCooldown=0;e.travel('out');
      e.world.enemies=[];e.world.modules=[];e.world.stableQueue=[];
      s.mode='';e.debugUsed=true;
      return {controlledSetup:true,purchases,bank,upgrades};
    });
    check('purchase three permanent upgrades',report.setup.purchases.every(Boolean),report.setup);
    report.stage80=await page.evaluate(()=>{
      const e=blackSun.expedition,c={left:false,right:false,jump:false,jumpHeld:false,dash:false,fire:false,phase:false,melee:false,grab:false,rotate:0,mx:800,my:400};
      e.activity=79.99;e.stages=new Set([30,60]);e.spawnClock=0;e.world.god=false;e.world.player.invulnerable=0;
      const hp=e.world.player.hp;e.update(.2,c);
      return {activity:e.activity,stage:e.activityStage,state:e.state,hpBefore:hp,hpAfter:e.world.player.hp,god:e.world.god,damageScale:e.world.damageScale,enemies:e.world.enemies.filter(x=>!x.dead).map(x=>({kind:x.kind,rare:e.rareIds.has(x.id)}))};
    });
    check('80 percent remains alive and creates rare elite',report.stage80.state==='field'&&report.stage80.hpAfter>0&&report.stage80.enemies.some(x=>x.kind==='elite'&&x.rare),report.stage80);
    await page.waitForTimeout(160);await page.screenshot({path:'output/playwright/risk-80.png'});
    report.stage100=await page.evaluate(()=>{
      const e=blackSun.expedition,c={left:false,right:false,jump:false,jumpHeld:false,dash:false,fire:false,phase:false,melee:false,grab:false,rotate:0,mx:800,my:400};
      e.activity=99.99;e.spawnClock=0;const hp=e.world.player.hp,before=e.world.enemies.filter(x=>!x.dead).length;e.update(.2,c);
      return {activity:e.activity,stage:e.activityStage,state:e.state,hpBefore:hp,hpAfter:e.world.player.hp,god:e.world.god,damageScale:e.world.damageScale,before,after:e.world.enemies.filter(x=>!x.dead).length};
    });
    check('100 percent aggregation is not instant death',report.stage100.activity===100&&report.stage100.stage==='聚合状态'&&report.stage100.state==='field'&&report.stage100.hpAfter>0&&report.stage100.after>report.stage100.before,report.stage100);
    await page.waitForTimeout(160);await page.screenshot({path:'output/playwright/risk-100.png'});
    report.reinforcement=await page.evaluate(()=>{
      const e=blackSun.expedition,c={left:false,right:false,jump:false,jumpHeld:false,dash:false,fire:false,phase:false,melee:false,grab:false,rotate:0,mx:800,my:400};
      const before=e.world.enemies.filter(x=>!x.dead).length;e.spawnClock=8.99;e.update(.1,c);
      return {controlledTimerAdvance:true,before,after:e.world.enemies.filter(x=>!x.dead).length,damageScale:e.world.damageScale};
    });
    check('aggregation timer adds reinforcements',report.reinforcement.after>report.reinforcement.before&&report.reinforcement.damageScale===1.7,report.reinforcement);
    report.deathSetup=await page.evaluate(()=>{
      const e=blackSun.expedition,c={left:false,right:false,jump:false,jumpHeld:false,dash:false,fire:false,phase:false,melee:false,grab:false,rotate:0,mx:800,my:400};
      e.cargo={material:40,core:4,data:5};const m=e.world.modules.find(x=>!x.dead);m.detach();e.world.stabilize(m);m.held=true;e.world.held=m;
      const setup={cargo:{...e.cargo},heldModule:m.kind,phaseCount:e.world.stableQueue.length,bank:{...e.profile.bank},upgrades:{...e.profile.upgrades}};
      e.world.player.invulnerable=0;e.world.god=false;e.world.hurtPlayer(9999,500);e.update(1/120,c);
      return setup;
    });
    await page.waitForTimeout(160);report.afterDeath=await snapshot();
    check('lethal damage banks rounded 30 percent and clears organs',report.afterDeath.state==='hub'&&JSON.stringify(report.afterDeath.bank)===JSON.stringify({material:40,core:9,data:9})&&report.afterDeath.modules===0&&report.afterDeath.history[0].outcome==='rescued'&&JSON.stringify(report.afterDeath.history[0].banked)===JSON.stringify({material:12,core:2,data:2}),report.afterDeath);
    check('previous bank and upgrades survive death',JSON.stringify(report.afterDeath.upgrades)===JSON.stringify(report.setup.upgrades)&&report.afterDeath.bank.material===report.setup.bank.material+12&&report.afterDeath.bank.core===report.setup.bank.core+2&&report.afterDeath.bank.data===report.setup.bank.data+2,report.afterDeath.upgrades);
    await page.screenshot({path:'output/playwright/risk-rescued.png'});
    for(let i=1;i<=2;i++){
      await page.reload();await ready();const reloaded=await snapshot();
      check('death reload '+i+' cannot bank twice',JSON.stringify(reloaded.bank)===JSON.stringify(report.afterDeath.bank)&&reloaded.history.length===1&&reloaded.active===null&&JSON.stringify(reloaded.upgrades)===JSON.stringify(report.setup.upgrades),reloaded);
    }
    await page.evaluate(()=>{const e=blackSun.expedition;e.start(322);e.cargo={material:20,core:2,data:3};e.saveActive();});
    await page.reload();await ready();report.interrupted=await snapshot();
    check('active reload settles one interrupted rescue',report.interrupted.state==='hub'&&JSON.stringify(report.interrupted.bank)===JSON.stringify({material:46,core:10,data:10})&&report.interrupted.history.length===2&&report.interrupted.history[0].outcome==='interrupted'&&report.interrupted.active===null,report.interrupted);
    await page.reload();await ready();report.final=await snapshot();
    check('second interrupted reload is idempotent',JSON.stringify(report.final.bank)===JSON.stringify(report.interrupted.bank)&&report.final.history.length===2&&JSON.stringify(report.final.upgrades)===JSON.stringify(report.setup.upgrades),report.final);
    await page.waitForTimeout(160);await page.screenshot({path:'output/playwright/risk-interrupted.png'});
    report.passed=report.checks.every(x=>x.passed)&&report.consoleErrors.length===0&&report.pageErrors.length===0;
  }catch(error){report.passed=false;report.error=String(error);await page.screenshot({path:'output/playwright/risk-failure.png'}).catch(()=>{});}
  return report;
}
