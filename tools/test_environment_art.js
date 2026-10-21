// Подключённые картинки: геометрия исходной Конохи, размеры, альфа, направления тропинок и офлайн.
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),{chromium}=require('playwright');
const h=require('./node/harness.js');h.seed();
const m=h.G.world.get('konoha');
const geometry={ground:[...m.ground],block:[...m.block],objects:m.objects.map(o=>({kind:o.kind,x:o.x,y:o.y,w:o.w,h:o.h,ox:o.ox,oy:o.oy,box:o.box,sortY:o.sortY}))};
// Снято на плотной Конохе (раскладка 3, seed 2027) с фонарями переулков и аллеей у реки. Хеш не содержит картинок: меняется только
// вместе с раскладкой или генератором карты — тогда снимите заново и отметьте причину в CHANGELOG.
assert.equal(crypto.createHash('sha256').update(JSON.stringify(geometry)).digest('hex'),'9b414477dc6abb9b9ee3084f210a8dd816dafd539564208def84de51993b58ce');
console.log('✔ Клетки, размеры, опоры, сортировка и коллизии всей Конохи совпали с исходной сборкой');
(async()=>{const browser=await chromium.launch(),errors=[],requests=[];
try{
 const context=await browser.newContext({viewport:{width:393,height:759},deviceScaleFactor:3,serviceWorkers:'block'});
 const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push(r.url()));
 await p.goto(process.env.GAME_URL||'http://127.0.0.1:8765/');await p.waitForFunction(()=>window.G?.terrainArt);
 await context.setOffline(true);
 const result=await p.evaluate(()=>{
  G.game.newState();G.audio.enabled=false;
  const before=JSON.stringify(G.state),failures=[],seen=new Set(),sizes={};
  for(const [key,assets]of Object.entries(G.environmentArt.bindings))for(let i=0;i<assets.length;i++){
   const s=G.tiles.object(key,(i+.1)/assets.length),c=s.img,px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let count=0,last=-1;for(let k=3;k<px.length;k+=4)if(px[k]>30){count++;last=Math.floor((k/4)/c.width);}
   if(count<8||count===c.width*c.height||last<c.height-4)failures.push(key+': пустой/непрозрачный/оторван от земли');
   if(s.art!==assets[i])failures.push(key+': неверный вариант');
   if(c.width!==s.w*2||c.height!==s.h*2)failures.push(key+': масштаб HI');
   sizes[key]=[s.w,s.h];seen.add(s.art);
  }
  // Неизменные маленькие холсты: ящик меньше героя, почтовый ящик не дом.
  if(sizes.mailbox.join()!=[8,18].join()||sizes.crate.join()!=[14,14].join())failures.push('Размеры маленьких предметов');
  for(const [name,a]of Object.entries(G.ENVIRONMENT_ART.sprites)){
   if(atob(a.pixels).length!==a.w*a.h)failures.push(name+': повреждены пиксели');
   const img=G.environmentArt.image(name);if(!img)failures.push(name+': не декодирован');
  }
  const ID=G.tiles.ID,dirs={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
  for(const mask of ['N','E','S','W','NS','EW','NW','NE','ES','SW']){
   const cells=new Set(['3,3']);for(const side of mask){const [dx,dy]=dirs[side];cells.add([3+dx,3+dy].join());}
   const map={outdoor:true,get(x,y){return cells.has([x,y].join())?ID.PATH:ID.GRASS;}};
   const selected=G.terrainArt.shape(map,3,3,ID,G.tiles.GRASSY);
   if(!selected){failures.push(mask+': не найден рисунок');continue;}
   const c=G.terrainArt.tile(...selected),ctx=c.getContext('2d');
   for(const [side,[x,y]]of Object.entries({N:[16,0],E:[31,16],S:[16,31],W:[0,16]})){
    const col=ctx.getImageData(x,y,1,1).data,brown=col[0]>col[1]+10;
    if(brown!==mask.includes(side))failures.push(mask+': неверный выход '+side);
   }
  }
  const wide={outdoor:true,get(){return ID.PATH;}};
  if(G.terrainArt.shape(wide,3,3,ID,G.tiles.GRASSY)!==null)failures.push('Широкая дорога сужена');
  if(G.terrainArt.shape({outdoor:false,get(){return ID.PATH;}},3,3,ID,G.tiles.GRASSY)!==null)failures.push('Тропинка внутри здания');
  if(JSON.stringify(G.state)!==before)failures.push('Отрисовка меняет сохранение');
  return {failures,count:seen.size,sizes};
 });
 assert.deepEqual(result.failures,[]);assert.equal(result.count,30);
 assert.ok(!requests.some(url=>/art\/(environment|terrain)\//.test(url)),'Ассеты должны быть встроены, без сетевых запросов');
 assert.deepEqual(errors,[]);
 console.log('✔ Все 30 спрайтов декодированы офлайн; прозрачность, опоры и игровые размеры сохранены');
 console.log('✔ 10 направлений тропинок, широкие дороги, интерьер и чистота состояния');
 assert.ok(fs.statSync('src/gfx/environment_art_data.js').size<400*1024,'Бюджет встроенной графики');
 console.log('✔ Встроенная графика <400 КиБ, не требует загрузки мастер-файлов');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
