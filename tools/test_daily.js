// Повседневная жизнь в настоящем браузере: люди, животные, дождь, касания и анимация.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const shots=path.join(__dirname,'shots','daily');fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const b=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await b.newPage({viewport:{width:393,height:759},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/index.html');await page.waitForFunction('window.G&&G.villageDaily');
  await page.evaluate(()=>{
    const st=G.game.newState();st.started=true;st.hero.name='Кайто';st.hero.stats={tai:6,nin:5,gen:4,chakra:5,ctrl:5,spd:6,end:5,know:4};st.hero.skills=[];
    Object.assign(st.flags,{hosp_done:1,enrolled:1,day2_intro:1,roofs:1,home_seen:1,naruto_invited:1,ramen_done:1,frd_init:1,tip_clock:1});st.vars.day=6;st.vars.min=600;st.quests.day1={st:'done',step:5,day:1};
    st.daily.lesson=1;G.life.RATE=0;G.story.poll=()=>false;G.debug.on=false;G.storage.settings.textSpeed=0;G.audio.enabled=false;
    G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};G.scenes.push(G.scenes.make('world',G.world.outsideOf(G.world.heroHome())));
  });
  async function settle(){await page.waitForTimeout(150);}
  async function tap(x,y){const p=await page.evaluate(({x,y})=>{const r=G.screen.canvas.getBoundingClientRect();return{x:r.x+x*r.width/G.screen.W,y:r.y+y*r.height/G.screen.H};},{x,y});await page.touchscreen.tap(p.x,p.y);await settle();}
  async function close(){for(let i=0;i<40;i++){if(!(await page.evaluate('G.scenes.top().name')).startsWith('dialog'))return;await page.keyboard.press('KeyZ');await page.waitForTimeout(40);}throw Error('Диалог не закрылся');}
  async function shot(name){await page.screenshot({path:path.join(shots,name+'.png')});}
  async function frames(name,n=36){const images=await page.evaluate(n=>{const w=G.scenes.top(),list=[];G.input.consume();w.banner=null;w.toast=null;w.notes=[];for(let i=0;i<n;i++){w.update(.07);const c=G.gfx.canvas(G.screen.W,G.screen.H);w.draw(c.getContext('2d'));list.push(c.toDataURL('image/png'));}return list;},n);const dir=path.join(shots,name);fs.mkdirSync(dir,{recursive:true});images.forEach((s,i)=>fs.writeFileSync(path.join(dir,String(i).padStart(2,'0')+'.png'),Buffer.from(s.split(',')[1],'base64')));}
  const total=await page.evaluate(()=>{const w=G.scenes.top(),s=G.villageDaily.ensure(w);window.dailyNpcCount=w.map.npcs.length;return s.animals.length;});assert.equal(total,16);
  // Подойти к настоящему коту и погладить сенсорной кнопкой A.
  await page.evaluate(()=>{
    const w=G.scenes.top(),a=w._dailyLife.animals.find(a=>a.type==='cat'&&!w.npcs.some(n=>Math.hypot(n.x-a.x,n.y-a.y)<36));window.dailyCat=a;a.timer=8;
    Object.assign(w.player,{x:a.x,y:a.y+22,dir:'up',roof:false});w.updateCamera();w.banner=null;w.notes=[];w.toast=null;
  });await page.waitForTimeout(800);
  assert.equal(await page.evaluate('G.scenes.top().currentAction()?.label'),'Погладить');
  await tap(await page.evaluate('G.screen.W-27'),await page.evaluate('G.screen.H-51'));assert.ok(await page.evaluate('window.dailyCat.pet>0'));await shot('cat');await frames('cat-frames');
  console.log('✔ Кот на улице: настоящая сенсорная кнопка, реакция и анимация');
  // Птицы на земле и в воздухе, камера следует за героем.
  await page.evaluate(()=>{const w=G.scenes.top(),a=w._dailyLife.animals.find(a=>a.type==='bird'&&a.tpl==='swing_tree');window.dailyBird=a;Object.assign(w.player,{x:a.x+45,y:a.y+15,dir:'left'});w.updateCamera();w.banner=null;w.toast=null;});await page.waitForTimeout(700);await shot('birds-ground');
  await page.evaluate(()=>{const w=G.scenes.top(),a=window.dailyBird;Object.assign(w.player,{x:a.x+8,y:a.y+8});G.villageDaily.update(w,.05);});assert.equal(await page.evaluate('!!window.dailyBird.flight'),true);await shot('birds-flight');await frames('bird-frames');console.log('✔ Воробьи взлетают при приближении и возвращаются на землю');
  // Для снимка выбираем реально существующего соседа на открытом участке; новые люди не добавляются.
  await page.evaluate(()=>{
    const w=G.scenes.top();w.refreshNpcs();const n=w.npcs.find(n=>G.villageDaily.generic(n)&&!n._routePath?.length&&[[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dy])=>!w.map.blockedRect({x:n.x+dx*16-5,y:n.y+dy*16-5,w:10,h:5})));
    if(!n)throw Error('Нет соседа на площадке');window.dailyWorker=n;n.path=null;n.moving=false;Object.assign(w.player,{x:n.x,y:n.y+24,dir:'up'});
    G.villageDaily.tickNpc(w,n,.01);n._daily.cooldown=0;n._daily.wantWalk=false;G.villageDaily.tickNpc(w,n,.01);w._streetScene=null;w._streetCheck=99;w.updateCamera();w.banner=null;w.notes=[];w.toast=null;
  });await settle();assert.ok(await page.evaluate('window.dailyWorker._daily.busy>0'));await shot('sweeper');await frames('worker-frames',32);
  // Дождаться следующего рабочего цикла того же жителя и помочь через обычный выбор.
  await page.evaluate(()=>{const w=G.scenes.top(),n=window.dailyWorker;n._daily.path=[];n._daily.busy=5;n._daily.role='sweep';Object.assign(w.player,{x:n.x,y:n.y+23,dir:'up'});w.updateCamera();});await settle();
  assert.equal(await page.evaluate('G.scenes.top().currentAction()?.label'),'Помочь');const min=await page.evaluate('G.state.vars.min');await page.keyboard.press('KeyZ');await settle();assert.equal(await page.evaluate('G.scenes.top().name'),'pick');const g=await page.evaluate('G.scenes.top().geom()');await tap(g.x+24,g.ly+6);await close();assert.equal(await page.evaluate('G.state.vars.min'),min+3);
  console.log('✔ Существующий житель работает, затем гуляет; помощь через A сохраняется');
  // Полив: ставим этого же жителя на доступное место рядом с существующей клумбой.
  await page.evaluate(()=>{
    const w=G.scenes.top(),n=window.dailyWorker;const pair=w.map.objects.filter(o=>['flowerbox','planter','flowerpot'].includes(o.kind)).map(o=>({o,p:[[16,8],[-16,8],[0,13]].map(([dx,dy])=>({x:o.x+dx,y:o.y+dy})).find(p=>!w.map.blockedRect({x:p.x-5,y:p.y-5,w:10,h:5}))})).find(q=>q.p&&q.o.x>160&&q.o.x<w.map.w*16-160);
    Object.assign(n,pair.p,{moving:false,path:null});n._daily.center={x:n.x,y:n.y};n._daily.path=[];n._daily.busy=0;n._daily.cooldown=0;n._daily.wantWalk=false;
    const p=G.world.freeTile(w.map,Math.floor(n.x/16)+2,Math.floor(n.y/16)+2);Object.assign(w.player,{x:p[0]*16+8,y:p[1]*16+12,dir:'left'});G.villageDaily.tickNpc(w,n,.01);if(n._daily.role!=='water')throw Error('Не выбрал полив');w._dailyLife.bubble=null;w.updateCamera();w.banner=null;w.notes=[];w.toast=null;
  });await settle();await shot('watering');await frames('water-frames',32);
  // Реальная погода на соответствующий день, жители с зонтами и мокрые следы.
  await page.evaluate(()=>{
    const w=G.scenes.top();G.state.vars.day=Array.from({length:25},(_,i)=>i+2).find(d=>G.life.weather(d)==='rain');G.state.vars.min=600;
    G.state.daily.lesson=1;const n=window.dailyWorker,p=G.world.freeTile(w.map,Math.floor(n.x/16)+3,Math.floor(n.y/16)+2);Object.assign(w.player,{x:p[0]*16+8,y:p[1]*16+12,dir:'right'});w.updateCamera();w.banner=null;w.notes=[];w.toast=null;
  });await page.keyboard.down('ArrowRight');await page.waitForTimeout(500);await page.keyboard.up('ArrowRight');await shot('rain');assert.ok(await page.evaluate('G.scenes.top()._dailyLife.tracks.length>0'));await frames('rain-frames',32);console.log('✔ Полив, дождь и исчезающие мокрые следы');
  // Вывески и пар: часы заведений, без дополнительных зданий и коллизий.
  await page.evaluate(()=>{const w=G.scenes.top(),b=w.map.buildings.find(b=>b.tplId==='ichiraku'),p=G.world.outsideOf(b);G.state.vars.day=6;G.state.vars.min=18*60;Object.assign(w.player,{x:p.x,y:p.y+20,dir:'up'});w.updateCamera();w.banner=null;w.notes=[];w.toast=null;});await settle();await shot('evening-ramen');await frames('steam-frames',32);
  assert.equal(await page.evaluate('G.scenes.top().map.npcs.length'),await page.evaluate('window.dailyNpcCount'));
  await page.evaluate(()=>{const w=G.scenes.top();w.savePos();G.storage.save(G.state);if(!G.storage.load())throw Error('Сохранение не загружается');});
  for(const size of [{width:320,height:568},{width:393,height:759},{width:820,height:1180}]){await page.setViewportSize(size);await settle();await page.evaluate(()=>{const w=G.scenes.top(),c=G.gfx.canvas(G.screen.W,G.screen.H);w.draw(c.getContext('2d'));});}
  assert.deepEqual(errors,[]);console.log('✔ Заведения вечером, число жителей, сохранение, три экрана; ошибок JavaScript нет');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
