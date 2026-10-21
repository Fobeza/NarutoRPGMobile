// Полировка меню и статуса: реальные касания на пяти телефонах, экране 320×568 и трёх плотностях.
'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch(),errors=[];
try{for(const [phone,width,height,dpr]of [['SE',375,667,2],['XR',414,896,2],['15Pro',393,759,3],['mini',375,812,3],['small320',320,568,2],['ProMax',430,932,3]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/');await page.waitForFunction(()=>window.G?.game);
 await page.evaluate(()=>{const s=G.game.newState();s.started=true;s.hero.name='Кайто';s.hero.stats={tai:6,nin:5,gen:4,chakra:5,ctrl:5,spd:6,end:5,know:4};s.hero.skills=['eagle_eye','diligent'];for(const id of Object.keys(G.FRIENDS))s.flags['met_'+id]=1;G.audio.enabled=false;G.scenes.fade={a:0,dir:0,speed:3,then:null};G.scenes.replace({name:'test',draw(){},update(){}});});
 async function tap(x,y){const p=await page.evaluate(({x,y})=>{const r=G.screen.canvas.getBoundingClientRect();return{x:r.x+x*r.width/G.screen.W,y:r.y+y*r.height/G.screen.H};},{x,y});await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(80);}
 for(const density of ['big','mid','fine']){
  await page.evaluate(d=>{G.storage.settings.density=d;G.storage.settings.lefty=true;G.storage.settings.buttonSize=1.4;G.storage.settings.minimap=false;G.storage.settings.fx=false;G.screen.resize();while(G.scenes.stack.length>1)G.scenes.pop();G.scenes.push(G.scenes.make('menu'));},density);
  const geo=await page.evaluate(()=>{const s=G.scenes.top(),g=s.layout();return{g,rows:s.visibleRows(),W:G.screen.W,H:G.screen.H,sc:G.screen.scale,labels:s.labels(),widths:s.labels().map(l=>G.font.measure(l)*g.z)};});
  assert.ok(geo.g.x>=0&&geo.g.y>=0&&geo.g.x+geo.g.w<=geo.W&&geo.g.y+geo.g.h<=geo.H);
  for(const r of geo.rows){assert.ok(r.w*geo.sc>=44&&r.h*geo.sc>=44);assert.ok(r.y+r.h<=geo.H);}
  for(const w of geo.widths)assert.ok(w<=geo.g.w-28,'Обрезанная подпись '+phone+'/'+density);
  const status=geo.rows.find(r=>r.label==='Статус');assert.ok(status);await tap(status.x+status.w/2,status.y+status.h/2);
  assert.equal(await page.evaluate(()=>G.scenes.top().name),'status');
  const info=await page.evaluate(()=>({g:G.scenes.top().layout(),W:G.screen.W,H:G.screen.H,sc:G.screen.scale,state:JSON.stringify(G.state)}));
  assert.ok(info.g.gaugeWidth>=68);assert.ok((info.g.footer-4)*info.sc>=44);
  if(info.g.maxScroll>0){for(let i=0;i<10;i++)await tap(info.W*.75,info.H-info.g.footer/2);const end=await page.evaluate(()=>G.scenes.top().layout());assert.equal(end.scroll,end.maxScroll);await tap(info.W*.25,info.H-info.g.footer/2);assert.ok(await page.evaluate(()=>G.scenes.top().layout().scroll<G.scenes.top().layout().maxScroll));}
  assert.equal(await page.evaluate(()=>JSON.stringify(G.state)),info.state);
  await page.evaluate(()=>{G.scenes.pop();G.scenes.pop();G.scenes.push(G.scenes.make('menu'));});
  // Нижние пункты доступны и после прокрутки; касание страницы не выбирает пункт.
  const before=await page.evaluate(()=>G.scenes.top().layout());
  if(before.paged){for(let i=0;i<3;i++)await tap(before.x+before.w*.75,before.top+(before.rows+.5)*before.row);assert.equal(await page.evaluate(()=>G.scenes.top().name),'menu');assert.ok(await page.evaluate(()=>G.scenes.top().visibleRows().some(r=>r.label==='В главное меню')));}
  await page.keyboard.press('ArrowUp');await page.waitForTimeout(60);
  console.log('✔ '+phone+' / '+density+': касания, подписи, прокрутка, неизменность сохранения');
 }
 await context.close();
}assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
