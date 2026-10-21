// Реальные пиксели воды: мировая фаза, кромки, тишина при fx=false, неизменность карты.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch(),errors=[];
try{
 const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:8765/');await p.waitForFunction(()=>window.G?.waterArt);
 const r=await p.evaluate(()=>{
  G.game.newState();G.audio.enabled=false;const state=JSON.stringify(G.state),ID=G.tiles.ID,failures=[];
  const map={outdoor:true,get(x,y){if(y===0)return ID.GRASS;if(x===0)return ID.STONE;if(x===7&&y<5)return ID.PLANKS;if(x>4&&y===5)return ID.SAND;return ID.WATER;}};
  function render(reverse=false){const c=G.gfx.canvas(128,128),ctx=c.getContext('2d');
   const cells=Array.from({length:64},(_,i)=>i);if(reverse)cells.reverse();
   for(const i of cells){const x=i%8,y=Math.floor(i/8);if(!G.waterArt.draw(ctx,map,x,y,x*16,y*16,ID)){ctx.fillStyle=map.get(x,y)===ID.PLANKS?'#a08058':'#87956a';ctx.fillRect(x*16,y*16,16,16);}}return c;}
  const c=render(),a=c.getContext('2d').getImageData(0,0,256,256).data,b=render(true).getContext('2d').getImageData(0,0,256,256).data;
  if(a.some((v,i)=>v!==b[i]))failures.push('Зависимость от порядка чанков');
  const empty={outdoor:true,get(){return ID.WATER;}},sea=G.gfx.canvas(64,64),ctx=sea.getContext('2d');
  for(let y=-2;y<2;y++)for(let x=-2;x<2;x++)G.waterArt.draw(ctx,empty,x,y,(x+2)*16,(y+2)*16,ID);
  const px=ctx.getImageData(0,0,128,128).data;let jump=0;
  for(const edge of [32,64,96])for(let j=0;j<128;j++)for(let k=0;k<3;k++){
   jump=Math.max(jump,Math.abs(px[(j*128+edge)*4+k]-px[(j*128+edge-1)*4+k]),Math.abs(px[(edge*128+j)*4+k]-px[((edge-1)*128+j)*4+k]));
  }
  // Контраст короткого штриха — до 6 единиц; отдельно сверяем мировую фазу каждого пикселя.
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
   const expected=G.waterArt.sample([],-32+(x+.5)/2,-32+(y+.5)/2);
   if(expected.some((v,k)=>v!==px[(y*128+x)*4+k]))throw Error('Сдвиг фактуры на границе тайла');
  }
  if(jump>7)failures.push('Шов внутри воды '+jump);
  if(G.waterArt.draw(ctx,{outdoor:false,get(){return ID.WATER;}},0,0,0,0,ID))failures.push('Изменён интерьер');
  if(G.waterArt.draw(ctx,{outdoor:true,get(){return ID.STONE;}},0,0,0,0,ID))failures.push('Изменена суша');
  const shore={outdoor:true,get(x,y){return y<0?ID.GRASS:ID.WATER;}};
  G.waterArt.draw(ctx,shore,0,0,0,0,ID);const near=ctx.getImageData(16,1,1,1).data,deep=ctx.getImageData(16,31,1,1).data;
  if(near[1]<=deep[1]+8||near[0]>deep[0]+24||near[2]<=near[1])failures.push('Нет сдержанного голубого мелководья');
  const natural=[{x:0,y:-16,natural:true}],stone=[{x:0,y:-16,natural:false}];
  for(let y=.25;y<16;y+=.5)for(let x=.25;x<16;x+=.5){
   const a=G.waterArt.sample(natural,x,y),b=G.waterArt.sample(stone,x,y);
   if(a.some((v,i)=>v!==b[i]))throw Error('Переключение палитры у разных берегов');
   if(y>=5&&a.some((v,i)=>v!==G.waterArt.sample([],x,y)[i]))throw Error('Слишком широкий ореол');
  }
  const ripple=G.gfx.canvas(64,64),rc=ripple.getContext('2d');
  const animate=t=>{rc.clearRect(0,0,64,64);for(let y=0;y<4;y++)for(let x=0;x<4;x++)G.waterArt.overlay(rc,x*16,y*16,x,y,t);return rc.getImageData(0,0,128,128).data;};
  G.storage.settings.fx=false;if(animate(7).some(v=>v))failures.push('Рябь при выключенных эффектах');
  G.storage.settings.fx=true;const r0=animate(0),r1=animate(2);
  if(!r0.some((v,i)=>v!==r1[i]))failures.push('Рябь не меняется');
  if(r0.some((v,i)=>i%4===3&&v>67))failures.push('Слишком яркая рябь');
  rc.globalAlpha=.4;G.waterArt.overlay(rc,0,0,4,2,3);if(Math.abs(rc.globalAlpha-.4)>.01)failures.push('Утечка прозрачности');
  if(JSON.stringify(G.state)!==state)failures.push('Изменено сохранение');
  return {failures,jump,mosaic:c.toDataURL()};
 });
 assert.deepEqual(r.failures,[]);assert.deepEqual(errors,[]);
 fs.mkdirSync('tools/shots/water',{recursive:true});fs.writeFileSync('tools/shots/water/corners.png',Buffer.from(r.mosaic.split(',')[1],'base64'));
 console.log('✔ Берег/углы/пирс: одинаковые пиксели при обратном порядке чанков');
 console.log('✔ Мировая фаза, отрицательные координаты, скачок на стыке воды ≤'+r.jump+'/255');
 console.log('✔ Мелководье, ненавязчивая анимация, эффекты выкл., состояние Canvas и сохранение');
 console.log('✔ Суша и интерьерная вода не подменены');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
