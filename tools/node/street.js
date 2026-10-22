// Необязательные события и память NPC: прохождение, сохранение, повторные награды.
'use strict';
const assert=require('node:assert/strict'),h=require('./harness'),{G}=h;
let passed=0,failed=0;
function world(){G.scenes.stack.length=0;h.seed(s=>{s.flags.hosp_done=1;s.flags.frd_init=1;s.vars.day=6;s.vars.min=900;});const w=G.scenes.make('world',G.world.outsideOf(G.world.heroHome()));G.scenes.push(w);w.talk=lines=>{w.lastTalk=lines;};return w;}
function test(name,fn){try{fn(world());passed++;console.log('  ✔ '+name);}catch(e){failed++;console.log('  ✘ '+name+': '+e.stack);}}
function touch(w,n){w.player.x=n.x;w.player.y=n.y+12;w.player.dir='up';assert.ok(G.streetLife.interact(w,n));}
function choose(i){const s=G.scenes.top();assert.equal(s.name,'pick');s.choose(i);}
test('Все три события доступны, точки безопасны, отрисовка не запускает историю',w=>{
 const nodes=G.streetLife.ensure(w);assert.equal(nodes.length,8);assert.equal(G.streetLife.ensure(w),nodes);
 const before=JSON.stringify(G.state),ctx=h.recordingCtx();
 for(const n of nodes){assert.ok(!w.map.blockedRect(G.actors.feet(n)));if(n.id)w.drawActor(ctx,n);}
 G.streetLife.draw(ctx,w);assert.equal(JSON.stringify(G.state),before);assert.equal(G.streetLife.progress('apples'),0);
 const grid=Array.from(G.nav.walkGrid(w.map));G.streetLife.ensure(w);assert.deepEqual(Array.from(G.nav.walkGrid(w.map)),grid);
});
test('Можно отказаться; три яблока дают награду ровно один раз',w=>{
 const nodes=G.streetLife.ensure(w),n=nodes.find(n=>n._streetEvent==='apples'&&n.part==='start'),money=G.state.vars.money;
 touch(w,n);choose(1);assert.equal(G.streetLife.progress('apples'),0);assert.equal(G.state.vars.money,money);
 touch(w,n);choose(0);assert.equal(G.streetLife.progress('apples'),1);
 const apples=nodes.filter(n=>n.part==='apple');for(const a of apples)touch(w,a);
 assert.equal(G.streetLife.progress('apples'),9);assert.equal(G.state.vars.money,money+25);
 assert.equal(G.streetLife.interact(w,apples[2]),false);touch(w,n);assert.equal(G.state.vars.money,money+25);
});
test('Конспект сохраняется после загрузки, возвращается только после согласия',w=>{
 let nodes=G.streetLife.ensure(w),start=nodes.find(n=>n._streetEvent==='notebook'&&n.part==='start'),delivery=nodes.find(n=>n.part==='delivery');
 assert.equal(G.streetLife.interact(w,delivery),false);touch(w,start);choose(0);
 G.state=JSON.parse(JSON.stringify(G.state));G.game.fix(G.state);w._streetEvents=null;nodes=G.streetLife.ensure(w);delivery=nodes.find(n=>n.part==='delivery');
 const money=G.state.vars.money;touch(w,delivery);assert.equal(G.streetLife.progress('notebook'),9);assert.equal(G.state.vars.money,money+25);touch(w,delivery);assert.equal(G.state.vars.money,money+25);
});
test('Спор можно пропустить или решить без штрафа за ошибку',w=>{
 const n=G.streetLife.ensure(w).find(n=>n._streetEvent==='practice'),money=G.state.vars.money;
 touch(w,n);choose(2);assert.equal(G.streetLife.progress('practice'),0);
 touch(w,n);choose(1);assert.equal(G.streetLife.progress('practice'),0);assert.equal(G.state.vars.money,money);
 touch(w,n);choose(0);assert.equal(G.streetLife.progress('practice'),9);assert.equal(G.state.vars.money,money+20);
});
test('Память соседей, дружба и успехи учёбы дают разные личные реакции',w=>{
 G.state.hero.name='Кайто';G.state.flags={};G.state.vars.day=1;const n={id:'villager_m',uid:'resident:test'};
 assert.equal(G.streetLife.reaction(n),null);G.state.streetLife.helped[n.uid]=1;assert.match(G.streetLife.reaction(n),/Кайто.*спасибо/);
 G.state.vars.friend_naruto=5;assert.match(G.streetLife.reaction({id:'naruto'}),/Кайто.*рамен/);
 G.state.learning.tr_seals=1;assert.match(G.streetLife.reaction({id:'iruka'}),/упражнения/);
 const saved=JSON.parse(JSON.stringify(G.state));delete G.state.streetLife;G.game.fix(G.state);assert.deepEqual(Object.keys(G.state.streetLife.events),[]);G.state=saved;assert.match(G.streetLife.reaction(n),/спасибо/);
});
test('Сосед помнит помощь после смены дня; приветствие не прерывает игру',w=>{
 const n=w.npcs.find(G.villageDaily.generic);n._daily={busy:5,role:'water',seed:1};
 assert.ok(G.villageDaily.help(n,w));assert.equal(G.state.streetLife.helped[n.uid],1);
 G.state.daily={};G.state.vars.day++;assert.match(G.streetLife.reaction(n),/спасибо/);
 w.npcs=[n];w.player.x=n.x;w.player.y=n.y+24;w._streetScene=null;w.time=10;
 const d=G.villageDaily.ensure(w);d.greet=0;d.workTalk=999;d.chat=999;d.bubble=null;
 const top=G.scenes.top();G.villageDaily.update(w,.1);assert.equal(G.scenes.top(),top);assert.ok(d.bubble?.lines[0].includes('спасибо'));
 d.bubble=null;d.greet=0;w.time=200;G.villageDaily.update(w,.1);assert.equal(d.bubble,null);
});
test('Прогресс яблок сохраняется, а события не появляются в комнате и до вступления',w=>{
 const nodes=G.streetLife.ensure(w),n=nodes.find(n=>n._streetEvent==='apples'&&n.part==='start');touch(w,n);choose(0);
 touch(w,nodes.find(n=>n.part==='apple'&&n.index===0));G.state=JSON.parse(JSON.stringify(G.state));G.game.fix(G.state);
 assert.equal(G.state.streetLife.apples,1);assert.equal(G.streetLife.ensure(w).filter(n=>n.part==='apple').length,3);
 assert.equal(G.streetLife.interact(w,nodes.find(n=>n.part==='apple'&&n.index===0)),false);
 const map=w.map;w.map={id:'in:test'};assert.equal(G.streetLife.actors(w).length,0);assert.equal(G.streetLife.probe(w),null);
 w.map=map;G.state.flags.hosp_done=0;G.state.flags.day2_intro=0;assert.equal(G.streetLife.actors(w).length,0);
});
test('Уточняющие вопросы раскрывают историю, не принимая поручение и не выдавая награду',w=>{
 const nodes=G.streetLife.ensure(w);
 for(const def of G.STREET_EVENTS){
  const n=nodes.find(n=>n._streetEvent===def.id&&n.part==='start'),money=G.state.vars.money;
  touch(w,n);choose(def.id==='practice'?3:2);
  assert.equal(G.streetLife.progress(def.id),0);assert.equal(G.state.vars.money,money);
  assert.ok(w.lastTalk.length>=3);assert.ok(w.lastTalk.some(l=>l.who==='hero'));
  touch(w,n);choose(def.id==='practice'?2:1);assert.ok(w.lastTalk.length>=1);assert.equal(G.streetLife.progress(def.id),0);
 }
});
test('Возвращённый конспект принимает ученица, повторная встреча использует новые реплики',w=>{
 const def=G.STREET_EVENTS.find(d=>d.id==='notebook');
 assert.equal(G.streetLife.lines(def,'complete')[0].who,'kid_f');
 assert.notDeepEqual(G.streetLife.lines(def,'complete'),G.streetLife.lines(def,'after'));
 assert.equal(G.streetLife.lines(def,'deliveryAfter')[0].who,'kid_f');
});
test('У всех друзей три уровня диалога; герой отвечает, бонус общения не повторяется',w=>{
 for(const id of Object.keys(G.FRIENDS)){
  assert.equal(G.FRIEND_DIALOGUES[id].length,3,id);
  for(const [tier,points] of [[0,0],[1,10],[2,20]]){
   G.state.vars['friend_'+id]=points;G.state.daily={};
   G.friends.menu({id},w);choose(0);
   assert.equal(w.lastTalk.length,3);assert.equal(w.lastTalk[1].who,'hero');
   assert.equal(w.lastTalk[0].text,G.FRIEND_DIALOGUES[id][tier][0]);
   const after=G.state.vars['friend_'+id];G.friends.menu({id},w);choose(0);assert.equal(G.state.vars['friend_'+id],after);
  }
 }
});
test('Все новые реплики имеют поддерживаемые шрифтом символы и известных говорящих',w=>{
 const chars=new Set(G.font.chars());
 const text=t=>{for(const ch of t)assert.ok(ch===' '||chars.has(ch)||chars.has(ch.toUpperCase()),'Нет глифа '+ch);};
 for(const def of Object.values(G.STREET_DIALOGUES))for(const lines of Object.values(def)){
  if(typeof lines==='string'){text(lines);continue;}
  for(const line of lines){text(typeof line==='string'?line:line.text);if(line.who)assert.ok(G.chars.DEFS[line.who],line.who);}
 }
 for(const tiers of Object.values(G.FRIEND_DIALOGUES))for(const lines of tiers)for(const line of lines)text(line);
 for(const lines of Object.values(G.DAILY_DIALOGUES))for(const line of lines)text(typeof line==='string'?line:line.text);
});
console.log(`ИТОГ уличных событий: ✔ ${passed}  ✘ ${failed}`);process.exitCode=failed?1:0;
