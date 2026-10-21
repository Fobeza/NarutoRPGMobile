// Изолированный редактор: только собственный черновик, без G.game и игровых сохранений.
(()=>{
'use strict';
G.storage={settings:{fx:false}};
const $=id=>document.getElementById(id),KEY='naruto-phone-map-v1',FORMAT='naruto-phone-map',MAX_OBJECTS=1500;
const grounds=[[0,'Трава'],[3,'Тропинка'],[9,'Земля'],[17,'Каменная улица'],[28,'Площадь'],[4,'Вода'],[5,'Песок'],[6,'Доски'],[25,'Гравий'],[8,'Тёмная трава']];
const props=[['tree','Дерево'],['pine','Хвойное дерево'],['sakura','Сакура'],['maple','Клён'],['bush','Куст'],['rock','Камень'],['rock2','Мшистый камень'],['bench','Скамейка'],['lamp','Фонарь'],['fence','Забор'],['well','Колодец'],['barrel','Бочка'],['crate','Ящик'],['mailbox','Почта'],['sign','Указатель'],['village_board','Доска объявлений'],['fl_white','Белые цветы'],['fl_yellow','Жёлтые цветы'],['fl_red','Красные цветы'],['fl_blue','Синие цветы'],['fl_pink','Розовые цветы']];
const houses=Object.entries(G.HOUSE_ART.art).map(([id,a],i)=>[id,`${G.BUILDINGS[a.tpl]?.name||'Дом '+(i+1)} · ${a.w}×${a.h}`]);
const palettes={ground:grounds,prop:props,building:houses};
let model,undo=[],redo=[],tool='paint',category='ground',selected='0',zoom=2,ox=0,oy=0,ground=null,dirty=true,pending=null,queued=false;
let stroke=null,lastCell=null,pointers=new Map(),gesture=null,saveTimer;
const cv=$('view'),ctx=cv.getContext('2d'),stage=$('stage');
const clone=v=>JSON.parse(JSON.stringify(v));
const fresh=n=>({format:FORMAT,version:1,name:'Моя деревня',w:n,h:n,ground:Array(n*n).fill(0),objects:[]});
function note(s){$('notice').textContent=s;}
function valid(v){
 if(!v||v.format!==FORMAT||v.version!==1)throw Error('Нужен JSON этого редактора, версия 1.');
 if(!Number.isInteger(v.w)||!Number.isInteger(v.h)||v.w<16||v.h<16||v.w>64||v.h>64)throw Error('Размер карты: от 16 до 64 клеток.');
 if(!Array.isArray(v.ground)||v.ground.length!==v.w*v.h||v.ground.some(id=>!grounds.some(g=>g[0]===id)))throw Error('Повреждены покрытия карты.');
 if(!Array.isArray(v.objects)||v.objects.length>MAX_OBJECTS)throw Error('Слишком много объектов.');
 const clean={format:FORMAT,version:1,name:typeof v.name==='string'?v.name.slice(0,40):'Моя деревня',w:v.w,h:v.h,ground:[...v.ground],objects:[]};
 for(const o of v.objects){
  if(!o||!['prop','building'].includes(o.kind)||!palettes[o.kind].some(p=>p[0]===o.id)||!Number.isInteger(o.x)||!Number.isInteger(o.y))throw Error('Неизвестный объект.');
  const item={kind:o.kind,id:o.id,x:o.x,y:o.y};if(!fits(item,clean))throw Error('Объект выходит за карту.');clean.objects.push(item);
 }
 return clean;
}
function sprite(o){return o.kind==='building'?G.houseArt.sprite(o.id):G.tiles.object(o.id);}
function bounds(o){const s=sprite(o),a=o.kind==='building'?G.houseArt.spec(o.id):null;
 return {x:o.x*16+(a?0:8)+s.ox,y:o.y*16+(a?0:16)+s.oy,w:s.w||s.img.lw,h:s.h||s.img.lh};}
function fits(o,m=model){const b=bounds(o);return o.x>=0&&o.y>=0&&o.x<m.w&&o.y<m.h&&b.x>=0&&b.y>=0&&b.x+b.w<=m.w*16&&b.y+b.h<=m.h*16;}
function snapshot(){return clone(model);}
function history(before,full=false){if(JSON.stringify(before)===JSON.stringify(model))return;undo.push(before);if(undo.length>50)undo.shift();redo=[];changed(full);}
function changed(full=true){if(full)dirty=true;render();persist();$('name').value=model.name;}
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(model));note('Черновик сохранён в браузере. Скачай JSON для резервной копии.');}catch{note('Браузер не сохранил черновик. Скачай JSON через «Файл».');}},500);}
function render(){if(!queued){queued=true;requestAnimationFrame(draw);}}
function draw(){queued=false;
 if(dirty||pending){
  if(!ground||ground.lw!==model.w*16||ground.lh!==model.h*16)ground=G.gfx.canvas(model.w*16,model.h*16);
  const c=ground.getContext('2d'),r=dirty?{x:0,y:0,X:model.w-1,Y:model.h-1}:pending;
  c.save();c.beginPath();c.rect(r.x*16,r.y*16,(r.X-r.x+1)*16,(r.Y-r.y+1)*16);c.clip();c.clearRect(r.x*16,r.y*16,(r.X-r.x+1)*16,(r.Y-r.y+1)*16);
  const m={outdoor:true,get(x,y){return x<0||y<0||x>=model.w||y>=model.h?16:model.ground[y*model.w+x];}};
  for(let y=Math.max(0,r.y-1);y<=Math.min(model.h-1,r.Y+1);y++)for(let x=Math.max(0,r.x-1);x<=Math.min(model.w-1,r.X+1);x++)G.tiles.renderTile(c,m,x,y,x*16,y*16);
  c.restore();dirty=false;pending=null;
 }
 const r=stage.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
 if(cv.width!==Math.round(r.width*dpr)||cv.height!==Math.round(r.height*dpr)){cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,r.width,r.height);
 ctx.save();ctx.translate(ox,oy);ctx.scale(zoom,zoom);ctx.drawImage(ground,0,0);
 if(zoom>=1.2){ctx.strokeStyle='#112c2330';ctx.lineWidth=.5/zoom;ctx.beginPath();for(let x=0;x<=model.w;x++){ctx.moveTo(x*16,0);ctx.lineTo(x*16,model.h*16);}for(let y=0;y<=model.h;y++){ctx.moveTo(0,y*16);ctx.lineTo(model.w*16,y*16);}ctx.stroke();}
 const sorted=[...model.objects].sort((a,b)=>{const aa=bounds(a),bb=bounds(b);return aa.y+aa.h-bb.y-bb.h;});
 for(const o of sorted){const s=sprite(o),b=bounds(o);ctx.drawImage(s.img,b.x,b.y);}
 ctx.restore();$('coords').textContent=`${model.w} × ${model.h} · ${Math.round(zoom*100)}%`;
 $('undo').disabled=!undo.length;$('redo').disabled=!redo.length;
}
function fit(){const r=stage.getBoundingClientRect();zoom=Math.max(.25,Math.min(3,(r.width-24)/(model.w*16),(r.height-24)/(model.h*16)));ox=(r.width-model.w*16*zoom)/2;oy=(r.height-model.h*16*zoom)/2;render();}
function scale(k,cx=stage.clientWidth/2,cy=stage.clientHeight/2){const z=Math.max(.25,Math.min(5,zoom*k));ox=cx-(cx-ox)*z/zoom;oy=cy-(cy-oy)*z/zoom;zoom=z;render();}
function mode(m){tool=m;document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===m));note(m==='pan'?'Перемещай карту пальцем.':m==='erase'?'Коснись объекта, чтобы удалить. Пустая клетка станет травой.':'Выбери элемент внизу и рисуй на карте.');}
function palette(){category=$('category').value;const list=palettes[category];$('item').replaceChildren(...list.map(([id,name])=>{const o=document.createElement('option');o.value=id;o.textContent=name;return o;}));selected=String(list[0][0]);preview();mode('paint');}
function preview(){const p=$('preview'),c=p.getContext('2d');c.clearRect(0,0,116,116);c.imageSmoothingEnabled=false;
 let image,w,h;if(category==='ground'){const t=G.gfx.canvas(16,16),m={outdoor:true,get(){return +selected;}};G.tiles.renderTile(t.getContext('2d'),m,0,0,0,0);image=t;w=h=16;}else{const s=sprite({kind:category,id:selected});image=s.img;w=s.w||image.lw;h=s.h||image.lh;}
 const k=Math.min(100/w,100/h);c.drawImage(image,(116-w*k)/2,(116-h*k)/2,w*k,h*k);
}
function local(e){const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function cell(p){return{x:Math.floor((p.x-ox)/zoom/16),y:Math.floor((p.y-oy)/zoom/16)};}
function invalidate(x,y){
 const r={x:Math.max(0,x-2),y:Math.max(0,y-2),X:Math.min(model.w-1,x+2),Y:Math.min(model.h-1,y+2)};
 if(pending){r.x=Math.min(r.x,pending.x);r.y=Math.min(r.y,pending.y);r.X=Math.max(r.X,pending.X);r.Y=Math.max(r.Y,pending.Y);}pending=r;
}
function apply(x,y){if(x<0||y<0||x>=model.w||y>=model.h)return;
 if(tool==='erase'){
  const px=x*16+8,py=y*16+8;let found=-1;
  for(let i=model.objects.length-1;i>=0;i--){const b=bounds(model.objects[i]);if(px>=b.x&&px<b.x+b.w&&py>=b.y&&py<b.y+b.h){found=i;break;}}
  if(found>=0)model.objects.splice(found,1);else {model.ground[y*model.w+x]=0;invalidate(x,y);}
 }else if(category==='ground'){model.ground[y*model.w+x]=+selected;invalidate(x,y);}
 else{
  const o={kind:category,id:selected,x,y};if(!fits(o)){note('Элемент не помещается: отступи от края карты.');return;}
  if(model.objects.length>=MAX_OBJECTS){note('Лимит: 1500 объектов.');return;}
  if(!model.objects.some(a=>a.x===x&&a.y===y&&a.kind===o.kind&&a.id===o.id))model.objects.push(o);
 }
 render();
}
function line(a,b){let x=a.x,y=a.y;const dx=Math.abs(b.x-x),sx=x<b.x?1:-1,dy=-Math.abs(b.y-y),sy=y<b.y?1:-1;let err=dx+dy;
 // Координаты ограничены экраном; всё равно ограничиваем чрезмерно длинные жесты.
 for(let i=0;i<256;i++){apply(x,y);if(x===b.x&&y===b.y)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
}
function endStroke(){if(stroke){history(stroke);stroke=null;}lastCell=null;}
function pinch(){const [a,b]=[...pointers.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};}
cv.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();cv.setPointerCapture(e.pointerId);const p=local(e);pointers.set(e.pointerId,p);
 if(pointers.size===2){if(stroke){model=stroke;stroke=null;dirty=true;render();persist();}lastCell=null;gesture=pinch();return;}
 if(pointers.size!==1)return;
 if(tool!=='pan'){stroke=snapshot();lastCell=cell(p);apply(lastCell.x,lastCell.y);}
});
cv.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId),p=local(e);pointers.set(e.pointerId,p);
 if(pointers.size>=2){const g=pinch();if(gesture){ox+=g.x-gesture.x;oy+=g.y-gesture.y;scale(g.d/gesture.d,g.x,g.y);}gesture=g;return;}
 if(gesture)return;
 if(tool==='pan'){ox+=p.x-old.x;oy+=p.y-old.y;render();}
 else if(stroke&&(category==='ground'||tool==='erase')){const next=cell(p);if(next.x!==lastCell.x||next.y!==lastCell.y){line(lastCell,next);lastCell=next;}}
});
function release(e){if(!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);if(!pointers.size){gesture=null;endStroke();}render();}
cv.addEventListener('pointerup',release);cv.addEventListener('pointercancel',release);cv.addEventListener('lostpointercapture',release);
cv.addEventListener('wheel',e=>{e.preventDefault();const p=local(e);scale(e.deltaY<0?1.15:1/1.15,p.x,p.y);},{passive:false});
function travel(from,to){endStroke();if(!from.length)return;to.push(snapshot());model=from.pop();changed();}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function filename(ext){return (model.name.replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,40)||'map')+'.'+ext;}
$('files').onclick=()=>{endStroke();$('name').value=model.name;$('menu').showModal();};$('help').onclick=()=>$('guide').showModal();
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{endStroke();mode(b.dataset.tool);});
$('category').onchange=palette;$('item').onchange=()=>{selected=$('item').value;preview();};
$('undo').onclick=()=>travel(undo,redo);$('redo').onclick=()=>travel(redo,undo);$('in').onclick=()=>scale(1.3);$('out').onclick=()=>scale(1/1.3);$('fit').onclick=fit;
$('name').onchange=()=>{const before=snapshot();model.name=$('name').value.trim().slice(0,40)||'Моя деревня';history(before);};
$('save').onclick=()=>{download(new Blob([JSON.stringify(model,null,2)],{type:'application/json'}),filename('json'));note('JSON подготовлен. Проверь загрузки браузера.');};
$('load').onclick=()=>$('file').click();
$('file').onchange=async()=>{const f=$('file').files[0];$('file').value='';if(!f)return;try{if(f.size>4*1024*1024)throw Error('Файл больше 4 МБ.');const next=valid(JSON.parse(await f.text()));if(!confirm('Заменить текущую карту? Её можно будет вернуть кнопкой отмены.'))return;const before=snapshot();model=next;history(before,true);$('menu').close();fit();}catch(e){note('Не удалось открыть: '+e.message);alert('Не удалось открыть: '+e.message);}};
$('new').onclick=()=>{if(!confirm('Создать пустую карту? Текущую можно вернуть кнопкой отмены.'))return;const before=snapshot();model=fresh(+$('size').value);history(before,true);$('menu').close();fit();};
$('png').onclick=()=>{draw();const out=G.gfx.canvas(model.w*16,model.h*16),c=out.getContext('2d');c.drawImage(ground,0,0);for(const o of [...model.objects].sort((a,b)=>{const aa=bounds(a),bb=bounds(b);return aa.y+aa.h-bb.y-bb.h;})){const s=sprite(o),b=bounds(o);c.drawImage(s.img,b.x,b.y);}out.toBlob(b=>{if(b)download(b,filename('png'));else note('Не удалось создать PNG.');});};
$('download').onclick=()=>{const copy=document.documentElement.cloneNode(true);copy.querySelectorAll('dialog').forEach(d=>d.removeAttribute('open'));download(new Blob(['<!doctype html>\n'+copy.outerHTML],{type:'text/html'}),'map-editor.html');};
window.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();travel(e.shiftKey?redo:undo,e.shiftKey?undo:redo);}});
window.addEventListener('resize',render);document.addEventListener('visibilitychange',()=>{if(document.hidden){endStroke();try{localStorage.setItem(KEY,JSON.stringify(model));}catch{}}});
let warning='';try{const saved=localStorage.getItem(KEY);model=saved?valid(JSON.parse(saved)):fresh(32);}catch{model=fresh(32);warning='Черновик не восстановлен. Открой сохранённый JSON.';}
palette();fit();$('name').value=model.name;if(warning)note(warning);
// Только состояние редактора; удобно для регрессий и диагностики импортируемого формата.
window.mapEditor={export:()=>clone(model),validate:valid};
})();
