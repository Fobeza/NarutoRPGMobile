// Жители сохраняют личности и маршруты; животные и эффекты не меняют геометрию деревни.
'use strict';
const assert=require('node:assert/strict'),h=require('./harness'),{G}=h;
let passed=0,failed=0;
function reset(){G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};h.seed(s=>{s.flags.hosp_done=1;s.flags.frd_init=1;s.vars.day=6;s.vars.min=600;s.inv={};});G.game.pending=null;G.storage.settings.fx=true;}
function world(){const w=G.scenes.make('world',G.world.outsideOf(G.world.heroHome()));G.scenes.push(w);return w;}
function test(name,fn){reset();try{fn();passed++;console.log('  ✔ '+name);}catch(e){failed++;console.log('  ✘ '+name+': '+e.stack);}}
function worker(w){for(const n of w.npcs.filter(G.villageDaily.generic)){Object.assign(w.player,{x:n.x+60,y:n.y+60});n.moving=false;n.path=null;for(let i=0;i<6;i++)G.villageDaily.tickNpc(w,n,1);if(n._daily.busy>0)return n;}throw Error('Нет жителя на свободной площадке');}
test('Дворовые животные появляются у ориентиров без новых людей, объектов и коллизий',()=>{
  const w=world(),m=w.map,npcs=m.npcs.length,objects=m.objects.length,block=Array.from(m.block),s=G.villageDaily.ensure(w);
  assert.equal(s.animals.length,16);assert.equal(s.animals.filter(a=>a.type==='cat').length,4);assert.equal(s.animals.filter(a=>a.type==='bird').length,11);
  for(const a of s.animals)assert.ok(!m.blockedRect({x:a.x-5,y:a.y-5,w:10,h:5}),a.name);
  assert.equal(m.npcs.length,npcs);assert.equal(m.objects.length,objects);assert.deepEqual(Array.from(m.block),block);
});
test('Кошки гуляют по проходимым клеткам, не перескакивают стены и реагируют на ласку',()=>{
  const w=world(),s=G.villageDaily.ensure(w),a=s.animals.find(a=>a.type==='cat');Object.assign(w.player,{x:a.x+60,y:a.y});const start={x:a.x,y:a.y};let moved=0;
  for(let i=0;i<800;i++){const prev={x:a.x,y:a.y};w.time+=.05;G.villageDaily.update(w,.05);assert.ok(Math.hypot(a.x-prev.x,a.y-prev.y)<1.5);assert.ok(!w.map.blockedRect({x:a.x-5,y:a.y-5,w:10,h:5}));moved+=Math.hypot(a.x-prev.x,a.y-prev.y);}
  assert.ok(moved>8);Object.assign(w.player,{x:a.x,y:a.y+15,dir:'up'});const action=G.villageDaily.probe(w);assert.equal(action.label,'Погладить');const mood=G.state.vars.mood;action.run();assert.equal(a.path.length,0);assert.ok(a.pet>0);assert.equal(G.state.vars.mood,mood+2);G.villageDaily.pet(w,a);assert.equal(G.state.vars.mood,mood+2);
});
test('Птицы взлетают при приближении героя и садятся на доступную землю',()=>{
  const w=world(),a=G.villageDaily.ensure(w).animals.find(a=>a.type==='bird');Object.assign(w.player,{x:a.x+10,y:a.y});G.villageDaily.update(w,.1);assert.ok(a.flight);const target={x:a.flight.x1,y:a.flight.y1};Object.assign(w.player,{x:a.x+120,y:a.y+80});
  for(let i=0;i<40;i++){w.time+=.05;G.villageDaily.update(w,.05);}assert.equal(a.flight,null);assert.ok(!w.map.blockedRect({x:target.x-5,y:target.y-5,w:10,h:5}));
});
test('Дождь и ночь убирают дневных птиц, мокрые следы затухают и ограничены по числу',()=>{
  const w=world(),s=G.villageDaily.ensure(w),a=s.animals.find(a=>a.type==='bird'),rain=G.life.raining;Object.assign(w.player,{x:a.x+80,y:a.y});G.life.raining=()=>false;G.villageDaily.update(w,1);assert.equal(a.alpha,1);
  try{G.life.raining=()=>true;w.player.moving=true;for(let i=0;i<100;i++){w.player.x+=2;G.villageDaily.update(w,.05);}assert.equal(a.alpha,0);assert.ok(s.tracks.length>0&&s.tracks.length<=44);w.player.moving=false;for(let i=0;i<100;i++)G.villageDaily.update(w,.05);assert.equal(s.tracks.length,0);}finally{G.life.raining=rain;}
  G.state.vars.min=23*60;G.villageDaily.update(w,2);assert.ok(s.animals.every(a=>a.alpha===0));
});
test('Работа использует настоящего жителя, после отдыха он гуляет без телепортации',()=>{
  const w=world(),count=w.map.npcs.length,n=worker(w),uid=n.uid,x=n.x,y=n.y;assert.ok(n._daily.busy>0);assert.ok(G.VILLAGE_DAILY.jobs[n._daily.role]);
  let distance=0;for(let i=0;i<600;i++){const px=n.x,py=n.y;G.villageDaily.tickNpc(w,n,.05);distance+=Math.hypot(n.x-px,n.y-py);assert.ok(Math.hypot(n.x-px,n.y-py)<3);assert.ok(!w.map.blockedRect(G.actors.feet(n)));}
  assert.ok(distance>4);assert.equal(n.uid,uid);assert.equal(w.map.npcs.length,count);
});
test('Переход к дому или работе имеет приоритет над повседневной анимацией',()=>{
  const w=world(),n=worker(w),old=G.residents.tick;n._daily.path=[[4,5]];
  G.residents.tick=()=>true;try{w.updateNpc(n,.1);assert.equal(n._daily.busy,0);assert.equal(n._daily.path.length,0);}finally{G.residents.tick=old;}
});
test('Помощь соседу расходует три минуты, сохраняется и не даёт повторной награды',()=>{
  const w=world(),n=worker(w);n._daily.role='sweep';n._daily.busy=5;const v=G.state.vars,min=v.min,money=v.money;assert.equal(G.villageDaily.label(n),'Помочь');assert.ok(G.villageDaily.help(n,w));assert.equal(v.min,min+3);assert.equal(v.money,money);assert.equal(G.villageDaily.help(n,w),false);n._daily.busy=5;assert.equal(G.villageDaily.label(n),null);
  w.savePos();G.storage.save(G.state);assert.ok(G.storage.valid({v:2,state:G.state}));assert.ok(G.storage.load().daily['daily_help_'+n.uid]);
});
test('Сюжетные персонажи не получают работу, текущий квест важнее предложения помочь',()=>{
  const w=world();const canon=w.map.npcs.find(n=>G.SCHED[n.id]);assert.ok(canon);assert.equal(G.villageDaily.tickNpc(w,canon,10),false);
  const n=worker(w);n._daily.role='sweep';n._daily.busy=4;Object.assign(w.player,{x:n.x,y:n.y+22,dir:'up'});w.npcs=[n];w.others=[w.player,n];const script=G.quests.scriptFor,talk=w.talk;let used=null;
  G.quests.scriptFor=()=> 'quest_missing_items';w.talk=t=>used=t;try{w._actionKey=null;w.interact();assert.equal(used,'quest_missing_items');}finally{G.quests.scriptFor=script;w.talk=talk;}
  const lamp=w.map.objects.find(o=>o._villageLamp),cat=G.villageDaily.ensure(w).animals.find(a=>a.type==='cat');w.npcs=[];w._streetScene=null;Object.assign(cat,{x:lamp.x,y:lamp.y,alpha:1});Object.assign(w.player,{x:lamp.x,y:lamp.y+10,dir:'up'});w._actionKey=null;assert.notEqual(w.currentAction().label,'Погладить');assert.equal(w.currentAction().title,lamp.title);
});
test('Бельё колышется между кадрами; выключение эффектов возвращает обычный рисунок',()=>{
  const w=world(),o=w.map.objects.find(o=>o.kind==='laundry');assert.ok(o);const c1=h.recordingCtx(),c2=h.recordingCtx();w.time=0;assert.ok(G.villageDaily.drawObject(c1,w,o,o.img));w.time=1;G.villageDaily.drawObject(c2,w,o,o.img);assert.notDeepEqual(c1.log,c2.log);G.storage.settings.fx=false;assert.equal(G.villageDaily.drawObject(c1,w,o,o.img),false);
});
test('Деревенская жизнь не переносится в комнаты и экспедиции; новая игра очищает старые реакции',()=>{
  const w=world(),s=G.villageDaily.ensure(w);s.animals[0].pet=5;w.setMap({map:'adv:outpost',entry:true});G.villageDaily.update(w,1);assert.equal(w._dailyLife,null);assert.deepEqual(G.villageDaily.actors(w),[]);G.game.newState();G.state.started=true;G.state.flags.hosp_done=1;w.setMap(G.world.outsideOf(G.world.heroHome()));const fresh=G.villageDaily.ensure(w);assert.notEqual(fresh,s);assert.ok(fresh.animals.every(a=>a.pet===0));
});
test('Фоновые звуки не пытаются включить заблокированное аудио',()=>{
  const w=world(),ready=G.audio.ready,tone=G.audio.tone,noise=G.audio.noise;let calls=0;G.audio.ready=()=>false;G.audio.tone=G.audio.noise=()=>calls++;try{assert.equal(G.villageDaily.ambience(w),false);assert.equal(calls,0);}finally{G.audio.ready=ready;G.audio.tone=tone;G.audio.noise=noise;}
});
console.log(`ИТОГ повседневности: ✔ ${passed}  ✘ ${failed}`);process.exitCode=failed?1:0;
