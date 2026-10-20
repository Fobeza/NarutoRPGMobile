// Браузерная проверка и запись настоящих кадров: жесты, занятия, животные, ветер и вода.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const shots=path.join(__dirname,'shots','motion');fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:393,height:759},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/index.html');await page.waitForFunction('window.G&&G.worldMotion');
  await page.evaluate(()=>{
   const st=G.game.newState();st.started=true;st.hero.name='Кайто';st.hero.stats={tai:6,nin:5,gen:4,chakra:5,ctrl:5,spd:6,end:5,know:4};st.hero.skills=[];
   Object.assign(st.flags,{hosp_done:1,enrolled:1,day2_intro:1,roofs:1,home_seen:1,naruto_invited:1,ramen_done:1,frd_init:1,tip_clock:1});st.vars.day=6;st.vars.min=900;st.daily.lesson=1;st.quests.day1={st:'done',step:5,day:1};
   G.life.RATE=0;G.story.poll=()=>false;G.debug.on=false;G.audio.enabled=false;G.storage.settings.fx=true;
   G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};G.scenes.push(G.scenes.make('world',G.world.outsideOf(G.world.heroHome())));
   const w=G.scenes.top();G.villageDaily.ensure(w);window.motionCounts=[w.map.npcs.length,w.map.objects.length];
   window.motionClear=(x,y)=>!w.map.query({x:x-10,y:y-16,w:20,h:18}).some(o=>o.isBuilding&&o.sortY>y&&G.util.rectsOverlap({x:x-8,y:y-14,w:16,h:16},w.map.drawRect(o)));
   window.motionAt=(x,y)=>{window.motionTarget={x,y};const p=G.world.freeTile(w.map,x/16|0,(y+32)/16|0);Object.assign(w.player,{x:p[0]*16+8,y:p[1]*16+12,dir:'up',moving:false});w.updateCamera();w._streetScene=null;w._streetCheck=999;w._dailyLife.bubble=null;w.notes=[];w.toast=null;w.banner=null;};
  });
  async function record(name,count=40,dt=.08){
   const result=await page.evaluate(({count,dt})=>{
    const w=G.scenes.top(),images=[],before=JSON.stringify(G.state),blocks=Array.from(w.map.block).join();w.notes=[];w.toast=null;w.banner=null;if(window.motionPrepare)window.motionPrepare();
    for(let i=0;i<count;i++){w.time+=dt;const c=G.gfx.canvas(G.screen.W,G.screen.H);w.draw(c.getContext('2d'));images.push(c.toDataURL('image/png'));}
    if(JSON.stringify(G.state)!==before||Array.from(w.map.block).join()!==blocks)throw Error('Отрисовка изменила мир');return{images,target:{x:(window.motionTarget.x-w.cam.x)*2,y:(window.motionTarget.y-w.cam.y+28)*2}};
   },{count,dt});
   const dir=path.join(shots,name);fs.mkdirSync(dir,{recursive:true});result.images.forEach((s,i)=>fs.writeFileSync(path.join(dir,String(i).padStart(2,'0')+'.png'),Buffer.from(s.split(',')[1],'base64')));fs.writeFileSync(path.join(dir,'target.json'),JSON.stringify(result.target));assert.ok(new Set(result.images).size>count/2,name);
  }
  await page.evaluate(()=>{const w=G.scenes.top(),n=w.npcs.find(n=>G.villageDaily.generic(n)&&!G.quests.iconFor(n.id));window.motionNpc=n;n.moving=false;n.path=null;n._daily={owner:G.state,busy:0,role:'read',seed:0,cooldown:50,path:[]};window.motionAt(n.x,n.y);Object.assign(w.player,{x:n.x,y:n.y+24,dir:'up'});w.updateCamera();const s=w._dailyLife;s.greet=0;s.chat=99;s.workTalk=99;G.villageDaily.update(w,.01);if(n._gesture?.kind!=='wave')throw Error('Житель не поздоровался');});
  await record('greeting');console.log('✔ Приветствие вызывает взмах руки, поза покоя дышит');
  await page.evaluate(()=>{const w=G.scenes.top(),n=window.motionNpc;window.motionAt(n.x,n.y);n._gesture=null;n._daily.busy=8;n._daily.role='read';n.dir='down';n.moving=false;w.time=0;});await record('reading',40,.09);
  await page.evaluate(()=>{const w=G.scenes.top(),n=w.npcs.find(n=>n.id==='kid_m'&&n.uid&&window.motionClear(n.x,n.y));window.motionAt(n.x,n.y);window.motionPrepare=()=>{n._daily={owner:G.state,busy:8,role:'play',seed:0,path:[]};n.moving=false;n.dir='down';};});await record('ball');await page.evaluate(()=>window.motionPrepare=null);console.log('✔ Перелистывание книги, мяч с тенью и движения ребёнка');
  for(const type of ['cat','dog']){
   await page.evaluate(type=>{const w=G.scenes.top(),a=w._dailyLife.animals.find(a=>a.type===type&&window.motionClear(a.x,a.y));window.motionAt(a.x,a.y);a.alpha=1;a.pet=0;a.moving=false;a.path=[];a.timer=20;w.time=Math.ceil(a.serial*3.7/12)*12-a.serial*3.7;},type);
   await record(type,56,.16);
  }console.log('✔ Кошка умывается и потягивается, пёс нюхает землю и чешется');
  await page.evaluate(()=>{const w=G.scenes.top(),o=w.map.objects.find(o=>(o.kind==='flowerbox'||o.kind?.startsWith('fl_'))&&G.util.hash2(o.x,o.y,21)>.65&&window.motionClear(o.x,o.y));window.motionAt(o.x,o.y);G.state.vars.min=900;});await record('garden');
  await page.evaluate(()=>{const w=G.scenes.top(),b=w.map.spots.pier;window.motionAt(b.tx*16+12,(b.ty+b.th)*16+10);});await record('water',40,.12);
  await page.evaluate(()=>{const w=G.scenes.top();G.state.vars.day=9;G.state.daily.lesson=1;w.player.moving=true;w.player.anim=0;});await record('rain');
  console.log('✔ Ветер, бабочки, водная рябь, рыбки и круги дождя');
  // Отключение новых декоративных движений возвращает одинаковые кадры отдельного объекта.
  assert.equal(await page.evaluate(()=>{const w=G.scenes.top(),o=w.map.objects.find(o=>o.kind==='tree');G.storage.settings.fx=false;function sample(){const c=G.gfx.canvas(o.w+4,o.h+4),ctx=c.getContext('2d');ctx.translate(-o.x-o.ox+2,-o.y-o.oy+2);if(!G.villageDaily.drawObject(ctx,w,o,o.img))ctx.drawImage(o.img,o.x+o.ox,o.y+o.oy);return c.toDataURL();}const a=sample();w.time+=4;return a===sample();}),true);
  await page.evaluate(()=>{G.storage.settings.fx=true;});
  assert.deepEqual(await page.evaluate('[G.scenes.top().map.npcs.length,G.scenes.top().map.objects.length]'),await page.evaluate('window.motionCounts'));
  for(const size of [{width:320,height:568},{width:393,height:759},{width:820,height:1180}]){await page.setViewportSize(size);await page.waitForTimeout(100);await page.evaluate(()=>{const w=G.scenes.top(),c=G.gfx.canvas(G.screen.W,G.screen.H);w.draw(c.getContext('2d'));});}
  await page.evaluate(()=>{const w=G.scenes.top();w.savePos();G.storage.save(G.state);if(!G.storage.load())throw Error('Сохранение не читается');});assert.deepEqual(errors,[]);console.log('✔ Настройка эффектов, неизменные жители и объекты, сохранение, три экрана; ошибок JavaScript нет');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
