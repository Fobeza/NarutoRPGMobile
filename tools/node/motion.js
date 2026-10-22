// Проверяем изоляцию анимаций от игрового мира, отключение эффектов и ограничение нагрузки.
'use strict';
const assert=require('node:assert/strict'),h=require('./harness'),{G}=h;let passed=0,failed=0;
function world(){G.scenes.stack.length=0;h.seed(s=>{s.flags.hosp_done=1;s.flags.frd_init=1;s.vars.day=6;s.vars.min=900;});G.storage.settings.fx=true;const w=G.scenes.make('world',G.world.outsideOf(G.world.heroHome()));G.scenes.push(w);G.villageDaily.ensure(w);return w;}
function test(name,fn){try{fn(world());passed++;console.log('  ✔ '+name);}catch(e){failed++;console.log('  ✘ '+name+': '+e.stack);}}
test('Анимация людей, животных и растений не меняет сохранение, координаты и коллизии',w=>{
 const n=w.npcs.find(G.villageDaily.generic),a=w._dailyLife.animals[0],o=w.map.objects.find(o=>o.kind==='tree'),c=h.recordingCtx();n._look=0;
 const before=JSON.stringify({state:G.state,n:[n.uid,n.x,n.y,n.path],a:[a.x,a.y,a.path],block:Array.from(w.map.block),objects:w.map.objects.length});
 for(let i=0;i<60;i++){w.time=i*.1;G.worldMotion.actor(c,w,n,0,0);G.worldMotion.animal(c,w,a);G.worldMotion.object(c,w,o,o.img);G.worldMotion.ground(c,w);}
 assert.equal(JSON.stringify({state:G.state,n:[n.uid,n.x,n.y,n.path],a:[a.x,a.y,a.path],block:Array.from(w.map.block),objects:w.map.objects.length}),before);assert.ok(!c.log.some(x=>x.includes('NaN')));
});
test('Настройка эффектов возвращает обычные спрайты и неподвижную книгу',w=>{
 G.storage.settings.fx=false;const c=h.recordingCtx(),n=w.npcs.find(G.villageDaily.generic),a=w._dailyLife.animals[0],o=w.map.objects.find(o=>o.kind==='tree');
 assert.equal(G.worldMotion.actor(c,w,n,0,0),false);assert.equal(G.worldMotion.animal(c,w,a),false);assert.equal(G.worldMotion.object(c,w,o,o.img),false);G.worldMotion.ground(c,w);assert.equal(c.log.length,0);
 n._daily={busy:5,role:'read',seed:1};n.moving=false;const c1=h.recordingCtx(),c2=h.recordingCtx();w.time=0;G.villageDaily.drawActorExtras(c1,w,n);w.time=5;G.villageDaily.drawActorExtras(c2,w,n);assert.deepEqual(c1.log,c2.log);assert.equal(G.villageDaily.lift({_daily:{busy:1,role:'play',seed:1}},1),0);
});
test('Кроны колышутся, основание дерева и горшка остаётся на месте',w=>{
 for(const kind of ['tree','flowerbox','lamp']){const o=w.map.objects.find(o=>o.kind===kind);assert.ok(o,kind);const a=h.recordingCtx(),b=h.recordingCtx();w.time=0;G.worldMotion.object(a,w,o,o.img);w.time=1;G.worldMotion.object(b,w,o,o.img);assert.equal(a.log[0],b.log[0],kind);assert.notDeepEqual(a.log,b.log,kind);}
});
test('Кошки чередуют покой, умывание и потягивание; прогулка и ласка имеют приоритет',w=>{
 const a=w._dailyLife.animals.find(a=>a.type==='cat'),poses=new Set();a.moving=false;a.pet=0;for(let i=0;i<120;i++){w.time=i*.1;poses.add(G.worldMotion.petPose(w,a));}for(const p of ['sit','groom','stretch','look'])assert.ok(poses.has(p));a.moving=true;assert.equal(G.worldMotion.petPose(w,a),'walk');a.pet=2;assert.equal(G.worldMotion.petPose(w,a),'happy');
 const dog=w._dailyLife.animals.find(a=>a.type==='dog');dog.moving=false;const dogPoses=new Set();for(let i=0;i<120;i++){w.time=i*.1;dogPoses.add(G.worldMotion.petPose(w,dog));}assert.ok(dogPoses.has('sniff')&&dogPoses.has('scratch'));
});
test('Приветствие включает короткий жест существующего жителя',w=>{
 const n=w.npcs.find(n=>G.villageDaily.generic(n)&&!G.quests.iconFor(n.id));n.moving=false;n._daily={busy:0};w.npcs=[n];w._streetScene=null;Object.assign(w.player,{x:n.x,y:n.y+23});const s=w._dailyLife;s.greet=0;s.workTalk=99;s.chat=99;G.villageDaily.update(w,.1);assert.equal(n._gesture.kind,'wave');assert.equal(n._gesture.until,3);w.time=4;const c=h.recordingCtx();G.worldMotion.actor(c,w,n,0,0);assert.ok(!c.log.some(x=>x.startsWith('lineTo')));
});
test('Круги дождя ограничены видимой областью и не появляются в стенах',w=>{
 const rain=G.life.raining;G.life.raining=()=>true;try{const c=h.recordingCtx();G.worldMotion.ground(c,w);const rings=c.log.filter(x=>x.startsWith('ellipse('));assert.ok(rings.length>0&&rings.length<=24);for(const row of rings){const [x,y]=row.slice(8,-1).split(',').map(Number);assert.ok(!w.map.solidTile(x/16|0,y/16|0)||w.map.get(x/16|0,y/16|0)===G.tiles.ID.WATER);}}finally{G.life.raining=rain;}
});
test('Анимации деревни не появляются в комнатах, на новых картах и у прыгающего героя',w=>{
 const c=h.recordingCtx(),o=w.map.objects.find(o=>o.kind==='tree');w.player.jump={};assert.equal(G.worldMotion.actor(c,w,w.player,0,0),false);for(const id of ['inside:test']){w.map={id};assert.equal(G.worldMotion.object(c,w,o,o.img),false);G.worldMotion.ground(c,w);}assert.equal(c.log.length,0);
});
test('Дыхание в интерьере и движение корпуса не сдвигают ноги и коллизии',w=>{
 const n=w.npcs.find(G.villageDaily.generic);w.map={id:'inside:test'};n.moving=false;
 const a=h.recordingCtx(),b=h.recordingCtx(),before=[n.x,n.y];
 w.time=0;G.worldMotion.actor(a,w,n,0,0);w.time=.7;G.worldMotion.actor(b,w,n,0,0);
 assert.notDeepEqual(a.log,b.log);assert.deepEqual([n.x,n.y],before);
 assert.equal(a.log.filter(s=>s.startsWith('drawImage')).at(-1),b.log.filter(s=>s.startsWith('drawImage')).at(-1));
 n.moving=true;n.anim=.5;const c=h.recordingCtx();G.worldMotion.actor(c,w,n,0,0);assert.ok(!c.log.some(s=>s.includes('NaN')));
});
test('Листья и светлячки зависят от времени, дождя и настройки эффектов',w=>{
 const rain=G.life.raining,season=G.life.season;
 const vis=[{kind:'sakura',x:50,y:60,ox:0,oy:-20,w:32,h:40},{kind:'bush',x:90,y:80,w:20,h:15}];
 try{
  G.life.raining=()=>false;G.life.season=()=>({name:'Лето'});w.time=2.4;
  const before=JSON.stringify(G.state),day=h.recordingCtx();G.worldMotion.atmosphere(day,w,vis);assert.ok(day.log.length>0);assert.equal(JSON.stringify(G.state),before);
  G.state.vars.min=1200;const night=h.recordingCtx();G.worldMotion.atmosphere(night,w,vis);assert.notDeepEqual(day.log,night.log);
  G.life.raining=()=>true;const wet=h.recordingCtx();G.worldMotion.atmosphere(wet,w,vis);assert.equal(wet.log.length,0);
  G.life.raining=()=>false;G.life.season=()=>({name:'Зима'});const winter=h.recordingCtx();G.worldMotion.atmosphere(winter,w,vis);assert.equal(winter.log.length,0);
  G.storage.settings.fx=false;const off=h.recordingCtx();G.worldMotion.atmosphere(off,w,vis);assert.equal(off.log.length,0);
 }finally{G.life.raining=rain;G.life.season=season;}
});
test('Дым привязан к настоящим трубам; бюджет частиц ограничен',w=>{
 const buildings=w.map.buildings.filter(b=>b.spr.chimney);assert.ok(buildings.length>0);
 const c=h.recordingCtx();w.time=2;G.worldMotion.atmosphere(c,w,Array(100).fill(buildings[0]));
 const particles=c.log.filter(s=>s.startsWith('ellipse('));assert.equal(particles.length,36);assert.ok(!c.log.some(s=>s.includes('NaN')));
 const off=h.recordingCtx();w.map={id:'inside:test'};G.worldMotion.atmosphere(off,w,buildings);assert.equal(off.log.length,0);
});
test('Дождь и светлячки не смещаются при перемещении камеры внутри набора ячеек',w=>{
 const rain=G.life.raining;G.life.raining=()=>false;
 const map={outdoor:true,w:100,h:100,solidTile:()=>false,get:()=>G.tiles.ID.GRASS};
 try{for(const mode of ['rain','day','night']){
  const a=h.recordingCtx(),b=h.recordingCtx();
  const draw=(c,x,y)=>mode==='rain'?G.fx.rain(c,x,y,160,160,map,2.3):G.fx.particles(c,x,y,160,160,map,mode==='day'?720:1380,2.3);
  draw(a,90,90);draw(b,91,91);
  // Затемнение дождя покрывает экран; сами капли остаются на прежнем месте.
  const points=c=>c.log.filter(v=>v.startsWith('fillRect(')&&!v.endsWith(',160,160)'));
  assert.ok(points(a).length>0,mode);assert.deepEqual(points(a),points(b),mode);
  const again=h.recordingCtx();draw(again,90,90);assert.deepEqual(a.log,again.log);
 }}finally{G.life.raining=rain;}
});
test('Коробка остаётся у курьера при паузе, дожде и смене направления',w=>{
 const n=w.npcs.find(n=>G.villageDaily.generic(n)&&!n.id.startsWith('kid_'));
 n._daily={role:'parcel',busy:0};n.dir='down';n.anim=0;
 const a=h.recordingCtx(),b=h.recordingCtx();n.moving=true;G.villageDaily.drawCargo(a,w,n);n.moving=false;G.villageDaily.drawCargo(b,w,n);assert.deepEqual(a.log,b.log);assert.ok(a.log.length>0);
 const rain=G.life.raining;try{G.life.raining=()=>true;const c=h.recordingCtx();G.villageDaily.drawCargo(c,w,n);assert.deepEqual(a.log,c.log);}finally{G.life.raining=rain;}
 for(const dir of ['left','right','up','down']){n.dir=dir;const front=h.recordingCtx(),back=h.recordingCtx();G.villageDaily.drawCargo(front,w,n);G.villageDaily.drawCargo(back,w,n,true);assert.ok((front.log.length>0)!==(back.log.length>0));}
 n._daily.role='read';const c=h.recordingCtx();G.villageDaily.drawCargo(c,w,n,true);assert.equal(c.log.length,0);
});
test('Все эмоции имеют пиксели, а отрисовка не расходует задержку',w=>{
 const n=w.npcs[0];w.npcs=[n];n.x=40;n.y=50;
 for(const ch of ['...','!','?','♥','*','~','Zz','!!','неизвестно']){
  n._em={ch,t:1,cd:5,delay:0};const c=h.recordingCtx();G.life2.drawEmotes(c,w,0,0,160,160);
  assert.ok(c.log.filter(s=>s.startsWith('fillRect(')&&s.endsWith(',1,1)')).length>0,ch);
 }
 n._em={ch:'♥',t:1.6,cd:5,delay:.9};const before=JSON.stringify(n._em);
 for(let i=0;i<120;i++)G.life2.drawEmotes(h.recordingCtx(),w,0,0,160,160);
 assert.equal(JSON.stringify(n._em),before);G.life2.npcTick(w,n,.3);assert.ok(Math.abs(n._em.delay-.6)<1e-9);assert.equal(n._em.t,1.6);
});
console.log(`ИТОГ анимаций: ✔ ${passed}  ✘ ${failed}`);process.exitCode=failed?1:0;
