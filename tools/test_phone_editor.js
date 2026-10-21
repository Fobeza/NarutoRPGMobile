// Мобильный редактор: настоящие касания, жесты, файлы, отмена и отдельный черновик.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();const errors=[];fs.mkdirSync('tools/shots/editor',{recursive:true});
try{for(const [label,width,height]of [['small320',320,568],['15Pro',393,759],['ProMax',430,932]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block',acceptDownloads:true});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 await p.goto(new URL('map-editor.html',process.env.GAME_URL||'http://127.0.0.1:8765/').href);await p.waitForFunction(()=>window.mapEditor);await p.waitForTimeout(100);
 await p.evaluate(()=>{localStorage.setItem('wof_save_v1','game-save-untouched');localStorage.setItem('wof_settings','game-settings-untouched');});
 const initial=await p.evaluate(()=>mapEditor.export());assert.equal(initial.objects.length,0);assert.ok(initial.ground.every(x=>x===0));
 const sizes=await p.evaluate(()=>[...document.querySelectorAll('header button,.tools button,#zoom button,footer select')].map(b=>({text:b.textContent,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})));
 for(const b of sizes)assert.ok(b.w>=44&&b.h>=44,`${label}: маленькая кнопка ${b.text} ${b.w}×${b.h}`);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.ok(await p.evaluate(()=>[...document.querySelectorAll('.tools button')].every(b=>b.scrollWidth<=b.clientWidth)),'Подписи инструментов не обрезаны');
 const view=await p.locator('#stage').boundingBox(),center={x:view.x+view.width/2,y:view.y+view.height/2};
 await p.selectOption('#item','4');await p.touchscreen.tap(center.x,center.y);await p.waitForTimeout(80);
 let painted=await p.evaluate(()=>mapEditor.export());assert.equal(painted.ground.filter(x=>x===4).length,1);
 await p.click('#undo');assert.deepEqual(await p.evaluate(()=>mapEditor.export()),initial);await p.click('#redo');assert.deepEqual(await p.evaluate(()=>mapEditor.export()),painted);
 // Непрерывный мазок настоящими touch-событиями; вся линия отменяется одним нажатием.
 const cdp=await context.newCDPSession(p);const a={x:center.x-50,y:center.y+25};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x+50,y:a.y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(100);
 assert.ok((await p.evaluate(()=>mapEditor.export())).ground.filter(x=>x===4).length>3);await p.click('#undo');assert.deepEqual(await p.evaluate(()=>mapEditor.export()),painted);
 // Жест двумя пальцами отменяет пробную точку первого пальца и не рисует карту.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:center.x-30,y:center.y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:center.x-30,y:center.y,id:1},{x:center.x+30,y:center.y,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x-50,y:center.y+10,id:1},{x:center.x+50,y:center.y+10,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(80);assert.deepEqual(await p.evaluate(()=>mapEditor.export()),painted);
 await p.click('[data-tool="pan"]');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[center]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:center.x+20,y:center.y+20}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.deepEqual(await p.evaluate(()=>mapEditor.export()),painted);
 await p.click('#fit');await p.selectOption('#category','prop');await p.selectOption('#item','tree');await p.touchscreen.tap(center.x,center.y);await p.waitForTimeout(100);assert.equal((await p.evaluate(()=>mapEditor.export())).objects.length,1);
 await p.selectOption('#category','building');const house=await p.locator('#item option').first().getAttribute('value');await p.touchscreen.tap(center.x+15,center.y+15);await p.waitForTimeout(100);assert.ok((await p.evaluate(()=>mapEditor.export())).objects.some(o=>o.kind==='building'));
 const withObjects=await p.evaluate(()=>mapEditor.export());
 await p.click('[data-tool="erase"]');await p.touchscreen.tap(center.x+15,center.y+15);assert.ok((await p.evaluate(()=>mapEditor.export())).objects.length<withObjects.objects.length);await p.click('#undo');assert.deepEqual(await p.evaluate(()=>mapEditor.export()),withObjects);
 await p.click('[data-tool="paint"]');await p.screenshot({path:`tools/shots/editor/${label}.png`,scale:'css'});
 await p.click('#files');await p.fill('#name','Моя карта');await p.locator('#name').blur();
 const expected=await p.evaluate(()=>mapEditor.export());const downloadPromise=p.waitForEvent('download');await p.click('#save');const d=await downloadPromise;const dest=`tools/shots/editor/${label}.json`;await d.saveAs(dest);assert.deepEqual(JSON.parse(fs.readFileSync(dest)),expected);
 const pngPromise=p.waitForEvent('download');await p.click('#png');const png=await pngPromise;await png.saveAs(`tools/shots/editor/${label}-map.png`);assert.equal(fs.readFileSync(`tools/shots/editor/${label}-map.png`).subarray(1,4).toString(),'PNG');
 await p.click('#new');assert.equal((await p.evaluate(()=>mapEditor.export())).objects.length,0);
 await p.click('#files');await p.setInputFiles('#file',dest);await p.waitForTimeout(100);assert.deepEqual(await p.evaluate(()=>mapEditor.export()),expected);
 await p.click('#files');await p.setInputFiles('#file',{name:'broken.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...expected,version:99}))});await p.waitForTimeout(100);assert.deepEqual(await p.evaluate(()=>mapEditor.export()),expected,'Ошибочный импорт не должен менять карту');await p.locator('#menu [data-close]').click();
 await p.waitForTimeout(650);await p.reload();await p.waitForFunction(()=>window.mapEditor);assert.deepEqual(await p.evaluate(()=>mapEditor.export()),expected);
 assert.ok(fs.statSync('map-editor.html').size<5*1024*1024,'Автономный файл <5 МиБ');
 const validation=await p.evaluate(()=>{const base=mapEditor.export(),bad=[{...base,version:2},{...base,w:10000},{...base,ground:[999]},{...base,objects:[{kind:'prop',id:'__proto__',x:2,y:2}]},{...base,objects:[{kind:'prop',id:'tree',x:-1,y:0}]}];return bad.every(v=>{try{mapEditor.validate(v);return false;}catch{return true;}});});assert.ok(validation);
 // Скачанный HTML запускается без сервера и без сети. Окно меню не должно застрять открытым.
 if(label==='15Pro'){
  await p.click('#files');const promise=p.waitForEvent('download');await p.click('#download');const html=await promise;await html.saveAs('tools/shots/editor/standalone.html');
  const off=await browser.newContext({offline:true});const local=await off.newPage();local.on('pageerror',e=>errors.push(e.message));await local.goto('file://'+process.cwd()+'/tools/shots/editor/standalone.html');await local.waitForFunction(()=>window.mapEditor);assert.equal(await local.locator('dialog[open]').count(),0);await local.click('#files');assert.equal(await local.locator('dialog[open]').count(),1);await off.close();
 }
 assert.ok(await p.evaluate(()=>!window.G.game&&window.G.state.started===false));
 assert.equal(await p.evaluate(()=>localStorage.getItem('wof_save_v1')),'game-save-untouched');assert.equal(await p.evaluate(()=>localStorage.getItem('wof_settings')),'game-settings-untouched');
 console.log('✔ '+label+': ≥44px, кисть/линия/жесты, объекты/дом, undo/redo, JSON/PNG, восстановление');
 await context.close();
}assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
