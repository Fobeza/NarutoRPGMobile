// Детализация, настройки, маркеры, навигация и сохранение карты.
'use strict';
const assert=require('node:assert/strict'),h=require('./harness'),{G}=h;let passed=0,failed=0;
function reset(){G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};h.seed(s=>{s.flags.hosp_done=1;s.flags.home_seen=1;s.flags.frd_init=1;s.vars.day=6;s.vars.min=900;});G.storage.settings.mapDetail='detailed';G.storage.settings.mapMarkerSize=1;G.storage.settings.mapLabels=true;const w=G.scenes.make('world',G.world.outsideOf(G.world.heroHome()));G.scenes.push(w);const m=G.scenes.make('mapview',w);G.scenes.push(m);return{w,m};}
function test(name,fn){try{fn(reset());passed++;console.log('  ✔ '+name);}catch(e){failed++;console.log('  ✘ '+name+': '+e.stack);}}
test('Подробная карта использует кэш, запросы видимости его не сбрасывают, перестройка мира обновляет',({w})=>{
 const k=w.map,state=JSON.stringify(G.state),blocks=Array.from(k.block).join(),a=G.cartography.atlas(k);assert.ok(a.width>=k.w*4&&a.height>=k.h*4);k.query({x:0,y:0,w:100,h:100});assert.equal(G.cartography.atlas(k),a);assert.equal(JSON.stringify(G.state),state);assert.equal(Array.from(k.block).join(),blocks);k.finalize();assert.notEqual(G.cartography.atlas(k),a);G.storage.settings.mapDetail='simple';assert.equal(G.cartography.atlas(k),k.overview());
});
test('Близкие знаки объединяются без потери точек, важное задание остаётся главным',()=>{
 const a=[{x:20,y:20,kind:'shop',priority:1},{x:21,y:21,kind:'quest',priority:5},{x:70,y:70,kind:'friend'}],groups=G.cartography.cluster(a,14);assert.equal(groups.length,2);assert.equal(groups[0].kind,'quest');assert.equal(groups.reduce((n,g)=>n+g.items.length,0),a.length);for(const kind of Object.keys(G.cartography.colors)){const c=h.recordingCtx();G.cartography.pin(c,10,10,kind,{count:2});assert.ok(!c.log.some(s=>s.includes('NaN')));}
});
test('Фильтр лавок не выбирает скрытые места, дом имеет собственный знак',({m})=>{
 assert.ok(m.marks().some(p=>p.kind==='home'));m.filter=2;assert.ok(m.marks().every(p=>p.kind==='food'||p.kind==='shop'));m.filter=4;assert.ok(m.visiblePlaces().length===0);assert.equal(m.hover(),null);
});
test('Метка выбирает доступную землю, сохраняется и строит настоящий путь',({w,m})=>{
 const shop=m.marks().find(p=>p.kind==='shop');m.openMark(shop);assert.ok(m.card);m.card.opts[1].act();const mk=G.state.marker;assert.equal(mk.label,shop.label);assert.equal(G.nav.walkGrid(w.map)[mk.y*w.map.w+mk.x],1);assert.equal(G.storage.load().marker.label,shop.label);const route=m.routePreview();assert.ok(route.pts.length>1);for(const [x,y]of route.pts)assert.equal(G.nav.walkGrid(w.map)[y*w.map.w+x],1);
 m.openMark(shop);m.card.opts[1].act();assert.equal(G.storage.load().marker,null);
});
test('Масштаб до восьми и возврат к герою сохраняют правильные координаты',({w,m})=>{
 for(let i=0;i<8;i++)m.changeZoom(1);assert.equal(m.zoom,8);m.cx=4;m.cy=4;m.centerHero();assert.equal(m.cx,w.player.x/16);const [x,y]=m.toScreen(m.cx,m.cy);assert.ok(x>=0&&x<=G.screen.W&&y>=72&&y<=G.screen.H-46);for(let i=0;i<8;i++)m.changeZoom(-1);assert.equal(m.zoom,1);
});
test('Выбор задания сохраняет слежение и убирает личную метку вместо замены цели координатами',({w,m})=>{
 G.scenes.pop();G.quests.start('street_lantern');G.state.marker={x:10,y:10,label:'Старая метка'};const map=G.scenes.make('mapview',w);G.scenes.push(map);const mark=map.marks().find(p=>p.quest==='street_lantern');assert.ok(mark);map.openMark(mark);assert.equal(map.card.opts[0].label,'Следить и идти');map.card.opts[0].act();assert.equal(G.quests.tracked(),'street_lantern');assert.equal(G.storage.load().tracked,'street_lantern');assert.equal(G.storage.load().marker,null);
});
test('Настройки карты переживают загрузку, повреждённые значения заменяются допустимыми',()=>{
 Object.assign(G.storage.settings,{mapDetail:'simple',mapMarkerSize:1.3,mapLabels:false});G.storage.saveSettings();Object.assign(G.storage.settings,{mapDetail:'detailed',mapMarkerSize:1,mapLabels:true});G.storage.loadSettings();assert.equal(G.storage.settings.mapDetail,'simple');assert.equal(G.storage.settings.mapMarkerSize,1.3);assert.equal(G.storage.settings.mapLabels,false);G.storage._set(G.storage.KEY_SETTINGS,{mapDetail:'oops',mapMarkerSize:999});G.storage.loadSettings();assert.equal(G.storage.settings.mapDetail,'detailed');assert.equal(G.storage.settings.mapMarkerSize,1);
});
test('Комнаты и новые территории рисуют мини-карту без ложных координат и исключений',({w})=>{
 const c=h.recordingCtx();for(const key of ['adv:forest','adv:tower',G.world.heroHome().interior.id]){w.setMap({map:key,entry:true});G.cartography.minimap(c,w,G.screen.W);}assert.ok(!c.log.some(s=>s.includes('NaN')));
});
console.log(`ИТОГ картографии: ✔ ${passed}  ✘ ${failed}`);process.exitCode=failed?1:0;
