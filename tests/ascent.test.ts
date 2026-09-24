import { describe,it,expect } from "vitest";
import { SliceWorld } from "../src/slice/SliceWorld";
import { ascentPlatforms,flights,sites,habitats } from "../src/slice/AscentMap";
import { Player,idleControls } from "../src/Player";
import { buildSources,fieldBuilds,nextBuildTarget,recommendBuilds } from "../src/slice/BuildGuide";

describe("沉井上行 / 手工地图",()=>{
  it("推荐组合全部有地图来源，按已装数量排序，目标随拾取推进",()=>{
    const w=new SliceWorld(false,1,false,true);
    for(const b of Object.values(fieldBuilds))for(const id of b.ids)expect(buildSources(w,id).length,id).toBeGreaterThan(0);
    w.grant("mark");w.grant("conduit");w.grant("spread");
    expect(recommendBuilds(w)[0].id).toBe("chain");
    const first=nextBuildTarget(w,"impact")!;w.grant(first.organ);
    expect(nextBuildTarget(w,"impact")!.organ).not.toBe(first.organ);
  });
  it("固定生态、宝箱和出生坐标不随出行种子变化，全部位于世界中",()=>{
    const a=new SliceWorld(false,1,false,true),b=new SliceWorld(false,999,false,true);
    expect(a.width).toBe(3000);expect(a.height).toBe(3300);expect(a.player.y).toBe(3096);
    expect(a.enemies.map(e=>[e.kind,e.x,e.y,e.organ])).toEqual(b.enemies.map(e=>[e.kind,e.x,e.y,e.organ]));
    expect(a.enemies).toHaveLength(habitats.length);
    for(const s of sites)expect(ascentPlatforms.some(p=>Math.abs(s.x-p.x)<=p.w/2&&Math.abs(s.y+24-(p.y-p.h/2))<2)).toBe(true);
  });
  it("两侧全部上行踏步用基础跳跃可达，不依赖器官或冲刺",()=>{
    for(const f of flights)for(const xs of [f.left,f.right]){
      const positions=[xs[0],...xs,xs[3]>1500?Math.max(1740,xs[3]):Math.min(1220,xs[3])];
      for(let k=0;k<5;k++){
        const p=new Player();p.boundsWidth=3000;p.x=positions[k];p.y=f.bottom-84*k-24;p.grounded=true;
        const destination=positions[k+1],top=f.bottom-84*(k+1);
        let landed=false;
        for(let i=0;i<120;i++){
          const c={...idleControls(),jump:i===0,jumpHeld:true,left:p.x>destination+5,right:p.x<destination-5};
          p.update(1/120,c,ascentPlatforms);
          if(p.grounded&&Math.abs(p.y+24-top)<2){landed=true;break;}
        }
        expect(landed,`bottom ${f.bottom} side ${xs[0]} step ${k}`).toBe(true);
      }
    }
  });
  it("一次性宝箱给出指定器官和样本，不可重复领取",()=>{
    const w=new SliceWorld(false,1,false,true),s=sites.find(s=>s.id==="pump-cache")!;
    w.player.x=s.x;w.player.y=s.y;w.interact();expect(w.cargo).toBe(35);expect(w.pendingDrop?.organ).toBe("knock");w.equip();
    w.interact();expect(w.cargo).toBe(35);expect(w.count("knock")).toBe(1);
  });
  it("温床守卫开箱前休眠，开箱后得到可见苏醒时间",()=>{
    const w=new SliceWorld(false,1,false,true),s=sites.find(s=>s.id==="glass-cache")!;
    const e=w.enemies.find(e=>w.ascent!.homes.get(e.id)?.nest===s.id)!;
    expect(w.ascent!.beforeEnemy(e)).toBe(false);w.player.x=s.x;w.player.y=s.y;w.interact();
    expect(w.ascent!.opened.has(s.id)).toBe(true);expect(e.spawnGrace).toBe(1);expect(w.cargo).toBe(120);
  });
  it("升降台连续运送到气闸层，可离台撤离且不增加金币",()=>{
    const w=new SliceWorld(false,1,false,true),a=w.ascent!,s=sites.find(s=>s.id==="lift-low")!;
    w.player.x=s.x;w.player.y=s.y;w.interact();expect(a.lifts[0].unlocked).toBe(true);
    w.player.x=1480;w.player.y=1836;w.interact();expect(a.riding).toBe("lift-low");
    w.step(1);expect(w.player.y).toBeCloseTo(2136);w.step(4);expect(w.player.y).toBeCloseTo(3096);
    w.player.x=900;for(let i=0;i<250;i++)w.update(1/120,idleControls(),true);
    expect(w.result).toBe("extracted");expect(w.cargo).toBe(0);
  });
  it("母体站在顶部平台、核心匣必须击败母体后才能取",()=>{
    const w=new SliceWorld(false,1,false,true),s=sites.find(s=>s.id==="core-cache")!;
    const boss=w.enemies.find(e=>e.kind==="elite")!;expect(boss.y+boss.h/2).toBe(600);
    w.player.x=s.x;w.player.y=s.y;w.god=true;w.interact();expect(w.cargo).toBe(0);
    w.step(4);expect(boss.y+boss.h/2).toBeLessThanOrEqual(600);
    w.hit(boss,99999);w.interact();expect(w.ascent!.opened.has(s.id)).toBe(true);expect(w.cargo).toBe(430);
  });
  it("中庭以下敌人不会隔着多层地板全图追击，掉落留在正确高度",()=>{
    const w=new SliceWorld(false,1,false,true),e=w.enemies[0];const x=e.x,y=e.y;w.step(3);expect(e.x).toBe(x);expect(e.y).toBe(y);
    w.hit(e,999);expect(w.drops[0].y).toBe(2676);
  });
});
