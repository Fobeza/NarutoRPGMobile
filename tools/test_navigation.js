// Настоящие касания: крупный «Назад» не забирает вкладки и возвращает на правильный уровень.
'use strict';
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch(),errors=[];
try{for(const [phone,width,height,dpr]of [['small320',320,568,2],['15Pro',393,759,3],['ProMax',430,932,3]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true,serviceWorkers:'block'}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:8765/');await p.waitForFunction(()=>window.G?.touch);
 await p.evaluate(()=>{G.game.newState();G.state.started=true;G.state.vars.day=6;G.state.quests.day1={st:'active',step:0,day:1};G.audio.enabled=false;G.scenes.fade={a:0,dir:0,speed:3,then:null};G.scenes.replace({name:'test',draw(){},update(){}});});
 async function tap(x,y){const pt=await p.evaluate(({x,y})=>{const r=G.screen.canvas.getBoundingClientRect();return{x:r.x+x*r.width/G.screen.W,y:r.y+y*r.height/G.screen.H};},{x,y});await p.touchscreen.tap(pt.x,pt.y);await p.waitForTimeout(80);}
 async function labels(){return p.evaluate(()=>{const labels=[],old=G.font.draw,small=G.font.small.draw;G.font.draw=function(c,t,...args){labels.push(t);return old(c,t,...args);};G.font.small.draw=function(c,t,...args){labels.push(t);return small(c,t,...args);};try{G.scenes.draw(G.screen.ctx);}finally{G.font.draw=old;G.font.small.draw=small;}return labels;});}
 for(const density of ['big','mid','fine'])for(const scene of ['status','journal','calendar']){
  await p.evaluate(({density,scene})=>{while(G.scenes.stack.length>1)G.scenes.pop();G.storage.settings.density=density;G.storage.settings.lefty=true;G.storage.settings.buttonSize=1.4;G.screen.resize();G.scenes.push(G.scenes.make(scene));G.scenes.draw(G.screen.ctx);G.touch.draw(G.screen.ctx);},{density,scene});
  await p.waitForTimeout(60);
  const g=await p.evaluate(()=>{const h=G.touch.header(),b=h.back;return {...h,W:G.screen.W,H:G.screen.H,scale:G.screen.scale,state:JSON.stringify(G.state),edge:G.touch.hit({x:b.x+b.w-1,y:b.y+b.h-1}),outside:G.touch.hit({x:b.x+b.w+1,y:b.y+b.h-1}),below:G.touch.hit({x:8,y:h.height+10})};});
  assert.ok(g.back.w*g.scale>=44&&g.back.h*g.scale>=44);assert.equal(g.edge,'b');assert.equal(g.outside,null);assert.equal(g.below,null);
  assert.ok(g.back.x+g.back.w<g.titleX-50,'Заголовок не должен пересекать кнопку');
  if(scene==='calendar'){
   await tap(g.W*.75,g.height+10);assert.ok((await labels()).includes('БУДНИ'),'Вкладка расписания');
   await tap(g.W*.25,g.height+10);await tap(7+(g.W-14)/14,g.height-20+84);assert.ok((await labels()).some(t=>String(t).startsWith('1 июня ·')),'Выбор первого дня после сдвига');
  }
  if(scene==='journal'){
   await tap(g.W*.75,g.height+10);assert.ok((await labels()).includes('Пока пусто'),'Вкладка завершённых');
   await tap(g.W*.25,g.height+10);await tap(g.W/2,g.height-20+55);assert.ok((await labels()).includes('Отслеживать'),'Открыть описание');
   // Локальный «Назад» в описании тоже ≥44 CSS и не закрывает весь журнал.
   await tap(g.W*.75,g.H-6);assert.equal(await p.evaluate(()=>G.scenes.top().name),'journal');assert.ok(!(await labels()).includes('Отслеживать'));
   await tap(g.W/2,g.height-20+55);await tap(g.back.x+g.back.w-1,g.back.y+g.back.h-1);
   assert.equal(await p.evaluate(()=>G.scenes.top().name),'journal');assert.ok(!(await labels()).includes('Отслеживать'),'Верхний Назад закрывает только описание');
  }
  await tap(g.back.x+g.back.w-1,g.back.y+g.back.h-1);assert.equal(await p.evaluate(()=>G.scenes.top().name),'test');
  assert.equal(await p.evaluate(()=>JSON.stringify(G.state)),g.state,'Просмотр не меняет сохранение');
  await p.evaluate(s=>G.scenes.push(G.scenes.make(s)),scene);await p.keyboard.press('KeyX');await p.waitForTimeout(60);assert.equal(await p.evaluate(()=>G.scenes.top().name),'test');
  console.log('✔ '+phone+'/'+density+'/'+scene+': ≥44 CSS, границы, вкладки, возврат и сохранение');
 }
 await context.close();
}assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
