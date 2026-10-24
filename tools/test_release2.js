// Реальные касания, размеры кнопок, сохранения и пиксели света в мобильном Chromium.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const shots=process.env.RELEASE_SHOTS||path.join(__dirname,'shots','release2');fs.mkdirSync(shots,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
try{const page=await browser.newPage({viewport:{width:393,height:759},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/index.html');await page.waitForFunction(()=>window.G?.lighting);
async function seed(){await page.evaluate(()=>{const s=G.game.newState();s.started=true;s.hero.name='Кайто';s.hero.stats={tai:7,nin:6,gen:5,chakra:7,ctrl:6,spd:6,end:6,know:5};s.hero.skills=[];Object.assign(s.flags,{enrolled:1,hosp_done:1,day2_intro:1,roofs:1,home_seen:1,frd_init:1,ramen_done:1,tech_kawarimi:1,tech_henge:1,tech_katon:1,tech_bunshin:1,combo_air:1});s.vars.day=6;s.vars.min=900;s.inv={kunai:5,shuriken:5,smoke_bomb:2,wire:2,bandage:2};s.quests.day1={st:'done',step:5,day:1};G.story.poll=()=>false;G.life.RATE=0;G.audio.enabled=false;G.debug.on=false;G.scenes.fade={a:0,dir:0,speed:3,then:null};G.scenes.replace(G.scenes.make('world',G.world.outsideOf(G.world.heroHome())));});}
async function tapId(id){const p=await page.evaluate(id=>{const h=G.scenes.top().buttons().find(x=>x.id===id);if(!h)throw Error('Нет кнопки '+id);const r=G.screen.canvas.getBoundingClientRect();return{x:r.x+(h.x+h.w/2)*r.width/G.screen.W,y:r.y+(h.y+h.h/2)*r.height/G.screen.H};},id);await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(100);}
const FAILS=[];
for(const [width,height]of [[320,568],[393,759],[430,932]])for(const density of ['big','mid','fine']){
  await page.setViewportSize({width,height});await seed();await page.evaluate(d=>{G.storage.settings.density=d;G.screen.resize();G.state.flags.tech_chakra_shot=1;G.scenes.push(G.scenes.make('battle',{enemy:'dummy',mode:'spar'},()=>{}));},density);await page.waitForFunction(()=>G.scenes.top().state==='menu',null,{timeout:6000}).catch(async()=>{await page.evaluate(()=>{G.input.tapNow={x:5,y:5};});await page.waitForFunction(()=>G.scenes.top().state==='menu');});await page.waitForTimeout(70);
  const info=await page.evaluate(()=>{const b=G.scenes.top(),rects=b.openMenu('main'),r=G.screen.canvas.getBoundingClientRect();return {W:G.screen.W,H:G.screen.H,scale:r.width/G.screen.W,rects};});
  assert.ok(info.rects.length>=8,'Карты и команды панели');
  for(const r of info.rects){assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=info.W&&r.y+r.h<=info.H,'Кнопка за экраном '+JSON.stringify({r,info:{W:info.W,H:info.H}}));assert.ok(r.w*info.scale>=43.9&&r.h*info.scale>=43.9,'Малая кнопка '+JSON.stringify({r,scale:info.scale,width,density}));}
  for(let i=0;i<info.rects.length;i++)for(let j=i+1;j<info.rects.length;j++){const a=info.rects[i],b=info.rects[j];assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),'Пересечение кнопок '+a.id+'/'+b.id);}
  const card=await page.evaluate(()=>{const s=G.scenes.top(),c=s.D.hand.slice(1).find(c=>G.duel.canPlay(s.D,c).ok)||s.D.hand[0];return 'card:'+c.uid;});
  await tapId(card);await tapId('play');const played=await page.evaluate(()=>({phase:G.scenes.top().phase,cards:G.scenes.top().D.stats.cards,ap:G.scenes.top().D.P.ap}));
  assert.equal(played.cards,1,'Карта разыграна касанием: '+width+'x'+height+' / '+density);assert.equal(played.ap,2);assert.notEqual(played.phase,'mini');
  console.log('✔ Карточные касания и кнопки >=44 CSS: '+width+'x'+height+' / '+density);
  if(width===393&&density==='fine'){await page.waitForTimeout(800);await page.screenshot({path:path.join(shots,'battle-393x759.png')});}
}
await seed();const lighting=await page.evaluate(()=>{
  G.state.vars.min=22*60;G.storage.settings.fx=true;
  const c=G.gfx.canvas(100,100),ctx=c.getContext('2d');ctx.fillStyle='#101820';ctx.fillRect(0,0,100,100);
  const lamp={kind:'lamp',x:50,y:55},wall={isBuilding:true,x:54,y:38,w:8,h:30,box:{x:54,y:38,w:8,h:30}};
  G.lighting.draw(ctx,{map:{id:'occlusion-test',outdoor:true},time:1},[lamp,wall],0,0,100,100);
  const px=(x,y)=>Array.from(ctx.getImageData(x*G.gfx.HI,y*G.gfx.HI,1,1).data);return {left:px(32,50),behind:px(70,50),morning:G.lighting.daylight(540),evening:G.lighting.daylight(1080)};
});assert.ok(lighting.left[0]>lighting.behind[0]+8,JSON.stringify(lighting));assert.ok(lighting.morning.x>0&&lighting.evening.x<0);console.log('✔ Стена преграждает свет, направление теней меняется утром и вечером');
for(const [name,min]of [['day',540],['sunset',1080],['night',1320]]){await page.evaluate(min=>{const w=G.scenes.top(),b=w.map.buildings.find(b=>b.tplId==='clan_hyuga');w.setMap(G.world.outsideOf(b));G.state.vars.min=min;w.notes=[];w.banner=null;w.toast=null;w.updateCamera();},min);await page.waitForTimeout(160);await page.screenshot({path:path.join(shots,'map-'+name+'.png')});}
const perf=await page.evaluate(()=>{const w=G.scenes.top(),c=G.gfx.canvas(G.screen.W,G.screen.H),ctx=c.getContext('2d'),state=JSON.stringify(G.state),a=[];for(let i=0;i<60;i++){const t=performance.now();w.draw(ctx);a.push(performance.now()-t);}a.sort((a,b)=>a-b);return {median:a[30],p95:a[57],pure:state===JSON.stringify(G.state)};});assert.equal(perf.pure,true);assert.ok(perf.median<35,JSON.stringify(perf));console.log('✔ Отрисовка не меняет сохранение; время кадра: '+JSON.stringify(perf));
assert.deepEqual(errors,[]);console.log('✔ Ошибок JavaScript нет');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
