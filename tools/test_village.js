// Браузерные регрессии живой деревни. Node + Playwright; игра не получает новых зависимостей.
// GAME_URL — адрес игры, CHROME_EXECUTABLE — необязательный путь к установленному Chrome.
// PLAYWRIGHT_MODULE — необязательный путь к уже установленному пакету playwright.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const shots=path.join(__dirname,'shots','village');fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:393,height:759},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(process.env.GAME_URL||'http://localhost:8765/index.html');
  await page.waitForFunction('window.G && G.villageStories');
  await page.evaluate(()=>{
    const st=G.game.newState();st.started=true;st.hero.name='Кайто';st.hero.stats={tai:6,nin:5,gen:4,chakra:5,ctrl:5,spd:6,end:5,know:4};st.hero.skills=[];
    Object.assign(st.flags,{hosp_done:1,enrolled:1,day2_intro:1,roofs:1,home_seen:1,naruto_invited:1,ramen_done:1,frd_init:1});
    st.vars.day=3;st.vars.min=15*60;st.quests.day1={st:'done',step:5,day:1};st.inv={wire:1};
    // Фиксированное время и отключённые автоматические сюжетные сцены изолируют проверку новых действий.
    G.life.RATE=0;G.story.poll=()=>false;G.debug.on=false;G.storage.settings.textSpeed=0;
    G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};
    G.scenes.push(G.scenes.make('world',G.world.outsideOf(G.world.heroHome())));
  });
  const auditCode='('+fs.readFileSync(path.join(__dirname,'audit_rooms.py'),'utf8').match(/JS = r"""([\s\S]*?)"""/)[1]+')()';
  const audit=async()=>{const rows=await page.evaluate(auditCode);assert.ok(rows.every(r=>!r.iss?.length),JSON.stringify(rows.filter(r=>r.iss?.length)));return rows;};
  assert.equal((await audit()).length,32);
  await page.evaluate(()=>{const w=G.scenes.top(),o=w.map.objects.find(o=>o._villageLamp);w.npcs=[];Object.assign(w.player,{x:o.x,y:o.y+10,dir:'up'});w.updateCamera();});
  await page.waitForTimeout(180);
  const point=await page.evaluate(()=>{const r=G.screen.canvas.getBoundingClientRect(),k=r.width/G.screen.W;return{x:r.x+(G.screen.W-26)*k,y:r.y+(G.screen.H-52)*k};});
  await page.touchscreen.tap(point.x,point.y);await page.waitForTimeout(100);
  assert.equal(await page.evaluate('G.scenes.top().name'),'dialog:village_lantern',await page.evaluate(()=>{const w=G.scenes.top();return JSON.stringify({action:w.currentAction?.()?.label,toast:w.toast,player:w.player,animals:w._dailyLife?.animals.filter(a=>Math.hypot(a.x-w.player.x,a.y-w.player.y)<36).map(a=>({name:a.name,x:a.x,y:a.y}))});}));
  async function close(){for(let i=0;i<60;i++){if(await page.evaluate('G.scenes.top().name')==='world')return;await page.keyboard.press('KeyZ');await page.waitForTimeout(60);}throw Error('Диалог не завершился');}
  await close();assert.equal(await page.evaluate("G.quests.active('street_lantern')"),true);
  await page.evaluate(()=>{const w=G.scenes.top();w.npcs=[];w._streetScene=null;w._streetCheck=99;w._actionKey=null;});
  await page.waitForTimeout(120);await page.keyboard.press('KeyZ');await page.waitForTimeout(100);await close();
  assert.equal(await page.evaluate("G.quests.done('street_lantern') && G.game.count('wire')===0 && G.state.vars.money===345"),true);
  assert.equal(await page.evaluate("G.world.konoha().objects.find(o=>o._villageLamp).kind"),'lamp');
  console.log('✔ Фонарь: сенсорная кнопка, проволока и однократная награда');
  for(const id of ['market','training','shelter','shogi']){
    await page.evaluate(id=>{
      const w=G.scenes.top(),s=G.villageStories.scenes.find(s=>s.id===id),b=w.map.buildings.find(b=>b.tplId===s.tpl),p=G.world.outsideOf(b);
      G.state.vars.min=(s.hours[0]+0.5)*60;G.state.vars.day=id==='shelter'?Array.from({length:50},(_,i)=>i+2).find(d=>G.life.weather(d)==='rain'):3;
      Object.assign(w.player,{x:p.x,y:p.y+24,dir:'up'});w._streetScene=null;w._streetCheck=0;
      G.villageStories.update(w,1);G.villageStories.update(w,1);w.updateCamera();w.banner=null;w.notes=[];w.toast=null;
    },id);
    await page.waitForTimeout(100);assert.equal(await page.evaluate('G.scenes.top()._streetScene?.def.id'),id);
    await page.screenshot({path:path.join(shots,'street-'+id+'.png')});
  }
  console.log('✔ Четыре уличные сцены и правильная погода');
  const jump=await page.evaluate(()=>{
    const w=G.scenes.top(),life=G.roofPatrol.build(w.map);let airborne=0;
    for(let i=0;i<600;i++){G.roofPatrol.update(w,.05);w.time+=.05;airborne+=life.patrols.filter(p=>p.jump).length;}
    G.roofPatrol.draw(G.screen.ctx,w,w.cam.x,w.cam.y,G.screen.W,G.screen.H);
    return airborne;
  });assert.ok(jump>100);
  console.log('✔ Бег и прыжки патрульных в настоящем Canvas');
  await page.evaluate(()=>{
    for(const e of G.villageStories.effects){if(!G.quests.state(e.quest))G.quests.start(e.quest);if(!G.quests.done(e.quest))G.quests.complete(e.quest);}
    G.scenes.top().savePos();G.storage.save(G.state);
    if(!G.storage.load())throw Error('Сохранение не загрузилось');
  });
  await audit();console.log('✔ Все последствия: комнаты доступны, сохранение читается');
  for(const density of ['big','mid','fine']){
    await page.evaluate(d=>{G.storage.settings.density=d;G.screen.resize();G.scenes.top().updateCamera();},density);
    await page.waitForTimeout(60);assert.ok(await page.evaluate('G.screen.W>=192 && G.screen.H>=200'));
  }
  assert.deepEqual(errors,[]);console.log('✔ Три мобильных масштаба; ошибок JavaScript нет');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
