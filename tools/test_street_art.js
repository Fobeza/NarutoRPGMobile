// Настоящие пиксели: период мощения, стыки, углы, порядок чанков и архитектурные пороги.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch(),errors=[];
try{
 const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:8765/');await p.waitForFunction(()=>window.G?.streetArt);
 const r=await p.evaluate(()=>{
  G.game.newState();G.audio.enabled=false;const state=JSON.stringify(G.state),ID=G.tiles.ID,failures=[];
  const texture=G.environmentArt.image('ground-street'),a=texture.getContext('2d').getImageData(0,0,128,128).data;
  for(let j=0;j<128;j++)for(let k=0;k<4;k++){
   if(a[(j*128)*4+k]!==a[(j*128+127)*4+k])failures.push('Горизонтальный период');
   if(a[j*4+k]!==a[(127*128+j)*4+k])failures.push('Вертикальный период');
  }
  const rows=[
   'ggggssggdddd','ggggssggdddd','gsssssssgddd','gsggssgsgddd',
   'gsggssgssssss','gsssssssgddd','ggggssgggddd','gssgssgsgddd',
   'gssgssgsgddd','ggggssgggddd','ssssssgggddd','gggggggggddd'];
  const codes={g:ID.GRASS,s:ID.MAINROAD,d:ID.DIRT},map={outdoor:true,get(x,y){return codes[rows[y]?.[x]]??ID.GRASS;}};
  function render(reverse=false,offset=0){
   const c=G.gfx.canvas(192,192),ctx=c.getContext('2d');const cells=Array.from({length:144},(_,i)=>i);if(reverse)cells.reverse();
   const shifted={outdoor:true,get(x,y){return map.get(x-offset,y-offset);}};
   for(const n of cells){const x=n%12,y=Math.floor(n/12);const kind=G.streetArt.category(map.get(x,y),ID);
    ctx.drawImage(G.terrainArt.tile(kind==='earth'?'earth':'grass'),x*16,y*16);
    G.streetArt.draw(ctx,shifted,x+offset,y+offset,x*16,y*16,ID);
   }return c;
  }
  G.streetArt.clear();const normal=render();const b=normal.getContext('2d').getImageData(0,0,384,384).data;
  G.streetArt.clear();const reverse=render(true).getContext('2d').getImageData(0,0,384,384).data;
  const shifted=render(false,-4).getContext('2d').getImageData(0,0,384,384).data;
  for(let i=0;i<b.length;i++){if(b[i]!==reverse[i]||b[i]!==shifted[i]){failures.push('Фаза/порядок чанков/отрицательные координаты');break;}}
  let worst=0;
  for(const natural of [ID.GRASS,ID.DIRT,ID.PATH,ID.DARKGRASS,ID.MOSS])for(const vertical of [true,false]){
   const flat={outdoor:true,get(x,y){return (vertical?x:y)<4?ID.MAINROAD:natural;}};
   const c=G.gfx.canvas(32,32),ctx=c.getContext('2d');
   for(let y=0;y<2;y++)for(let x=0;x<2;x++)G.streetArt.draw(ctx,flat,x+3,y+3,x*16,y*16,ID);
   const d=ctx.getImageData(0,0,64,64).data;
   for(let j=0;j<64;j++)for(let k=0;k<3;k++){
    const v=vertical?Math.abs(d[(j*64+31)*4+k]-d[(j*64+32)*4+k]):Math.abs(d[(31*64+j)*4+k]-d[(32*64+j)*4+k]);worst=Math.max(worst,v);
   }
  }
  if(worst>16)failures.push('Резкий цветовой шов: '+worst);
  const c=G.gfx.canvas(16,16),ctx=c.getContext('2d');
  for(const id of [ID.FLOOR,ID.TATAMI,ID.PLANKS,ID.WATER,ID.SAND,ID.CLIFF,ID.DARKSTONE,ID.BRICK]){
   if(G.streetArt.draw(ctx,{outdoor:true,get(x,y){return x===0&&y===0?id:ID.MAINROAD;}},0,0,0,0,ID))failures.push('Подменён чужой материал '+id);
  }
  if(G.streetArt.draw(ctx,{outdoor:false,get(){return ID.STONE;}},0,0,0,0,ID))failures.push('Подменён интерьер');
  if(JSON.stringify(G.state)!==state)failures.push('Изменено состояние');
  return {failures,worst,mosaic:normal.toDataURL()};
 });
 assert.deepEqual(r.failures,[]);assert.deepEqual(errors,[]);
 fs.mkdirSync('tools/shots/stone-streets',{recursive:true});fs.writeFileSync('tools/shots/stone-streets/seams.png',Buffer.from(r.mosaic.split(',')[1],'base64'));
 console.log('✔ Период 128×128: противоположные края идентичны');
 console.log('✔ Прямые, повороты, Т/крест, площадь, внутренние/внешние углы; порядок чанков и отрицательные координаты');
 console.log('✔ Переходы к пяти природным материалам: скачок между краями ≤'+r.worst+'/255');
 console.log('✔ Интерьеры, вода, дерево и прочие материалы не подменены; состояние неизменно');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
