// Карта настоящими касаниями: настройки, масштаб, перетаскивание, знаки и маршрут.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const shots=path.join(__dirname,'shots','cartography');fs.mkdirSync(shots,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});try{
 const page=await browser.newPage({viewport:{width:393,height:759},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/index.html');await page.waitForFunction('window.G&&G.cartography');
 await page.evaluate(()=>{
  const st=G.game.newState();st.started=true;st.hero.name='Кайто';st.hero.stats={tai:6,nin:5,gen:4,chakra:5,ctrl:5,spd:6,end:5,know:4};st.hero.skills=[];
  Object.assign(st.flags,{hosp_done:1,enrolled:1,day2_intro:1,roofs:1,home_seen:1,naruto_invited:1,ramen_done:1,frd_init:1,tip_clock:1});st.vars.day=6;st.vars.min=900;st.vars.friend_naruto=3;st.vars.friend_sakura=3;st.daily.lesson=1;st.quests.day1={st:'done',step:5,day:1};
  G.life.RATE=0;G.story.poll=()=>false;G.audio.enabled=false;G.debug.on=false;Object.assign(G.storage.settings,{mapDetail:'detailed',mapMarkerSize:1,mapLabels:true});
  G.scenes.stack.length=0;G.scenes.fade={a:0,dir:0,speed:3,then:null};G.scenes.push(G.scenes.make('world',G.world.outsideOf(G.world.heroHome())));
 });
 const idle=()=>page.waitForTimeout(130),shot=async name=>page.screenshot({path:path.join(shots,name+'.png')});
 async function local(x,y){return page.evaluate(({x,y})=>{const r=G.screen.canvas.getBoundingClientRect();return{x:r.x+x*r.width/G.screen.W,y:r.y+y*r.height/G.screen.H};},{x,y});}
 async function tap(x,y){const p=await local(x,y);await page.touchscreen.tap(p.x,p.y);await idle();}
 async function row(i,n=5,w=220){const p=await page.evaluate(({i,n,w})=>{const r=G.ui.menu.rect(n,w);return{x:r.x+24,y:G.ui.menu.rowY(r,i)+8};},{i,n,w});await tap(p.x,p.y);}
 await page.evaluate(()=>G.scenes.push(G.scenes.make('settings')));await idle();await row(2,12,214);assert.equal(await page.evaluate('G.scenes.top().name'),'mapsettings');await row(1);assert.equal(await page.evaluate('G.storage.settings.mapDetail'),'simple');await row(2);assert.equal(await page.evaluate('G.storage.settings.mapMarkerSize'),1.3);await row(3);assert.equal(await page.evaluate('G.storage.settings.mapLabels'),false);await row(3);await shot('settings');
 await page.keyboard.press('KeyX');await idle();await page.keyboard.press('KeyX');await idle();await page.keyboard.press('KeyM');await idle();assert.equal(await page.evaluate('G.scenes.top().name'),'mapview');await shot('fog');
 // Для сравнения подложки открываем все участки только в тестовом состоянии.
 await page.evaluate(()=>{const s=G.nav.fogSize();G.state.fog='1'.repeat(s.bw*s.bh);});await idle();await shot('simple');
 await page.evaluate(()=>{G.storage.settings.mapDetail='detailed';G.storage.saveSettings();});await idle();await shot('overview');
 const initial=await page.evaluate('G.scenes.top().zoom');await tap(await page.evaluate('G.screen.W*3/8'),48);assert.equal(await page.evaluate('G.scenes.top().zoom'),initial*2);await shot('close');
 if(await page.evaluate('G.scenes.top().zoom')<8)await tap(await page.evaluate('G.screen.W*3/8'),48);
 const before=await page.evaluate('({x:G.scenes.top().vx,y:G.scenes.top().vy})'),cdp=await page.context().newCDPSession(page),start=await local(220,270),end=await local(130,205);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y}]});await page.waitForTimeout(60);
 for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/6,y:start.y+(end.y-start.y)*i/6}]});await page.waitForTimeout(35);}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await idle();assert.equal(await page.evaluate('G.scenes.top().name'),'mapview');const after=await page.evaluate('({x:G.scenes.top().vx,y:G.scenes.top().vy})');assert.ok(Math.hypot(after.x-before.x,after.y-before.y)>5);assert.equal(await page.evaluate('G.scenes.top().card'),null);console.log('✔ Настройки, подробная подложка, увеличение и настоящий жест перетаскивания');
 await tap(await page.evaluate('G.screen.W*5/8'),48);assert.ok(await page.evaluate('Math.abs(G.scenes.top().cx-G.scenes.stack[0].player.x/16)<.1'));
 await tap(await page.evaluate('G.screen.W*7/8'),48);assert.equal(await page.evaluate('G.scenes.top().legend'),true);await shot('legend');await tap(150,200);assert.equal(await page.evaluate('G.scenes.top().legend'),false);
 // Открываем реальный значок лавки в фильтре, координаты карточки и метки остаются мировыми.
 await page.evaluate(()=>{const m=G.scenes.top(),shop=m.marks().find(p=>p.kind==='shop');m.cx=shop.x;m.cy=shop.y;m.zoom=8;m.filter=2;m.fitView(true);window.mapShop=shop.label;});await idle();
 const point=await page.evaluate(()=>{const m=G.scenes.top(),q=m.clusters().find(q=>q.items.some(p=>p.label===window.mapShop));return{x:q.x,y:q.y};});await tap(point.x,point.y);
 if(await page.evaluate('G.scenes.top().name')==='pick'){const index=await page.evaluate('G.scenes.stack[G.scenes.stack.length-2].clusters().find(q=>q.items.some(p=>p.label===window.mapShop)).items.findIndex(p=>p.label===window.mapShop)');for(let i=0;i<index;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('KeyZ');await idle();}
 assert.ok(await page.evaluate('!!G.scenes.top().card'));await shot('place-card');const option=await page.evaluate(()=>{const m=G.scenes.top(),r=m.cardRect();return{x:r.x+25,y:r.btnY+22+8};});await tap(option.x,option.y);assert.equal(await page.evaluate('G.state.marker.label'),await page.evaluate('window.mapShop'));assert.equal(await page.evaluate('G.storage.load().marker.label'),await page.evaluate('window.mapShop'));await shot('route');
 assert.ok(await page.evaluate('G.scenes.top().routePreview().pts.length>1'));
 await page.evaluate(()=>{const m=G.scenes.top();m.zoom=2;m.filter=0;m.fitView(true);});await idle();const group=await page.evaluate(()=>{const m=G.scenes.top(),q=m.clusters().find(q=>q.items.length>1&&q.x>12&&q.x<G.screen.W-12&&q.y>84);return{x:q.x,y:q.y,label:q.items[1].label};});await tap(group.x,group.y);assert.equal(await page.evaluate('G.scenes.top().name'),'pick');await shot('cluster-menu');await page.keyboard.press('ArrowDown');await page.keyboard.press('KeyZ');await idle();assert.equal(await page.evaluate('G.scenes.top().card.p.name'),group.label);await page.keyboard.press('KeyX');await idle();console.log('✔ Условные знаки, группа с выбором, карточка, сохранённая метка и маршрут');
 await page.keyboard.press('KeyX');await idle();await shot('minimap');
 await page.keyboard.press('KeyM');await idle();
 for(const size of [{width:320,height:568},{width:393,height:759},{width:820,height:1180}]){await page.setViewportSize(size);await page.waitForTimeout(180);const r=await page.evaluate(()=>{const m=G.scenes.top(),c=G.gfx.canvas(G.screen.W,G.screen.H);m.draw(c.getContext('2d'));return m.toScreen(m.cx,m.cy);});assert.ok(r[0]>=0&&r[0]<=await page.evaluate('G.screen.W'));await shot('screen-'+size.width);}
 await page.evaluate(()=>{G.storage.loadSettings();if(G.storage.settings.mapDetail!=='detailed'||G.storage.settings.mapMarkerSize!==1.3)throw Error('Не сохраняются настройки');});await page.setViewportSize({width:393,height:759});await page.waitForTimeout(180);await page.keyboard.press('KeyX');await idle();await page.evaluate(()=>G.scenes.push(G.scenes.make('settings')));await idle();await row(2,12,214);await shot('settings-detailed');assert.deepEqual(errors,[]);console.log('✔ Мини-карта, три размера экрана и загрузка настроек; ошибок JavaScript нет');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
