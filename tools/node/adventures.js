// Переходы заданий, физическая доступность новых карт, загрузка и новые правила боя.
'use strict';
const assert=require('node:assert/strict'),h=require('./harness'),{G}=h;
let passed=0,failed=0;
function reset(){G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};h.seed(s=>{s.flags.hosp_done=1;s.flags.frd_init=1;s.flags.enrolled=1;s.inv={};});G.game.pending=null;G.storage.settings.textSpeed=0;}
function test(name,fn){reset();try{fn();passed++;console.log('  ✔ '+name);}catch(e){failed++;console.log('  ✘ '+name+': '+e.stack);}}
function world(key='forest'){const m=G.world.get('adv:'+key),w=G.scenes.make('world',{map:m.id,...m.spawn});G.scenes.push(w);return w;}
function close(){for(let i=0;i<50&&G.scenes.top()?.name.startsWith('dialog');i++)G.scenes.top().advance();}
function settle(b){for(let i=0;i<400&&b.state!=='menu'&&b.state!=='end';i++){if(b.state==='react')b.sim.react('block');else if(b.state==='rhythm')b.sim.rhythm('ok');else if(b.state==='target')b.sim.target(true);else b.update(.1);}}
function battle(enemy='dummy'){const b=G.scenes.make('battle',{enemy,terrain:'field',advanced:true},()=>{});G.scenes.push(b);settle(b);return b;}
function tech(b,id){assert.ok(b.sim.press('tech',G.TECHS[id].name),id+' не удалось выбрать');assert.equal(b.state,'seals');b.sim.seals('ok');settle(b);}

test('Девять новых карт строятся, все важные объекты достижимы с земли',()=>{
  for(const key of Object.keys(G.frontier.titles)){
    const w=world(key),m=w.map;assert.equal(m.id,'adv:'+key);assert.ok(!m.blockedRect(G.actors.feet(w.player)),key+': точка появления');
    if(key==='parkour')continue;
    const grid=G.nav.walkGrid(m),start=G.nav.nearestWalkable(m,grid,w.player.x/16|0,w.player.y/16|0),seen=new Set([start[1]*m.w+start[0]]),q=[start];
    for(let i=0;i<q.length;i++){const [x,y]=q[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*m.w+nx;if(nx<0||ny<0||nx>=m.w||ny>=m.h||!grid[j]||seen.has(j))continue;seen.add(j);q.push([nx,ny]);}}
    for(const o of m.objects.filter(o=>o.adv)){const reachable=q.some(([x,y])=>Math.hypot(x*16+8-o.x,y*16+12-o.y)<28);assert.ok(reachable,key+': '+o.adv);}
    G.scenes.pop();
  }
});
test('Новые цели ведут через настоящие переходы, этажи, балкон и архив',()=>{
  const w=world('forest');G.adventure.start('adv_archive');G.quests.track('adv_archive');let t=G.nav.current();assert.equal(t.map,'adv:tower2');assert.ok(G.nav.hop(w.map,t));
  assert.equal(G.adventure.travel('cellar',w),false);close();assert.equal(G.adventure.travel('cave',w),false);close();
  G.adventure.readBook('seal');close();assert.equal(G.quests.curStep('adv_archive').id,'seal');
  assert.equal(G.adventure.sealInput('fire'),false);assert.equal(G.state.vars.adv_seal_progress,0);
  for(const el of ['water','wind','fire'])assert.equal(G.adventure.sealInput(el),true);
  assert.ok(G.state.flags.adv_seal_open);assert.equal(G.quests.curStep('adv_archive').id,'guardian');
  w.setMap({map:'adv:balcony',entry:true});assert.ok(G.nav.hop(w.map,G.nav.current()));
});
test('Многоэтапная миссия не пропускает разведку; мирная ветка меняет доверие один раз',()=>{
  world();G.adventure.start('adv_cargo');assert.equal(G.adventure.prepare('talk'),false);assert.equal(G.adventure.cargo('peace'),false);
  G.adventure.interact('tracks');close();assert.equal(G.quests.curStep('adv_cargo').id,'prepare');assert.ok(G.adventure.prepare('talk'));
  assert.ok(G.adventure.cargo('peace'));close();assert.equal(G.state.flags.adv_cargo_peace,1);assert.ok(G.adventure.report('adv_cargo'));
  const money=G.state.vars.money,trust=G.state.vars.adv_clan_nara;assert.equal(G.adventure.report('adv_cargo'),false);assert.equal(G.adventure.cargo('peace'),false);assert.equal(G.state.vars.money,money);assert.equal(G.state.vars.adv_clan_nara,trust);assert.equal(trust,4);
});
test('Дым и ложный звук расходуют именно выбранный инструмент; нельзя получить мирную награду исподтишка',()=>{
  world();G.adventure.start('adv_cargo');G.adventure.step('adv_cargo','scout');assert.equal(G.adventure.prepare('smoke'),false);
  G.game.give('smoke_bomb');G.game.give('kunai');assert.ok(G.adventure.prepare('smoke'));assert.equal(G.game.count('smoke_bomb'),0);assert.equal(G.game.count('kunai'),1);assert.equal(G.adventure.cargo('peace'),false);assert.ok(G.adventure.cargo('quiet'));close();assert.equal(G.state.flags.adv_cargo_peace,0);
});
test('Страховка физически меняет проходимость; порядок спасения имеет разные последствия',()=>{
  world('river');G.adventure.start('adv_rescue');G.adventure.step('adv_rescue','survey');assert.equal(G.adventure.bridge(),false);const m=G.world.get('adv:river');assert.equal(m.get(18,14),G.tiles.ID.WATER);
  G.game.give('wire');assert.ok(G.adventure.bridge());assert.equal(G.game.count('wire'),0);assert.equal(m.get(18,14),G.tiles.ID.PLANKS);assert.ok(!m.blockedRect({x:18*16+3,y:14*16+7,w:10,h:5}));assert.equal(G.adventure.bridge(),false);
  assert.ok(G.adventure.rescue('people'));assert.equal(G.state.vars.adv_rescue_order,1);assert.equal(G.adventure.rescue('cargo'),false);assert.ok(G.adventure.report('adv_rescue'));assert.ok(G.state.flags.adv_recipe_onigiri);
});
test('Кланы открывают действующие навыки; найденные книги и награды не дублируются',()=>{
  world();G.adventure.trust('yamanaka',6);G.adventure.trust('akimichi',6);G.adventure.trust('inuzuka',6);assert.ok(G.state.flags.adv_recipe_tea&&G.state.flags.adv_recipe_onigiri);
  G.adventure.interact('clan_cache');close();const money=G.state.vars.money;G.adventure.interact('clan_cache');close();assert.equal(G.state.vars.money,money);
  G.adventure.readBook('clans');close();assert.ok(G.state.flags.adv_recipe_rice);G.adventure.readBook('clans');close();assert.ok(G.state.flags.adv_book_clans);
});
test('Тайный проход открывается одним кунаем и сохраняется',()=>{
  const w=world();G.game.give('kunai');G.adventure.interact('vines');const pick=G.scenes.top(),r=pick.geom();G.input.tapNow={x:40,y:r.ly+3};pick.update();G.input.tapNow=null;close();assert.equal(G.game.count('kunai'),0);assert.ok(G.state.flags.adv_vines);
  G.adventure.interact('vines',w);assert.equal(G.scenes.fade.dir,1);G.scenes.fade.then();assert.equal(w.map.id,'adv:cave');
  G.adventure.interact('cave_cache');close();const n=G.state.vars.money;G.adventure.interact('cave_cache');close();assert.equal(G.state.vars.money,n);
});
test('Программа наставника требует две успешные тренировки в разные дни',()=>{
  world();G.state.vars.adv_mentor=1;assert.equal(G.adventure.mentorResult(0,.2),false);close();assert.ok(!G.state.flags.adv_wallrun);
  assert.ok(G.adventure.mentorResult(0,.8));close();assert.equal(G.adventure.mentorResult(0,1),false);G.state.daily={};G.state.vars.day++;assert.ok(G.adventure.mentorResult(0,.9));close();assert.ok(G.state.flags.adv_wallrun&&G.state.flags.tech_suiton);
  const w=G.scenes.stack.find(s=>s.name==='world');w.setMap(G.world.outsideOf(G.world.heroHome()));const b=G.world.heroHome(),ch=G.state.vars.chakra;w.player.dir='up';G.roofs.climb(w,b);assert.ok(w.player.jump.wall);assert.equal(G.state.vars.chakra,ch-8);
});
test('Сезоны меняются на границе 28 дней, обновляют кэш и сезонный сбор',()=>{
  const w=world();const seasons=[1,29,57,85].map(d=>{G.state.vars.day=d;G.adventure.syncSeason(w.map);return G.adventure.season().name;});assert.equal(new Set(seasons).size,4);
  assert.ok(G.adventure.gather());assert.equal(G.game.count('herb_blue'),2);assert.equal(G.adventure.gather(),false);G.game.newState();G.frontier.patch(G.world.get('adv:river'));assert.equal(G.world.get('adv:river').get(18,14),G.tiles.ID.WATER);
});
test('Примирение требует обеих реплик и даёт разные отношения без повторных наград',()=>{
  world();G.adventure.start('adv_dispute');assert.equal(G.adventure.resolveDispute('both'),false);G.adventure.step('adv_dispute','sakura');G.adventure.step('adv_dispute','ino');assert.ok(G.adventure.resolveDispute('both'));close();assert.ok(G.state.flags.adv_reconciled&&G.state.flags.adv_recipe_tea);const pts=G.friends.pts('ino');assert.equal(G.adventure.resolveDispute('both'),false);assert.equal(G.friends.pts('ino'),pts);
});
test('Встреча назначается, видна в мире без копий NPC и засчитывается один раз',()=>{
  const w=world('river'),day=G.state.vars.day+1;assert.equal(G.adventure.scheduleMeeting('naruto','river',day,1020),true);assert.equal(G.adventure.scheduleMeeting('unknown','river',day,1020),false);
  assert.equal(G.adventure.attend(),false);G.state.vars.day=day;G.state.vars.min=1020;G.adventure.update(w,.1);assert.equal(w._appointment.id,'naruto');assert.ok(!w.npcs.some(n=>n.id==='naruto'));const pts=G.friends.pts('naruto');assert.ok(G.adventure.attend());assert.equal(G.adventure.attend(),false);assert.ok(G.friends.pts('naruto')>pts);
  G.state.vars.min=1110;G.adventure.update(w,.1);assert.equal(G.adventure.meeting(),null);
});
test('Сюрприз на день рождения требует всех припасов и не дублируется',()=>{
  world();G.state.vars.day=12;G.game.give('rice',1);G.game.give('milk',1);assert.equal(G.adventure.birthdaySurprise(),false);assert.equal(G.game.count('rice'),1);G.game.give('milk',1);assert.ok(G.adventure.birthdaySurprise());assert.equal(G.game.count('milk'),0);assert.equal(G.adventure.birthdaySurprise(),false);assert.equal(G.calendar.birthday(124),'naruto');
});
test('Семейные блюда требуют найденный рецепт, расходуют продукты и пригодны как еда',()=>{
  world();G.game.give('rice',4);G.game.give('vegetables',2);assert.equal(G.adventure.cookRecipe('adv_onigiri'),false);G.state.flags.adv_recipe_onigiri=1;assert.ok(G.adventure.cookRecipe('adv_onigiri'));assert.equal(G.game.count('rice'),2);G.state.vars.food=10;assert.ok(G.game.useItem('adv_onigiri').ok);assert.equal(G.game.count('adv_onigiri'),0);assert.ok(G.state.vars.food>=65);
});
test('Паркур использует шесть реальных прыжков, таймер паузы и однократные награды',()=>{
  const w=world();G.adventure.startCourse(false);assert.ok(w.player.roof);const rs=G.roofs.rects(w.map);assert.equal(rs.length,6);for(let i=0;i<5;i++)assert.ok(G.roofPatrol.connection(rs[i],rs[i+1]));
  for(const r of rs){Object.assign(w.player,{x:r.x+r.w/2,y:r.y+r.h/2,roof:true});G.adventure.update(w,1);}assert.equal(w._course,null);assert.equal(G.state.vars.adv_course_best,6);close();const money=G.state.vars.money;G.adventure.courseResult(5,false,true);assert.equal(G.state.vars.money,money);
  G.adventure.startCourse(true);const x=w._course.runner.x;G.adventure.update(w,.2);assert.ok(w._course.runner.x>x);G.scenes.push(G.scenes.make('menu'));const t=w._course.t;G.scenes.update(.5);assert.equal(w._course.t,t);
});
test('Три миссии генинов открываются после финала и требуют возвращения на пост',()=>{
  const w=world('outpost');assert.equal(G.adventure.start('adv_genin1'),false);G.state.flags.game_clear=1;assert.equal(G.adventure.start('adv_genin2'),false);assert.ok(G.adventure.start('adv_genin1'));G.adventure.interact('team');close();G.adventure.interact('signal');close();assert.ok(G.adventure.report('adv_genin1'));assert.ok(G.adventure.start('adv_genin2'));G.adventure.interact('team');close();G.game.give('smoke_bomb');assert.ok(G.adventure.escort('smoke'));close();assert.equal(G.game.count('smoke_bomb'),0);assert.ok(G.adventure.report('adv_genin2'));assert.ok(G.adventure.start('adv_genin3'));G.adventure.step('adv_genin3','brief');G.adventure.step('adv_genin3','trial');w.setMap({map:'adv:forest',entry:true});assert.equal(G.adventure.report('adv_genin3'),false);w.setMap({map:'adv:outpost',entry:true});assert.ok(G.adventure.report('adv_genin3'));assert.ok(G.state.flags.adv_chunin_entry);
});
test('Новые задания, встречи, рецепты и позиция в архиве переживают загрузку и экспорт',()=>{
  const w=world('cellar');G.adventure.start('adv_archive');G.adventure.readBook('seal');close();G.adventure.sealInput('water');G.adventure.scheduleMeeting('hinata','river',G.state.vars.day+1,1020);G.state.vars.adv_tech_suiton=2;G.state.flags.adv_recipe_tea=1;w.savePos();G.storage.save(G.state);const code=G.storage.exportCode();assert.ok(G.storage.importCode(code));const st=G.game.fix(G.storage.load());assert.equal(st.pos.map,'adv:cellar');assert.equal(st.vars.adv_seal_progress,1);assert.equal(st.vars.adv_meet_friend,G.state.vars.adv_meet_friend);assert.ok(st.flags.adv_recipe_tea);
});
test('Мини-шоги: легальные ходы, взятие, сброс, превращение и игра ИИ до результата',()=>{
  const M=G.miniShogi;let s=M.initial();assert.ok(M.moves(s).length>0);
  for(let turn=0;turn<100&&!s.winner;turn++){const moves=M.moves(s);if(!moves.length)break;const m=s.turn===-1?M.ai(s):moves[Math.floor(turn*7%moves.length)];assert.ok(moves.some(x=>JSON.stringify(x)===JSON.stringify(m)));const next=M.apply(s,m);assert.equal(next.turn,-s.turn);s=next;}
  const custom=M.initial();custom.board=Array(12).fill(null);custom.board[10]={s:1,k:'K'};custom.board[1]={s:-1,k:'K'};custom.board[3]={s:1,k:'P'};assert.ok(M.moves(custom).some(m=>m.from===3&&m.to===0));const promoted=M.apply(custom,{from:3,to:0});assert.equal(promoted.board[0].k,'G');promoted.turn=1;promoted.hands[1]=['R'];assert.ok(M.moves(promoted).some(m=>m.drop==='R'));
});
test('Настройка техники меняет фактическую стоимость чакры, а щит действует в бою',()=>{
  for(const id of ['suiton','doton'])G.state.flags['tech_'+id]=1;G.state.vars.adv_tech_suiton=1;const b=battle();const ch=b.P.ch;b.E.t=1000;tech(b,'suiton');assert.equal(ch-b.P.ch,Math.round(G.TECHS.suiton.ch*.75*(1-b.P.ctrl*.03)));b.E.t=1000;tech(b,'doton');assert.equal(b.P.earthCover,2);assert.equal(b.sim.obj(b.P.pos),'rock');
});
test('Обучающийся враг учитывает повторы, три фазы изменяют набор приёмов и арену',()=>{
  const b=battle('adv_keeper');b.E.t=1000;for(let i=0;i<3;i++){b.act('misc','guard');settle(b);}assert.equal(b.P.advStyle,'guard');assert.equal(b.P.advRepeat,3);
  b.E.hp=0;b.act('misc','guard');settle(b);assert.equal(b.E.phase,2);assert.equal(b.sim.obj(0),'rock');b.E.hp=0;b.act('misc','guard');settle(b);assert.equal(b.E.phase,3);assert.equal(b.sim.obj(0),'tree');b.E.hp=0;b.act('misc','guard');settle(b);assert.equal(b.sim.result().win,true);assert.equal(G.ENEMIES.adv_keeper.acts.includes('fireball'),false);
});
test('Повторы действительно меняют выбор ИИ, а ветер и вода меняют урон стихий',()=>{
  const ed={acts:['guard','strike'],pref:1,traits:['adaptive']},P={pos:1,s:{},advStyle:'tai',advRepeat:0},E={pos:2,s:{},hp:100,hpMax:100,ch:100};
  const ai=G.battleAi.make({P,E,ed,traps:[],dist:()=>1,has:t=>ed.traits.includes(t),canStand:()=>true,sgn:()=>1,rnd:()=>1,Hh:G.hero});
  h.rng(17);let normal=0;for(let i=0;i<1000;i++)if(ai.decide()==='guard')normal++;P.advRepeat=3;h.rng(17);let learned=0;for(let i=0;i<1000;i++)if(ai.decide()==='guard')learned++;h.rngOff();assert.ok(learned>normal*3);
  const random=Math.random;Math.random=()=>.5;
  try{
    function damage(tid,prep){G.scenes.stack.length=0;for(const id of ['katon','suiton','raiton','fuuton'])G.state.flags['tech_'+id]=1;const b=battle();b.P.ch=b.P.chMax=1000;b.E.hp=b.E.hpMax=1000;b.E.t=1000;if(prep)tech(b,prep);const hp=b.E.hp;b.E.t=1000;tech(b,tid);return hp-b.E.hp;}
    const fire=damage('katon');assert.ok(damage('katon','fuuton')>fire*1.3);assert.ok(damage('katon','suiton')<fire*.8);assert.ok(damage('raiton','suiton')>damage('raiton')*1.4);
  }finally{Math.random=random;}
});
test('Размер кнопки и чувствительность джойстика применяются и сохраняются',()=>{
  G.storage.settings.buttonSize=1.4;G.storage.settings.stickSensitivity=1.3;G.storage.saveSettings();G.storage.settings.buttonSize=1;G.storage.loadSettings();assert.equal(G.storage.settings.buttonSize,1.4);G.input.stick={on:true,x:40,y:0,ox:0,oy:0};assert.equal(G.input._stickState().run,true);G.storage.settings.stickSensitivity=.75;assert.equal(G.input._stickState().run,false);G.input._stopStick();
});
test('Назначенная при выпуске команда сохраняется и помогает в новых дуэлях',()=>{
  world('outpost');G.state.flags.game_clear=1;G.state.flags.team_8=1;G.state.vars.friend_naruto=25;G.adventure.start('adv_genin3');
  // Предыдущие миссии пройдены; инструкция и испытание открываются по обычным шагам.
  for(const id of ['adv_genin1','adv_genin2']){if(!G.quests.state(id))G.quests.start(id);G.quests.complete(id);}
  assert.ok(G.adventure.start('adv_genin3'));G.adventure.step('adv_genin3','brief');G.adventure.interact('trial');const b=G.scenes.top();assert.equal(b.name,'battle');assert.deepEqual(Array.from(b.opts.allies),['hinata','kiba','shino']);settle(b);b.P.hp=Math.floor(b.P.hpMax/2);const hp=b.P.hp;b.E.t=1000;
  for(let i=0;i<2;i++){b.act('misc','guard');settle(b);}assert.ok(b.P.hp>hp||b.E.hp<b.E.hpMax,'команда должна помочь в третьем ходе');
});
console.log(`ИТОГ приключений: ✔ ${passed}  ✘ ${failed}`);process.exitCode=failed?1:0;
