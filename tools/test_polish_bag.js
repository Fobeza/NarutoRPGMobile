// Сумка: реальные касания, границы карточек, страницы и расход вещей на всей телефонной матрице.
'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch(),errors=[];
try{for(const [phone,width,height,dpr]of [['SE',375,667,2],['XR',414,896,2],['15Pro',393,759,3],['mini',375,812,3],['small320',320,568,2],['ProMax',430,932,3]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.GAME_URL||'http://127.0.0.1:8765/');await page.waitForFunction(()=>window.G?.game);
 await page.evaluate(()=>{G.game.newState();G.audio.enabled=false;G.scenes.fade={a:0,dir:0,speed:3,then:null};G.scenes.replace(G.scenes.make('menu'));});
 async function tap(x,y){const p=await page.evaluate(({x,y})=>{const r=G.screen.canvas.getBoundingClientRect();return{x:r.x+x*r.width/G.screen.W,y:r.y+y*r.height/G.screen.H};},{x,y});await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(70);}
 const center=r=>tap(r.x+r.w/2,r.y+r.h/2);
 const geo=()=>page.evaluate(()=>G.scenes.top().layout());
 const state=()=>page.evaluate(()=>JSON.stringify(G.state));
 async function reset(inv){await page.evaluate(inv=>{while(G.scenes.stack.length>1)G.scenes.pop();G.state.inv=inv||Object.fromEntries(Object.keys(G.ITEMS).map(id=>[id,2]));G.state.vars.hp=25;G.scenes.push(G.scenes.make('bag'));},inv);await page.waitForTimeout(70);}
 for(const density of ['big','mid','fine']){
  await page.evaluate(d=>{Object.assign(G.storage.settings,{density:d,lefty:true,buttonSize:1.4,minimap:false,fx:false});G.screen.resize();},density);await reset();
  let g=await geo();const bounds=await page.evaluate(()=>({W:G.screen.W,H:G.screen.H,sc:G.screen.scale,cards:G.scenes.top().visibleCards()}));
  for(const r of [g.back,g.apply,g.prev,g.next,...bounds.cards]){
   assert.ok(r.w*bounds.sc>=44&&r.h*bounds.sc>=44,phone+'/'+density+' малая зона');
   assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=bounds.W&&r.y+r.h<=bounds.H);
  }
  assert.ok(g.grid.y+g.grid.h<=g.prev.y);assert.ok(g.prev.y+g.prev.h<=g.desc.y);
  const initial=await state();
  await center(g.prev);assert.equal((await geo()).selected,0);
  // Нижняя полоса и промежутки вокруг кнопки не применяют предмет.
  for(const [x,y]of [[1,g.apply.y+g.apply.h/2],[bounds.W-1,g.apply.y+5],[bounds.W/2,bounds.H-1],[bounds.W/2,g.apply.y-1],[g.grid.x+2,g.grid.y+8],[g.grid.x+10,g.grid.y+g.grid.h-3]])await tap(x,y);
  assert.equal((await geo()).selected,0);assert.equal(await state(),initial);
  const visited=new Set();
  for(let pg=0;pg<g.pages;pg++){
   const cards=await page.evaluate(()=>G.scenes.top().visibleCards());cards.forEach(r=>visited.add(r.id));
   await center(cards[cards.length-1]);assert.equal((await geo()).selected,cards[cards.length-1].index);
   await center(g.next);assert.equal((await geo()).page,Math.min(pg+1,g.pages-1));
  }
  assert.equal(visited.size,await page.evaluate(()=>Object.keys(G.ITEMS).length));
  g=await geo();const last=g.selected;await center(g.next);assert.equal((await geo()).selected,last);
  const cards=await page.evaluate(()=>G.scenes.top().visibleCards());
  if(cards.length<g.grid.per){const k=cards.length;await tap(g.grid.x+6+(k%g.grid.cols)*g.grid.cardW+4,g.grid.y+6+Math.floor(k/g.grid.cols)*g.grid.cardH+4);assert.equal((await geo()).selected,last);}
  await center(g.prev);assert.equal((await geo()).page,g.pages-2);
  assert.equal(await state(),initial);
  assert.ok(await page.evaluate(()=>{const before=JSON.stringify(G.state);for(let i=0;i<3;i++)G.scenes.top().draw(G.screen.ctx);return before===JSON.stringify(G.state);}));
  // Неактивная кнопка не вызывает даже обработчик использования.
  await reset({kunai:1});g=await geo();const disabled=await state();
  await page.evaluate(()=>{window.realUse=G.game.useItem;window.useCalls=0;G.game.useItem=function(...args){window.useCalls++;return window.realUse.apply(this,args);};});
  await center(g.apply);assert.equal(await page.evaluate(()=>window.useCalls),0);assert.equal(await state(),disabled);
  await page.evaluate(()=>G.game.useItem=window.realUse);
  await reset({bandage:1});g=await geo();await center(g.apply);
  assert.equal(await page.evaluate(()=>G.game.count('bandage')),0);assert.ok(await page.evaluate(()=>G.state.vars.hp>25));
  const empty=await state();await center(g.apply);await center(g.next);await center(g.prev);assert.equal(await state(),empty);
  await center(g.back);assert.equal(await page.evaluate(()=>G.scenes.top().name),'menu');
  await reset({});g=await geo();await center(g.back);assert.equal(await page.evaluate(()=>G.scenes.top().name),'menu');
  await reset({bandage:1,kunai:1,shuriken:1});await page.keyboard.press('ArrowUp');await page.waitForTimeout(70);
  assert.ok((await geo()).selected>=0&&(await geo()).selected<3,'Короткий ряд: переход вверх');
  await reset({bandage:1});await page.keyboard.press('Enter');await page.waitForTimeout(70);
  assert.equal(await page.evaluate(()=>G.game.count('bandage')),0);
  await page.keyboard.press('Escape');await page.waitForTimeout(70);assert.equal(await page.evaluate(()=>G.scenes.top().name),'menu');
  console.log('✔ '+phone+'/'+density+': зоны ≥44 CSS, все страницы, пустые ячейки, применение, пустая сумка, Назад, клавиатура, чистота состояния');
 }
 await context.close();
}assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
