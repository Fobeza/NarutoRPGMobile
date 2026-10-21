// Проверка дополнения в настоящем браузере: ввод, переходы, маршруты, мини-шоги и сохранение.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const shots=path.join(__dirname,'shots','adventures');fs.mkdirSync(shots,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:393,height:759},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/index.html');await page.waitForFunction('window.G && G.adventure');
  await page.evaluate(()=>{
    const st=G.game.newState();st.started=true;st.hero.name='Кайто';st.hero.stats={tai:7,nin:7,gen:5,chakra:7,ctrl:7,spd:7,end:7,know:6};st.hero.skills=[];
    Object.assign(st.flags,{hosp_done:1,enrolled:1,day2_intro:1,roofs:1,home_seen:1,naruto_invited:1,ramen_done:1,frd_init:1});
    st.vars.day=3;st.vars.min=900;st.quests.day1={st:'done',step:5,day:1};G.life.RATE=0;G.story.poll=()=>false;G.debug.on=false;G.storage.settings.textSpeed=0;G.audio.enabled=false;
    G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};G.scenes.push(G.scenes.make('world',G.world.outsideOf(G.world.heroHome())));
  });
  const idle=()=>page.waitForTimeout(90);
  async function close(){for(let i=0;i<60;i++){if(!(await page.evaluate('G.scenes.top().name')).startsWith('dialog'))return;await page.keyboard.press('KeyZ');await page.waitForTimeout(35);}throw Error('Диалог не закрылся');}
  async function tapLocal(x,y){const p=await page.evaluate(({x,y})=>{const r=G.screen.canvas.getBoundingClientRect(),k=r.width/G.screen.W;return{x:r.x+x*k,y:r.y+y*k};},{x,y});await page.touchscreen.tap(p.x,p.y);await idle();}
  async function pick(i){const g=await page.evaluate('G.scenes.top().geom()');assert.equal(await page.evaluate('G.scenes.top().name'),'pick');if(i>=g.n){for(let j=0;j<i;j++)await page.keyboard.press('ArrowDown');await page.keyboard.press('KeyZ');await idle();}else await tapLocal(g.x+30,g.ly+i*18+7);}
  async function at(key,id){await page.evaluate(({key,id})=>{while(G.scenes.stack.length>1)G.scenes.pop();const w=G.scenes.top();w.setMap({map:key==='konoha'?'konoha':'adv:'+key,...(key==='konoha'?G.world.outsideOf(G.world.heroHome()):G.world.get('adv:'+key).spawn)});if(id){const o=w.map.objects.find(o=>o.adv===id);if(!o)throw Error('Нет объекта '+id);Object.assign(w.player,{x:o.x,y:o.y+12,dir:'up',roof:false,jump:null});}w.pendingTalk=null;w.notes=[];w.banner=null;w.toast=null;w.updateCamera();w._actionKey=null;},{key,id});await idle();}
  async function use(){await page.keyboard.press('KeyZ');await idle();}
  async function board(index){await page.evaluate(()=>G.adventure.menu());await pick(0);await pick(index);await close();}
  async function shot(name){await page.screenshot({path:path.join(shots,name+'.png')});}
  // Вход из обычного меню паузы, затем выбор задания настоящими касаниями.
  await page.keyboard.press('Escape');await idle();{const n=await page.evaluate(()=>G.scenes.top().labels().indexOf('Приключения'));for(let i=0;i<n;i++){await page.keyboard.press('ArrowDown');await idle();}}await page.keyboard.press('KeyZ');await idle();assert.equal(await page.evaluate('G.scenes.top().name'),'pick');await shot('hub');await pick(0);await pick(0);await close();
  await at('forest','tracks');await use();await close();await at('forest','prepare');await use();await pick(0);await close();await at('forest','cargo');await shot('forest');await use();await pick(0);await close();await board(0);
  assert.equal(await page.evaluate("G.quests.done('adv_cargo')&&G.state.flags.adv_cargo_peace===1&&G.state.vars.money===400"),true);console.log('✔ Мирная цепочка: разведка, подготовка, груз, отчёт — через A и касания');
  await board(1);await at('river','survey');await use();await close();await at('river','bridge');await use();await close();assert.equal(await page.evaluate("G.world.get('adv:river').get(18,14)===G.tiles.ID.PLANKS"),true);
  // Настоящее движение по построенной переправе.
  await page.evaluate(()=>{const w=G.scenes.top();Object.assign(w.player,{x:15*16+8,y:15*16+12,dir:'right'});w.updateCamera();});
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(1700);await page.keyboard.up('ArrowRight');assert.ok(await page.evaluate('G.scenes.top().player.x>21*16'));
  await at('river','rescue');await shot('river');await use();await pick(0);await close();await board(1);assert.equal(await page.evaluate("G.quests.done('adv_rescue')"),true);
  console.log('✔ Переправа меняет мир, герой проходит по ней, спасение завершается');
  await at('tower','archive_start');await use();await close();await at('tower','travel:tower2');await use();await page.waitForTimeout(600);assert.equal(await page.evaluate('G.scenes.top().map.id'),'adv:tower2');
  await at('tower2','book:seal');await shot('second-floor');await use();await close();await at('tower2','travel:balcony');await use();await page.waitForTimeout(600);assert.equal(await page.evaluate('G.scenes.top().map.id'),'adv:balcony');
  await at('balcony','seal');await shot('balcony');await use();await pick(0);await pick(2);await pick(1);await close();assert.equal(await page.evaluate('G.state.flags.adv_seal_open'),1);
  await at('balcony','cellar_door');await use();await page.waitForTimeout(600);assert.equal(await page.evaluate('G.scenes.top().map.id'),'adv:cellar');
  await at('cellar','book:clans');await use();await close();await at('outpost','book:genin');await use();await close();await at('cellar','guardian');await shot('archive');await use();await pick(0);await close();await board(2);assert.equal(await page.evaluate("!!(G.quests.done('adv_archive')&&G.state.flags.tech_doton)"),true);
  console.log('✔ Этажи, балкон, три печати, подвал, книги и мирное решение хранителя');
  await page.evaluate(()=>{G.state.vars.day=6;G.state.vars.min=1020;G.adventure.scheduleMeeting('hinata','river',7,1020);G.state.vars.day=7;});await at('river');await page.evaluate(()=>{const w=G.scenes.top(),p=G.adventure.meetingPoint(G.adventure.meeting());Object.assign(w.player,{x:p.x,y:p.y+18,dir:'up'});G.adventure.update(w,.1);w.updateCamera();});await idle();await shot('meeting');await use();await pick(1);await close();assert.equal(await page.evaluate('G.state.flags.adv_meet_attended'),1);
  await page.evaluate(()=>{G.scenes.push(G.scenes.make('calendar'));});await shot('calendar');await page.keyboard.press('KeyX');
  console.log('✔ Назначенная встреча, взаимодействие с другом и календарь');
  await at('tower','shogi');await use();assert.equal(await page.evaluate('G.scenes.top().name'),'shogi');await shot('shogi');
  const q=await page.evaluate(()=>{const W=G.screen.W,H=G.screen.H,size=Math.min(52,Math.floor((W-36)/3),Math.floor((H-180)/4));return{size,x:(W-size*3)/2,y:65};});
  await tapLocal(q.x+q.size*1.5,q.y+q.size*2.5);await tapLocal(q.x+q.size*1.5,q.y+q.size*1.5);await page.waitForTimeout(1200);assert.ok(await page.evaluate('G.scenes.top().state().ply>=2'));await page.keyboard.press('KeyX');console.log('✔ Мини-шоги: ход пальцем, взятие и ответ соперника');
  await page.evaluate(()=>G.adventure.startCourse(false));await idle();await shot('parkour');await page.keyboard.down('ArrowRight');await page.keyboard.down('ShiftLeft');await page.waitForTimeout(8000);await page.keyboard.up('ArrowRight');await page.keyboard.up('ShiftLeft');await close();assert.ok(await page.evaluate('G.state.vars.adv_course_best>0'));console.log('✔ Паркур пройден движением и настоящими прыжками');
  await page.evaluate(()=>G.adventure.startCourse(true));await page.keyboard.down('ArrowRight');await page.keyboard.down('ShiftLeft');await page.waitForTimeout(8000);await page.keyboard.up('ArrowRight');await page.keyboard.up('ShiftLeft');await close();assert.ok(await page.evaluate('G.state.vars.adv_chases>0'));console.log('✔ Посыльный догнан во время движения по крышам');
  for(const [day,name]of [[1,'spring'],[29,'summer'],[57,'autumn'],[85,'winter']]){await at('forest','season');await page.evaluate(day=>{G.state.vars.day=day;const w=G.scenes.top();G.adventure.syncSeason(w.map);w.updateCamera();},day);await idle();await shot(name);}
  await page.evaluate(()=>{G.state.flags.game_clear=1;G.state.flags.graduated=1;G.adventure.menu();});await pick(8);await shot('genin-missions');await page.keyboard.press('KeyX');
  await at('outpost');await page.evaluate(()=>{G.scenes.push(G.scenes.make('settings'));});await shot('settings');await page.keyboard.press('KeyX');
  await at('cellar');const before=await page.evaluate(()=>{G.scenes.top().savePos();G.storage.save(G.state);return JSON.stringify({quests:G.state.quests,pos:G.state.pos,flags:G.state.flags});});await page.reload();await page.waitForFunction('window.G&&G.adventure');const after=await page.evaluate(()=>{const st=G.storage.load();if(!st)throw Error('Не загружается сохранение');G.game.newState();G.state=G.game.fix(st);return JSON.stringify({quests:G.state.quests,pos:G.state.pos,flags:G.state.flags});});assert.equal(after,before);
  for(const viewport of [{width:320,height:568},{width:393,height:759},{width:820,height:1180}]){await page.setViewportSize(viewport);await page.evaluate(()=>{G.scenes.replace(G.scenes.make('shogi'));G.screen.resize();});await idle();assert.ok(await page.evaluate('G.screen.W>=192'));}
  assert.deepEqual(errors,[]);console.log('✔ Четыре сезона, интерфейс, сохранение после перезагрузки и три размера экрана; ошибок JavaScript нет');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
