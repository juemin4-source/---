import {describe,it,expect} from "vitest";
import {SliceWorld} from "../src/slice/SliceWorld";
import {organIds} from "../src/slice/config";
import {sites} from "../src/slice/AscentMap";

describe("自动拾取与无限收集",()=>{
  it("六槽同类近距离自动叠整组，新类型仍留在地上",()=>{
    const w=new SliceWorld();w.grant("ram");
    w.drops.push({id:10,x:w.player.x+25,y:w.player.y,organ:"ram",stacks:4},{id:11,x:w.player.x,y:w.player.y,organ:"speed"});
    w.step(.1);expect(w.count("ram")).toBe(5);expect(w.pendingDrop).toBeNull();expect(w.has("speed")).toBe(false);expect(w.drops).toHaveLength(1);
    w.step(.2);expect(w.count("ram")).toBe(5);
  });
  it("隔墙、隔层和远处不会吸取，暂停选择与死亡不会捡",()=>{
    const w=new SliceWorld();w.grant("ram");w.player.x=200;w.player.y=580;
    w.drops.push({id:10,x:230,y:580,organ:"ram"},{id:11,x:200,y:490,organ:"ram"});
    w.platforms.push({x:215,y:580,w:8,h:70});w.autoCollect();expect(w.count("ram")).toBe(1);
    w.platforms=[];w.pendingDrop=w.drops[1];w.autoCollect();expect(w.count("ram")).toBe(1);
    w.pendingDrop=null;w.result="dead";w.autoCollect();expect(w.count("ram")).toBe(1);
  });
  it("无限模式 28 种全接入，第七种及重复层数都不弹框",()=>{
    const w=new SliceWorld(false,1,false,true,true);
    for(const [i,id] of organIds.entries())w.drops.push({id:i+10,x:w.player.x,y:w.player.y,organ:id});
    w.autoCollect();expect(w.slots).toHaveLength(28);expect(w.totalLayers).toBe(28);expect(w.collectedLayers).toBe(28);expect(w.pendingDrop).toBeNull();expect(w.drops).toHaveLength(0);
    w.drops.push({id:99,x:w.player.x,y:w.player.y,organ:"speed",stacks:10});w.autoCollect();expect(w.count("speed")).toBe(11);expect(w.slots).toHaveLength(28);
  });
  it("无限开箱直接接入，但原六槽仍要求选择",()=>{
    const s=sites.find(s=>s.id==="pump-cache")!;
    const w=new SliceWorld(false,1,false,true,true);w.player.x=s.x;w.player.y=s.y;w.interact();expect(w.has("knock")).toBe(true);expect(w.pendingDrop).toBeNull();
    const original=new SliceWorld(false,1,false,true);original.player.x=s.x;original.player.y=s.y;original.interact();expect(original.pendingDrop?.organ).toBe("knock");
  });
  it("增强只作用出生，收集六层和时间会增强后续增援，旧怪不回血",()=>{
    const w=new SliceWorld(false,1,false,true,true);w.god=true;w.player.x=850;w.player.y=2676;
    const old=w.enemies[0],hp=old.hp;w.hit(old,10);const injured=old.hp;w.grant("speed",6);w.time=91;w.step(.02);
    expect(w.ascent!.pressure).toBe(2);expect(old.hp).toBe(injured);expect(injured).toBe(hp-10);
    const rein=w.enemies.filter(e=>w.ascent!.homes.get(e.id)?.id.startsWith("incursion-"));expect(rein.length).toBeGreaterThan(0);
    for(const e of rein){expect(e.maxHp).toBeGreaterThan(w.ascent!.homes.get(e.id)!.hp);expect(e.damageFactor).toBeGreaterThan(1.1);expect(e.spawnGrace).toBeGreaterThan(1);}
  });
  it("安全气闸和中庭不增援；战斗区持续补怪且总存活数有上限",()=>{
    const w=new SliceWorld(false,1,false,true,true);expect(w.ascent!.incursion()).toBe(0);
    w.player.y=1836;expect(w.ascent!.incursion()).toBe(0);
    w.player.x=850;w.player.y=2676;
    for(let i=0;i<50;i++)w.ascent!.incursion();expect(w.enemies.filter(e=>!e.dead)).toHaveLength(36);
    const e=w.enemies.find(e=>w.ascent!.homes.get(e.id)?.id.startsWith("incursion-"))!;e.dead=true;
    expect(w.ascent!.incursion()).toBe(1);
  });
  it("清除历次增援后仍能再刷，28 种掉落循环覆盖，六槽模式不增援",()=>{
    const w=new SliceWorld(false,1,false,true,true);w.god=true;w.player.x=850;w.player.y=2676;
    const dropped=new Set<string>();
    for(let i=0;i<20;i++){
      w.ascent!.incursion();
      for(const e of w.enemies)if(w.ascent!.homes.get(e.id)?.id.startsWith("incursion-")){dropped.add(e.organ);e.dead=true;}
      w.step(.01);
    }
    expect(dropped.size).toBe(28);expect(w.enemies.length).toBe(21);expect(w.ascent!.homes.size).toBe(21);
    const six=new SliceWorld(false,1,false,true);six.player.x=850;six.player.y=2676;expect(six.ascent!.incursion()).toBe(0);
  });
});
