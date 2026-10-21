// Кадры окружения: три телефона × берег/пирс/парк × день/ночь.
// NODE_PATH=... node tools/capture_water.js tools/shots/water/before
'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const out=process.argv[2]||'tools/shots/water/current';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch();const manifest=[],errors=[];
try{for(const [phone,width,height,dpr]of [['15Pro',393,759,3],['small320',320,568,2],['ProMax',430,932,3]]){
 if(process.env.PHONE&&process.env.PHONE!==phone)continue;
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(phone+': '+e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/');await page.waitForFunction(()=>window.G?.world);
 await page.evaluate(()=>{
  const s=G.game.newState();s.started=true;s.hero.name='Кайто';s.hero.stats={tai:6,nin:5,gen:4,chakra:5,ctrl:5,spd:6,end:5,know:4};s.hero.skills=['eagle_eye','diligent'];
  Object.assign(s.flags,{enrolled:1,hosp_done:1,day2_intro:1,frd_init:1,home_seen:1});for(const id of Object.keys(G.FRIENDS)){s.flags['met_'+id]=1;s.vars['friend_'+id]=10;}
  s.vars.day=6;s.inv={kunai:6,shuriken:8,bandage:2,smoke_bomb:1,wire:1};s.quests.day1={st:'done',step:99,day:1};
  G.story.poll=()=>false;G.life.RATE=0;G.audio.enabled=false;G.debug.on=false;G.scenes.fade={a:0,dir:0,speed:3,then:null};
  G.scenes.replace(G.scenes.make('world',G.world.outsideOf(G.world.heroHome())));const w=G.scenes.top();w.update=()=>{};w.time=2;w.notes=[];w.banner=null;w.toast=null;w.updateCamera();window.requestAnimationFrame=()=>0;
 });
 for(const location of ['shore','pier','park'])for(const [light,min]of [['day',540],['night',1320]]){
  await page.evaluate(({location,min})=>{G.storage.settings.density='mid';G.screen.resize();G.state.vars.min=min;const w=G.scenes.top();
   let target=w.map.objects.find(o=>o.kind==='bench');
   if(location!=='park'){
    const ID=G.tiles.ID,points=[];
    for(let y=1;y<w.map.h-1;y++)for(let x=1;x<w.map.w-1;x++){
     const id=w.map.get(x,y);if((location==='pier'?id===ID.PLANKS:G.tiles.GRASSY.has(id))&&[[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy])=>w.map.get(x+dx,y+dy)===ID.WATER))points.push({x:x*16+8,y:y*16+8});
    }
    target=points[Math.floor(points.length/2)]||target;
   }
   w.player.x=target.x;w.player.y=target.y+20;w.updateCamera();G.screen.clear('#000');G.scenes.draw(G.screen.ctx);G.touch.draw(G.screen.ctx);
  },{location,min});
  await page.waitForTimeout(70);await page.screenshot({path:path.join(out,`${phone}-${location}-${light}.png`),scale:'css'});
 }
 await context.close();console.log('✔ '+phone);
}if(errors.length)throw Error(errors.join('\n'));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
