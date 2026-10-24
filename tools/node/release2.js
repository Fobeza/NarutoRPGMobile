// Бой через экран, события тренировок.
'use strict';
const assert=require('node:assert/strict'),h=require('./harness.js'),{G}=h;
let passed=0;
function seed(day=33){h.seed();G.state.learning={};G.state.vars.day=day;G.state.vars.min=900;G.state.vars.hp=100;G.state.vars.chakra=100;G.state.inv={kunai:5,smoke_bomb:2,wire:2,book_traps:1};G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};G.input.pressed=()=>false;G.input.tapNow=null;}
function test(name,fn){seed();try{fn();console.log('✔ '+name);passed++;}catch(e){console.error('✘ '+name);throw e;}}
function settle(b){for(let i=0;i<600&&b.state!=='menu'&&b.state!=='end';i++)b.update(.1);}
function battle(mode='spar',enemy='dummy',cb=()=>{}){const b=G.scenes.make('battle',{enemy,mode},cb);G.scenes.push(b);b.enter();settle(b);return b;}
function script(id){const r=G.script.runner(id);for(let i=0;i<100;i++){const op=r.next();if(op.op==='choice')r.jump(op.options[0].label);if(op.op==='end')break;}const p=G.game.pending;G.game.pending=null;if(p?.type==='dialogScript')script(p.id);}
test('Событие успешной тренировки сохраняет конкретный навык и напарника',()=>{G.events.emit('training','throw',.8,'naruto');assert.equal(G.state.learning.tr_throw,1);assert.equal(G.state.learning.partner,1);G.storage.save(G.state);const s=G.game.fix(G.storage.load());assert.equal(s.learning.tr_throw,1);});
test('Бой через экран: несколько карт за ход, итог переносится в состояние игры',()=>{
 let res=null;const b=battle('ko','dummy2',r=>{res=r;});G.state.vars.fatigue=10;const f0=G.state.vars.fatigue,w0=G.state.vars.wins||0;
 for(let i=0;i<80&&b.state!=='end';i++){const a=G.duel.bot(b.D,1);assert.ok(b.play(a.act));settle(b);}
 assert.equal(b.state,'end');assert.ok(b.D.stats.cards>=3&&b.D.round>1);for(let i=0;i<20&&G.scenes.top()===b;i++){G.input.tapNow={x:10,y:10};b.update(1.1);}G.input.tapNow=null;
 assert.ok(res&&res.win&&res.enemy==='dummy2'&&res.turns>0);assert.ok(G.state.vars.fatigue>f0);assert.equal(G.state.vars.wins,w0+1);assert.equal(G.state.battleCheckpoint,null);
});
test('Спарринг заканчивается на 30% здоровья и не отнимает здоровье героя',()=>{
 const hp0=G.state.vars.hp;const b=battle('spar','kiba');b.D.E.hp=b.D.E.hpMax*0.35;
 let n=0;while(b.state!=='end'&&n++<80){const a=G.duel.bot(b.D,1);b.play(a.act);settle(b);}
 assert.equal(b.state,'end');assert.ok(b.D.E.hp<=b.D.E.hpMax*0.3||b.D.P.hp<=b.D.P.hpMax*0.3);assert.equal(G.state.vars.hp,hp0,'в спарринге здоровье не меняется');
});
assert.equal(G.script.problems.length,0);console.log('ИТОГ нового выпуска: '+passed+' проверок');
