// Все 36 новых мастеров: прежняя геометрия, офлайн, PNG, зеркала и восстановление.
'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),{pathToFileURL}=require('url'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();try{
 const p=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const base=process.env.GAME_URL||'http://127.0.0.1:8765/';await p.goto(new URL('map-editor.html',base).href);await p.waitForFunction(()=>window.mapEditor);
 const specs=JSON.parse(fs.readFileSync('tools/editor_art_specs.json')),manifest=JSON.parse(fs.readFileSync('art/editor-world/manifest.json'));
 const ids=await p.evaluate(()=>G.editorArt.ids);assert.equal(ids.length,36);assert.deepEqual([...ids].sort(),Object.keys(manifest).sort());
 const measured=await p.evaluate(()=>Object.fromEntries(G.editorArt.ids.map(id=>{const s=G.editorArt.sprite(id);return[id,{w:s.w,h:s.h,ox:s.ox,oy:s.oy}]})));assert.deepEqual(measured,specs,'Прежние bounds сохранены');
 const m=await p.evaluate(()=>({format:'naruto-phone-map',version:2,name:'36 мастеров',w:64,h:64,ground:Array(4096).fill(0),objects:G.editorArt.ids.map((id,i)=>({kind:'prop',id,x:5+i%6*9,y:8+Math.floor(i/6)*9,scale:1,flipX:i%2===0,flipY:i%3===0}))}));
 await p.click('#files');await p.setInputFiles('#file',{name:'all.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(m))});assert.deepEqual(await p.evaluate(()=>mapEditor.export()),m);
 await p.click('#files');const promise=p.waitForEvent('download');await p.click('#png');const download=await promise;fs.mkdirSync('tools/shots/editor-integrated',{recursive:true});const target='tools/shots/editor-integrated/all-36.png';await download.saveAs(target);await p.locator('#menu [data-close]').click();
 const result=await p.evaluate(async data=>{const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;let count=0;
 for(const o of mapEditor.export().objects){const s=G.editorArt.sprite(o.id),b=mapEditor.geometry(o).bounds,src=s.img.getContext('2d').getImageData(0,0,s.img.width,s.img.height).data;let checked=0;
 for(let y=0;y<s.img.height;y++)for(let x=0;x<s.img.width;x++){const i=(y*s.img.width+x)*4;if(src[i+3]!==255)continue;const xx=b.x*2+(o.flipX?s.img.width-1-x:x),yy=b.y*2+(o.flipY?s.img.height-1-y:y),j=(yy*c.width+xx)*4;if([0,1,2].some(k=>src[i+k]!==pixels[j+k]))return {error:o.id,x,y};checked++;}
 if(!checked)return {empty:o.id};count++;}return{count};},fs.readFileSync(target).toString('base64'));assert.deepEqual(result,{count:36},'PNG содержит каждый новый спрайт с зеркалами');
 await p.waitForTimeout(600);await p.reload();await p.waitForFunction(()=>window.mapEditor);assert.deepEqual(await p.evaluate(()=>mapEditor.export()),m);
 const offline=await browser.newContext({offline:true});const page=await offline.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(pathToFileURL(path.resolve('map-editor.html')).href);await page.waitForFunction(()=>window.mapEditor);assert.equal(await page.evaluate(()=>G.editorArt.ids.filter(id=>G.editorArt.sprite(id).img.width>0).length),36);await offline.close();assert.deepEqual(errors,[]);
 console.log('✔ 36 мастеров: прежние bounds/ID, JSON, зеркальные пиксели PNG, восстановление и автономный file://');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
