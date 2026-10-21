// Расширение карты, старые проекты, перенос пальцем, предпросмотр, отражения и размер.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch(),errors=[];fs.mkdirSync('tools/shots/editor-transform',{recursive:true});
try{for(const [width,height] of [[320,568],[393,759],[430,932]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true,acceptDownloads:true,serviceWorkers:'block'}),p=await context.newPage();let accept=true;
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>accept?d.accept():d.dismiss());
 await p.goto(new URL('map-editor.html',process.env.GAME_URL||'http://127.0.0.1:8765/').href);await p.waitForFunction(()=>window.mapEditor);
 const legacy=await p.evaluate(()=>{const m=mapEditor.export();m.version=1;m.ground=m.ground.map((_,i)=>i%32<5&&Math.floor(i/32)>20?4:i%32===18?17:0);m.objects=[{kind:'building',id:Object.keys(G.HOUSE_ART.art)[0],x:12,y:10},{kind:'prop',id:'tree',x:7,y:16}];return m;});
 await p.click('#files');await p.setInputFiles('#file',{name:'old-map.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await p.waitForTimeout(100);
 let m=await p.evaluate(()=>mapEditor.export());assert.equal(m.version,2);assert.ok(m.objects.every(o=>o.scale===1&&!o.flipX&&!o.flipY));
 const cdp=await context.newCDPSession(p);
 async function point(x,y){return p.evaluate(({x,y})=>{const r=document.getElementById('view').getBoundingClientRect(),v=mapEditor.view();return{x:r.x+v.ox+x*v.zoom,y:r.y+v.oy+y*v.zoom};},{x,y});}
 async function touch(type,pos){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pos?[pos]:[]});await p.waitForTimeout(60);}
 async function png(){await p.click('#files');const promise=p.waitForEvent('download');await p.click('#png');const d=await promise,path=`tools/shots/editor-transform/export-${width}.png`;await d.saveAs(path);await p.locator('#menu [data-close]').click();return fs.readFileSync(path).toString('base64');}
 // Отражённый PNG обязан содержать действительно отражённые непрозрачные пиксели спрайта.
 const house=m.objects[0],hb=await p.evaluate(o=>mapEditor.geometry(o).bounds,house),hp=await point(hb.x+hb.w/2,hb.y+hb.h/2);
 await p.click('[data-tool="select"]');await p.touchscreen.tap(hp.x,hp.y);await p.click('#flip-x');
 assert.ok((await p.evaluate(()=>mapEditor.export())).objects[0].flipX);
 const image=await png();const pixels=await p.evaluate(async data=>{const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();const canvas=document.createElement('canvas');canvas.width=im.width;canvas.height=im.height;const c=canvas.getContext('2d');c.drawImage(im,0,0);const all=c.getImageData(0,0,im.width,im.height).data,o=mapEditor.export().objects[0],s=G.houseArt.sprite(o.id),b=mapEditor.geometry(o).bounds,src=s.img.getContext('2d').getImageData(0,0,s.img.width,s.img.height).data;let count=0;for(let y=0;y<s.img.height;y++)for(let x=0;x<s.img.width;x++){const q=(y*s.img.width+x)*4;if(src[q+3]!==255)continue;const d=((b.y*2+y)*im.width+b.x*2+s.img.width-1-x)*4;for(let k=0;k<3;k++)if(src[q+k]!==all[d+k])return false;count++;}return count>50;},image);assert.ok(pixels,'Отражение должно попасть в PNG');
 await p.click('#flip-y');assert.ok((await p.evaluate(()=>mapEditor.export())).objects[0].flipY);
 await p.selectOption('#object-scale','1.5');assert.equal((await p.evaluate(()=>mapEditor.export())).objects[0].scale,1.5);await p.click('#undo');assert.equal((await p.evaluate(()=>mapEditor.export())).objects[0].scale,1);await p.click('#redo');assert.equal((await p.evaluate(()=>mapEditor.export())).objects[0].scale,1.5);
 // Старое дерево переносим; во время жеста состояние не меняется.
 const original=(await p.evaluate(()=>mapEditor.export())).objects[1],b=await p.evaluate(o=>mapEditor.geometry(o).bounds,original),a=await point(b.x+b.w/2,b.y+b.h/2),z=await p.evaluate(()=>mapEditor.view().zoom);
 await touch('touchStart',a);await touch('touchMove',{x:a.x+3*16*z,y:a.y-2*16*z});assert.deepEqual((await p.evaluate(()=>mapEditor.export())).objects[1],original);assert.match(await p.locator('#object-info').textContent(),/клеток/);await touch('touchEnd');
 const moved=(await p.evaluate(()=>mapEditor.export())).objects[1];assert.equal(moved.x,original.x+3);assert.equal(moved.y,original.y-2);await p.click('#undo');assert.deepEqual((await p.evaluate(()=>mapEditor.export())).objects[1],original);await p.click('#redo');
 // Палитра → карта: перенос рисунка пальцем, подсветка и единственное добавление на отпускании.
 await p.selectOption('#category','prop');await p.selectOption('#item','bench');await p.selectOption('#object-scale','1');const preview=await p.locator('#preview').boundingBox(),target=await point(24*16+8,22*16+8),before=await p.evaluate(()=>mapEditor.export());
 await touch('touchStart',{x:preview.x+preview.width/2,y:preview.y+preview.height/2});await touch('touchMove',target);
 assert.equal((await p.evaluate(()=>mapEditor.export())).objects.length,before.objects.length);assert.match(await p.locator('#object-info').textContent(),/Отпусти.*клеток/);
 await p.screenshot({path:`tools/shots/editor-transform/drag-${width}.png`,scale:'css'});await touch('touchEnd');assert.equal((await p.evaluate(()=>mapEditor.export())).objects.length,before.objects.length+1);
 // Отпускание вне карты / pointercancel не создаёт объект.
 const complete=await p.evaluate(()=>mapEditor.export());await touch('touchStart',{x:preview.x+20,y:preview.y+20});await touch('touchMove',target);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.deepEqual(await p.evaluate(()=>mapEditor.export()),complete);
 async function resize(w,h){await p.click('#files');await p.fill('#map-width',String(w));await p.fill('#map-height',String(h));await p.click('#resize-map');await p.waitForTimeout(80);}
 await resize(48,40);let grown=await p.evaluate(()=>mapEditor.export());assert.equal(grown.w,48);assert.equal(grown.h,40);assert.deepEqual(grown.objects,complete.objects);
 for(let y=0;y<40;y++)for(let x=0;x<48;x++)assert.equal(grown.ground[y*48+x],x<32&&y<32?complete.ground[y*32+x]:0);
 await p.click('#undo');assert.deepEqual(await p.evaluate(()=>mapEditor.export()),complete);await p.click('#redo');assert.deepEqual(await p.evaluate(()=>mapEditor.export()),grown);
 accept=false;await resize(16,16);assert.deepEqual(await p.evaluate(()=>mapEditor.export()),grown);await p.locator('#menu [data-close]').click();accept=true;
 await resize(16,16);assert.ok((await p.evaluate(()=>mapEditor.export())).objects.length<grown.objects.length);await p.click('#undo');assert.deepEqual(await p.evaluate(()=>mapEditor.export()),grown);
 await resize(96,64);assert.equal((await p.evaluate(()=>mapEditor.export())).w,96);
 const view=await p.evaluate(()=>({v:mapEditor.view(),w:document.getElementById('stage').clientWidth,h:document.getElementById('stage').clientHeight}));assert.ok(96*16*view.v.zoom<=view.w&&64*16*view.v.zoom<=view.h,'Вся карта действительно помещается');
 await p.click('#undo');await p.click('#fit');await p.screenshot({path:`tools/shots/editor-transform/after-${width}.png`,scale:'css'});
 const exported=await p.evaluate(()=>mapEditor.export());assert.deepEqual(await p.evaluate(v=>mapEditor.validate(v),exported),exported);await p.waitForTimeout(600);await p.reload();await p.waitForFunction(()=>window.mapEditor);assert.deepEqual(await p.evaluate(()=>mapEditor.export()),exported);
 assert.ok(await p.evaluate(()=>[...document.querySelectorAll('.object-tools button,.object-tools select')].every(b=>b.getBoundingClientRect().width>=44&&b.getBoundingClientRect().height>=44)));
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log(`✔ ${width}: v1→v2, отражённые пиксели PNG, размер, перенос, палитра/сетка, отмена, расширение/обрезка и восстановление`);await context.close();
}assert.deepEqual(errors,[]);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
