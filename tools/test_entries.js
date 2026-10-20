// Реальный ввод у дверей и визуальные размеры животных и приветственных жестов.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const shots=path.join(__dirname,'shots','entries');fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:393,height:759},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/index.html');await page.waitForFunction('window.G&&G.worldMotion');
  await page.evaluate(()=>{
   const st=G.game.newState();st.started=true;st.hero.name='Кайто';st.hero.stats={tai:6,nin:5,gen:4,chakra:5,ctrl:5,spd:6,end:5,know:4};st.hero.skills=[];
   Object.assign(st.flags,{hosp_done:1,enrolled:1,day2_intro:1,roofs:1,home_seen:1,naruto_invited:1,ramen_done:1,frd_init:1,tip_clock:1});st.vars.day=6;st.vars.min=900;st.daily.lesson=1;st.quests.day1={st:'done',step:5,day:1};
   G.story.poll=()=>false;G.life.RATE=0;G.debug.on=false;G.audio.enabled=false;G.storage.settings.fx=true;G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};G.scenes.push(G.scenes.make('world',G.world.outsideOf(G.world.heroHome())));const w=G.scenes.top();w.notes=[];w.banner=null;w.toast=null;
  });
  const idle=()=>page.waitForTimeout(150);
  async function shot(name){await page.screenshot({path:path.join(shots,name+'.png')});}
  async function tapA(){const p=await page.evaluate(()=>{const r=G.screen.canvas.getBoundingClientRect();return{x:r.x+(G.screen.W-27)*r.width/G.screen.W,y:r.y+(G.screen.H-51)*r.height/G.screen.H};});await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(650);}
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(1300);await page.keyboard.up('ArrowUp');await idle();assert.equal(await page.evaluate('G.scenes.top().map.id'),'konoha');assert.equal(await page.evaluate('G.scenes.top().currentAction()?.label'),'Войти');await shot('enter-button');await tapA();
  assert.ok((await page.evaluate('G.scenes.top().map.id')).startsWith('in:'));await shot('inside');const interior=await page.evaluate('G.scenes.top().map.id');
  await page.keyboard.down('ArrowDown');await page.waitForTimeout(2000);await page.keyboard.up('ArrowDown');await idle();assert.equal(await page.evaluate('G.scenes.top().map.id'),interior);assert.equal(await page.evaluate('G.scenes.top().currentAction()?.label'),'Выйти');await shot('exit-button');
  await page.keyboard.down('KeyZ');await page.waitForTimeout(1100);assert.equal(await page.evaluate('G.scenes.top().map.id'),'konoha');await page.keyboard.up('KeyZ');await idle();assert.equal(await page.evaluate('G.scenes.busy'),false);console.log('✔ Ходьба не входит и не выходит, касание A входит, Z выходит без повторного перехода');
  await page.evaluate(()=>{const w=G.scenes.top(),b=w.map.buildings.find(b=>b.tplId==='books');Object.assign(w.player,G.world.outsideOf(b),{dir:'up'});w.updateCamera();w.notes=[];w.banner=null;w.toast=null;window.entryShop=b.interior.id;});await idle();assert.equal(await page.evaluate('G.scenes.top().currentAction()?.label'),'Войти');await page.keyboard.press('KeyZ');await page.waitForTimeout(650);assert.equal(await page.evaluate('G.scenes.top().map.id'),await page.evaluate('window.entryShop'));console.log('✔ Та же кнопка работает у лавки, а не только у дома героя');
  // Границы непрозрачного силуэта: тень не входит в измерение. Проверяется настоящий Canvas.
  const metrics=await page.evaluate(()=>{
   const w=G.scenes.top();w.setMap(G.world.outsideOf(G.world.heroHome()));G.villageDaily.ensure(w);w.time=1;
   function bounds(c){const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let x0=c.width,y0=c.height,x1=0,y1=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(d[(y*c.width+x)*4+3]>110){x0=Math.min(x,x0);y0=Math.min(y,y0);x1=Math.max(x,x1);y1=Math.max(y,y1);}return{w:x1-x0+1,h:y1-y0+1};}
   const result={};
   for(const id of ['villager_m','villager_f','grandma','kid_m','kid_f']){
    const n=G.actors.make(id,24,36);n._look=0;n.dir='down';n.moving=false;const base=G.gfx.canvas(48,48),wave=G.gfx.canvas(48,48);w.drawActor(base.getContext('2d'),n);n._gesture={kind:'wave',until:9};w.drawActor(wave.getContext('2d'),n);result[id]={base:bounds(base),wave:bounds(wave)};
   }
   for(const fx of [true,false]){G.storage.settings.fx=fx;for(const type of ['cat','dog']){const a=w._dailyLife.animals.find(a=>a.type===type);Object.assign(a,{x:24,y:36,alpha:1,moving:false,pet:0});const c=G.gfx.canvas(48,48);G.villageDaily.drawAnimal(c.getContext('2d'),w,a);result[type+'_'+fx]=bounds(c);}}
   G.storage.settings.fx=true;return result;
  });
  fs.writeFileSync(path.join(shots,'metrics.json'),JSON.stringify(metrics,null,2));
  const human=metrics.villager_m.base.h;for(const key of ['cat_true','cat_false','dog_true','dog_false'])assert.ok(metrics[key].h<human*.65,JSON.stringify(metrics));
  for(const id of ['villager_m','villager_f','grandma','kid_m','kid_f']){assert.ok(metrics[id].wave.h<=metrics[id].base.h+6,id+JSON.stringify(metrics[id]));assert.ok(metrics[id].wave.w<=metrics[id].base.w+10,id+JSON.stringify(metrics[id]));}
  console.log('✔ Силуэты кошек и пса ниже 65% роста жителя; жесты пяти типов жителей остаются в естественных размерах');
  for(const size of [{width:320,height:568},{width:393,height:759},{width:820,height:1180}]){await page.setViewportSize(size);await idle();await page.evaluate(()=>{const w=G.scenes.top(),b=G.world.heroHome();w.setMap(G.world.outsideOf(b));w.player.dir='up';w._actionKey=null;if(w.touch().action?.label!=='Войти')throw Error('Нет кнопки у двери');});}
  await page.evaluate(()=>{const w=G.scenes.top();w.savePos();G.storage.save(G.state);if(!G.storage.load())throw Error('Сохранение не читается');});assert.deepEqual(errors,[]);console.log('✔ Три размера экрана, подсказка двери и сохранение; ошибок JavaScript нет');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
