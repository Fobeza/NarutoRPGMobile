// Входы и выходы требуют отдельного нажатия A, подсказка и действие используют одну дверь.
'use strict';
const assert=require('node:assert/strict'),h=require('./harness'),{G}=h;let passed=0,failed=0;
function test(name,fn){G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};h.seed(s=>{s.flags.hosp_done=1;s.flags.home_seen=1;s.flags.tip_clock=1;s.flags.frd_init=1;s.vars.day=6;s.vars.min=900;s.daily.lesson=1;});G.game.pending=null;try{const w=G.scenes.make('world',G.world.outsideOf(G.world.heroHome()));G.scenes.push(w);fn(w);passed++;console.log('  ✔ '+name);}catch(e){failed++;console.log('  ✘ '+name+': '+e.stack);}}
function at(w,warp){Object.assign(w.player,{x:warp.rect.x+warp.rect.w/2,y:warp.rect.y+(warp.dir==='up'?12:-6),dir:warp.dir,roof:false,jump:null});w._actionKey=null;}
function input(axis,press,fn){const old=[G.input.axis,G.input.pressed,G.input.held,G.story.poll,G.life.RATE];G.input.axis=()=>axis;G.input.pressed=k=>k==='a'&&press;G.input.held=()=>false;G.story.poll=()=>false;G.life.RATE=0;try{fn();}finally{[G.input.axis,G.input.pressed,G.input.held,G.story.poll,G.life.RATE]=old;}}
test('У всех действующих дверей Конохи появляется кнопка входа с названием нужного дома',w=>{
 assert.ok(w.map.warps.length>100);for(const warp of w.map.warps){at(w,warp);const a=w.doorAction();assert.equal(a?.label,'Войти',warp.building.name);assert.equal(a.title,warp.building.name);assert.equal(w.currentAction().title,a.title);}
});
test('Движение в дверной проём не запускает вход, отдельное A запускает его один раз',w=>{
 const warp=w.map.warps.find(q=>q.building.tplId==='hero_home');at(w,warp);w.npcs=[];w.others=[w.player];let enters=0;w.enterBuilding=b=>{assert.equal(b,warp.building);enters++;};
 input({x:0,y:-1},false,()=>{for(let i=0;i<50;i++)w.update(.02);});assert.equal(enters,0);assert.equal(w.map.id,'konoha');
 input({x:0,y:0},true,()=>w.update(.02));assert.equal(enters,1);
 input({x:0,y:0},false,()=>{for(let i=0;i<20;i++)w.update(.02);});assert.equal(enters,1);
});
test('Выход из комнаты также требует A и сохраняет точный обратный переход',w=>{
 const b=G.world.heroHome();w.setMap({map:b.interior.id,entry:true});const warp=w.map.warps[0];at(w,warp);w.npcs=[];w.others=[w.player];let exits=0;w.exitBuilding=()=>exits++;
 input({x:0,y:1},false,()=>{for(let i=0;i<50;i++)w.update(.02);});assert.equal(exits,0);assert.notEqual(w.map.id,'konoha');assert.equal(w.currentAction()?.label,'Выйти');input({x:0,y:0},true,()=>w.update(.02));assert.equal(exits,1);
});
test('Нельзя войти издалека, спиной, с крыши или во время прыжка',w=>{
 const warp=w.map.warps.find(q=>q.building.tplId==='hero_home');at(w,warp);assert.ok(w.doorAction());w.player.dir='down';assert.equal(w.doorAction(),null);w.player.dir='up';w.player.y+=40;assert.equal(w.doorAction(),null);at(w,warp);w.player.roof=true;assert.equal(w.doorAction(),null);w.player.roof=false;w.player.jump={};assert.equal(w.doorAction(),null);
});
test('Стоящий в дверях житель не перехватывает кнопку входа, выход не вызывает обратный вход',w=>{
 const warp=w.map.warps.find(q=>q.building.tplId==='hero_home');at(w,warp);w.npcs=[G.world.makeNpc({id:'villager_m',x:w.player.x,y:w.player.y-10,dir:'down'})];assert.equal(w.currentAction()?.label,'Войти');Object.assign(w.player,G.world.outsideOf(warp.building));w._actionKey=null;assert.equal(w.doorAction(),null);
});
console.log(`ИТОГ дверей: ✔ ${passed}  ✘ ${failed}`);process.exitCode=failed?1:0;
