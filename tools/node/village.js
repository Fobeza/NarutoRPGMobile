// Регрессии живой деревни: реальные переходы состояний, безопасные прыжки и сохранения.
'use strict';
const assert=require('node:assert/strict'),h=require('./harness'),{G}=h;
let passed=0,failed=0;
function reset(){G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};h.seed(s=>{s.flags.hosp_done=1;s.flags.frd_init=1;s.inv={};});G.game.pending=null;}
function test(name,fn){reset();try{fn();passed++;console.log('  ✔ '+name);}catch(e){failed++;console.log('  ✘ '+name+': '+e.stack);}}
function room(tpl){return G.world.get(G.world.konoha().buildings.find(b=>b.tplId===tpl).interior.id);}
function world(map='konoha'){const m=map==='konoha'?G.world.konoha():room(map),pos=m.outdoor?G.world.outsideOf(G.world.heroHome()):{map:m.id,...m.spawn};const w=G.scenes.make('world',pos);G.scenes.push(w);return w;}

test('Именные интерьеры имеют разные планировки и свои характерные предметы',()=>{
  const expected={naruto_flat:'ramen_stack',sasuke_home:'family_photo',teahouse:'shogi_table',yakiniku:'bbq_table',dango:'dango_tray',pharmacy:'medicine_case',clan_aburame:'insect_case',clan_inuzuka:'dog_bed'};
  for(const [tpl,kind]of Object.entries(expected))assert.ok(room(tpl).objects.some(o=>o.kind===kind),tpl+': '+kind);
  const signatures=['nara','hyuga','akimichi','inuzuka','aburame','senju','sarutobi','yamanaka','uchiha'].map(c=>room('clan_'+c).objects.map(o=>[o.kind,o.x,o.y].join(':')).join('|'));
  assert.equal(new Set(signatures).size,9);
});
test('Старое сохранение внутри новой мебели переносится на свободный пол той же комнаты',()=>{
  const m=room('yakiniku'),o=m.objects.find(o=>o.kind==='bbq_table'),w=world();
  w.setMap({map:m.id,x:o.x,y:o.y-2,dir:'down'});
  assert.equal(w.map,m);assert.ok(!m.blockedRect(G.actors.feet(w.player)));
});
test('Фонарь требует проволоку, списывает её один раз и выдаёт одну награду',()=>{
  const w=world(),before=G.state.vars.money;
  G.quests.start('street_lantern');assert.equal(G.villageStories.repair(),false);
  assert.equal(G.state.vars.money,before);
  G.game.give('wire',1);assert.equal(G.quests.curStep('street_lantern').id,'fix');
  const target=G.nav.current();assert.equal(target.map,'konoha');assert.ok(target.x>0);
  G.game.take('wire',1);assert.equal(G.villageStories.repair(),false);assert.ok(!G.quests.done('street_lantern'));
  G.game.give('wire',1);assert.ok(G.villageStories.repair());assert.equal(G.game.count('wire'),0);
  assert.equal(G.state.vars.money,before+45);assert.ok(G.quests.done('street_lantern'));
  assert.equal(G.villageStories.repair(),false);assert.equal(G.state.vars.money,before+45);
  assert.equal(w.map.objects.find(o=>o._villageLamp).kind,'lamp');
});
test('Последствия поручений видны в уже открытых комнатах, не размножаются и переживают сохранение',()=>{
  world();
  for(const e of G.villageStories.effects){
    const m=e.quest==='night_patrol'?G.world.konoha():room(e.tpl);G.quests.start(e.quest);G.quests.complete(e.quest);G.villageStories.sync(m);
    if(e.quest!=='night_patrol')assert.ok(m.objects.some(o=>o._consequence&&o.talk.includes(e.text)),e.quest+': нет видимого результата');
    const n=m.objects.filter(o=>o._consequence).length;G.villageStories.sync(m);G.villageStories.sync(m);
    assert.equal(m.objects.filter(o=>o._consequence).length,n);
  }
  assert.ok(G.storage.valid({v:2,state:G.state}),'состояние с последствиями не прошло проверку сохранения');
  G.storage.save(G.state);const loaded=G.storage.load();assert.ok(loaded);G.state=G.game.fix(loaded);
  assert.ok(G.villageStories.rumors().length>=3,JSON.stringify(G.state.quests));assert.ok(G.quests.done('ino_flowers'));
});
test('Новая игра очищает следы поручений из кэша старого мира',()=>{
  world();G.quests.start('street_lantern');G.game.give('wire',1);G.villageStories.repair();
  G.quests.start('ino_flowers');G.quests.complete('ino_flowers');const m=room('clan_hyuga');G.villageStories.sync(m);
  assert.ok(m.objects.some(o=>o._consequence));
  G.game.newState();G.villageStories.sync(m);G.villageStories.sync(G.world.konoha());
  assert.equal(m.objects.filter(o=>o._consequence).length,0);
  assert.equal(G.world.konoha().objects.find(o=>o._villageLamp).kind,'broken_lamp');
});
test('Уличные сцены зависят от часов и дождя и не создают копий постоянных жителей',()=>{
  const w=world(),count=w.map.npcs.length,rain=G.life.raining;
  try{
    for(const def of G.villageStories.scenes){
      const b=w.map.buildings.find(b=>b.tplId===def.tpl);w.player.x=b.door.tx*16+8;w.player.y=(b.door.ty+2)*16+12;
      G.state.vars.min=(def.hours[0]+0.5)*60;G.life.raining=()=>def.weather==='rain';
      w._streetScene=null;w._streetCheck=0;G.villageStories.update(w,1);G.villageStories.update(w,1);
      assert.equal(w._streetScene?.def.id,def.id);assert.equal(G.villageStories.actors(w).length,2);
      for(const n of G.villageStories.actors(w))assert.ok(!w.map.blockedRect(G.actors.feet(n)),def.id+' in wall');
      G.state.vars.min=def.hours[1]*60;G.villageStories.update(w,1);
      assert.equal(G.villageStories.actors(w).length,0);
    }
    assert.equal(w.map.npcs.length,count);
  }finally{G.life.raining=rain;}
});
test('Патрульные переходят между настоящими крышами, прыжки укладываются в допустимую дальность',()=>{
  const w=world(),life=G.roofPatrol.build(w.map),count=w.map.npcs.length;
  assert.ok(life.patrols.length>=4);let airborne=0,landed=0;
  for(let i=0;i<1200;i++){
    const flying=life.patrols.map(p=>!!p.jump);G.roofPatrol.update(w,0.05);w.time+=0.05;
    for(let j=0;j<life.patrols.length;j++){
      const p=life.patrols[j];
      if(p.jump){airborne++;assert.ok(Math.hypot(p.jump.x1-p.jump.x0,p.jump.y1-p.jump.y0)<=G.roofs.JUMP+0.01);}
      else {assert.ok(G.roofs.at(w.map,p.x,p.y),'патруль вне крыши');if(flying[j])landed++;}
    }
  }
  assert.ok(airborne>100&&landed>10);assert.equal(w.map.npcs.length,count);
});
test('Подсказка прыжка героя ведёт на ту же крышу, куда он приземляется',()=>{
  const w=world(),life=G.roofPatrol.build(w.map);let target=null;
  for(let i=0;i<life.graph.length&&!target;i++)for(const edge of life.graph[i]){
    Object.assign(w.player,{x:edge.from.x,y:edge.from.y,roof:true,jump:null});
    for(const dir of ['up','down','left','right']){w.player.dir=dir;target=G.roofs.jumpTarget(w);if(target)break;}
    if(target)break;
  }
  assert.ok(target);const action=w.currentAction();assert.equal(action.label,'Прыгнуть');
  action.run();assert.ok(w.player.jump.toRoof);G.roofs.updateJump(w,10);
  assert.equal(w.player.x,target.x);assert.equal(w.player.y,target.y);assert.ok(w.player.roof);
  w.savePos();assert.equal(G.state.pos.roof,1);assert.equal(w.probeAction()?.show,true);
});
test('Подсветка предмета, подпись и выполняемое действие используют одну цель',()=>{
  const w=world(),lamp=w.map.objects.find(o=>o._villageLamp);
  w.npcs=[];Object.assign(w.player,{x:lamp.x,y:lamp.y+10,dir:'up',roof:false,jump:null});
  const action=w.currentAction();assert.equal(action.label,'Помочь');assert.ok(action.targetRect);assert.equal(w.currentAction(),action);
  action.run();assert.equal(G.scenes.top().name,'dialog:village_lantern');
});
console.log(`ИТОГ деревни: ✔ ${passed}  ✘ ${failed}`);process.exitCode=failed?1:0;
