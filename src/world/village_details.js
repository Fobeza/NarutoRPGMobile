// Бытовые детали у фасадов: только свободные места, без новых коллизий.
G.villageDetails = (() => {
  const home = [
    ['flowerpot', 'Горшок с цветами. Земля ещё влажная: хозяева поливали их утром.'],
    ['basket', 'Корзина с яблоками. Сверху лежит записка: «Для соседей».'],
    ['pots', 'Глиняные горшки сушатся после мытья. Каждый немного отличается от остальных.'],
    ['sacks', 'Мешочки риса для домашней кухни. На узелках завязаны цветные нитки.'],
  ];
  const shops = {
    ichiraku: [['basket', 'Свежие овощи для бульона. Теучи забрал их на рынке ещё до рассвета.'], ['crate', 'Ящик с мисками. На крышке написано: «Осторожно, посуда».']],
    dango: [['basket', 'Продукты для сладких данго. От лавки пахнет поджаренным тестом.']],
    teahouse: [['pots', 'Кувшины с водой для чая. Рядом остались следы от мокрых чашек.']],
    pharmacy: [['herb_bundle', 'Связки лекарственных трав перевязаны нитками разных цветов.']],
    flowers: [['flowerpot', 'Молодые цветы ждут новых хозяев. На горшке нарисовано маленькое солнце.']],
    books: [['bookpile', 'Книги для обмена. Между страницами одной из них засох кленовый лист.']],
    library: [['bookpile', 'Возвращённые учебники. Кто-то оставил закладку на главе о контроле чакры.']],
    academy: [['bookpile', 'Чьи-то конспекты с урока. На полях нарисованы кунаи и смешной Ирука.']],
    weapons: [['crate', 'Ящик тренировочных мишеней. Все кунаи уже убрали в мастерскую.']],
    market: [['basket', 'Последние яблоки с утреннего привоза. Самые румяные оставили сверху.'], ['sacks', 'Мешки с рисом. Счёт за доставку прижат маленьким камешком.']],
    inuzuka_shop: [['basket', 'Корзинка с игрушками для нинкенов. Мячик уже основательно погрызен.']],
  };
  function safe(m, r) {
    if(r.x<16||r.y<16||r.x+r.w>(m.w-1)*16||r.y+r.h>(m.h-1)*16)return false;
    // Проверяем весь рисунок, а не только точку опоры предмета.
    for(let y=Math.floor(r.y/16);y<=Math.floor((r.y+r.h-1)/16);y++)for(let x=Math.floor(r.x/16);x<=Math.floor((r.x+r.w-1)/16);x++){
      if(m.solidTile(x,y)||[G.tiles.ID.MAINROAD,G.tiles.ID.PATH,G.tiles.ID.PLANKS].includes(m.get(x,y)))return false;   // PLANKS — это и мостки над водой
    }
    if(m.warps.some(w=>G.util.rectsOverlap(r,{x:w.rect.x-24,y:w.rect.y-16,w:w.rect.w+48,h:w.rect.h+40})))return false;
    if(m.npcs.some(n=>G.util.rectsOverlap(r,{x:n.x-14,y:n.y-20,w:28,h:28})))return false;
    return !m.objects.some(o=>G.util.rectsOverlap(r,{x:o.x+o.ox-2,y:o.y+o.oy-2,w:o.w+4,h:o.h+4}));
  }
  // Мягкая проверка для декора: точка в пределах карты, на проходимой земле, без воды и построек
  // и без наложения на уже стоящие предметы. Дорогу не запрещаем — гирлянда висит над улицей,
  // коврик лежит у порога, а столб с объявлениями стоит на обочине.
  function freeSpot(m, r) {
    if (r.x < 8 || r.y < 8 || r.x + r.w > (m.w - 1) * 16 || r.y + r.h > (m.h - 1) * 16) return false;
    for (let y = Math.floor(r.y / 16); y <= Math.floor((r.y + r.h - 1) / 16); y++)
      for (let x = Math.floor(r.x / 16); x <= Math.floor((r.x + r.w - 1) / 16); x++) {
        if (m.solidTile(x, y) || m.get(x, y) === G.tiles.ID.WATER || m.get(x, y) === G.tiles.ID.VOID) return false;
      }
    return !m.objects.some((o) => o.layer !== 'floor' && G.util.rectsOverlap(r, { x: o.x + o.ox - 1, y: o.y + o.oy - 1, w: o.w + 2, h: o.h + 2 }));
  }

  function populate(m) {
    if(m._villageDetails||m.id!=='konoha')return;
    m._villageDetails=true;
    let count=0;
    for(const b of m.buildings){
      if(count>=100)break;
      const pool=shops[b.tplId]||(b.tplDef.cat==='house'?home:null);
      if(!pool||!b.door)continue;
      const seed=Math.floor(G.util.hash2(b.tx,b.ty,301)*1000);
      const [kind,text]=pool[seed%pool.length],spr=G.tiles.object(kind);
      const left=b.x+6,right=b.x+b.tw*16-6,bottom=b.y+b.th*16;
      const points=[[left,bottom+18],[right,bottom+18],[left-14,bottom-4],[right+14,bottom-4]];
      if(seed%2)points.reverse();
      for(const [x,y] of points){
        const r={x:x+spr.ox,y:y+spr.oy,w:spr.w,h:spr.h};
        if(!safe(m,r))continue;
        m.addObject(kind,x,y,{box:null,talk:[text],_villageDetail:true});count++;break;
      }
    }
  }
  // Уличный декор: коврики и сандалии у дверей, навесы над входами лавок, гирлянды фонариков
  // над главной улицей, столбы с объявлениями, кошки на солнце и воробьи на газонах.
  // Всё без коллизий — проходимость карты не меняется.
  function decor(m){
    if(m._villageDecor||m.id!=='konoha')return;
    m._villageDecor=true;
    const T=16,ID=G.tiles.ID;
    const put=(kind,x,y,extra)=>m.addObject(kind,x,y,Object.assign({box:null,_decor:true},extra));
    let mats=0,awnings=0,garlands=0,posts=0,cats=0,birds=0,gaitas=0;
    for(const b of m.buildings){
      if(!b.door)continue;
      const dx=b.door.tx*T+8, front=(b.door.ty+1)*T, seed=Math.floor(G.util.hash2(b.tx,b.ty,311)*1000);
      // коврик у порога
      if(mats<70){
        put('doormat',dx,front+T-6,{layer:'floor',talk:['Плетёный коврик у входа. Края вытерты до соломы.']});mats++;
      }
      // сандалии рядом с ковриком
      if(seed%3===0){
        // Сандалии лежат на той же клетке перед дверью, что и коврик, только сбоку.
        for(const off of [15,-15]){
          const sx=dx+(seed%2?off:-off);
          if(!freeSpot(m,{x:sx-9,y:front+2,w:18,h:14}))continue;
          if(gaitas<32){put('geta',sx,front+T-2,{layer:'floor',talk:['Деревянные гэта. Хозяин оставил их у порога.']});gaitas++;}
          break;
        }
      }
      // навес над входом в лавку
      const shop=G.SHOPS[b.tplId];
      if(shop&&awnings<30){
        const o=put('awning',dx,b.door.ty*T-2);
        if(o)o.sortY=b.y+b.th*T+3;          // иначе фасад рисуется поверх навеса
        awnings++;
      }
      // столб с объявлениями у людных мест
      if(['shop','food','official','landmark'].includes(b.tplDef.cat)&&posts<14&&seed%3!==1){
        const py=b.door.ty*T+T;
        for(const off of [34,-34,52,-52]){
          const px2=b.door.tx*T+(seed%2?off:-off);
          if(!freeSpot(m,{x:px2-9,y:py-30,w:18,h:30}))continue;
          put('noticepost',px2,py,{talk:['Столб с объявлениями: набор в команду, пропала кошка, уроки ирьёнина.']});
          posts++;break;
        }
      }
    }
    // Гирлянды: только над дорогой, где слева и справа тоже дорога, а впереди есть проход.
    const roady=(tx,ty)=>m.get(tx,ty)===ID.MAINROAD||m.get(tx,ty)===ID.PLAZA||m.get(tx,ty)===ID.STONE;
    for(let ty=2;ty<m.h-2&&garlands<26;ty++)for(let tx=2;tx<m.w-2&&garlands<26;tx++){
      if(!roady(tx,ty)||!(roady(tx-1,ty)||roady(tx+1,ty)))continue;
      if(m.solidTile(tx,ty-1)||m.solidTile(tx,ty+1))continue;
      if(G.util.hash2(tx,ty,321)>0.05)continue;              // редко: гирлянда — примета, а не забор
      if(!freeSpot(m,{x:tx*T-16,y:ty*T-16,w:48,h:32}))continue;
      put('garland',tx*T+8,ty*T+16,{talk:['Гирлянда бумажных фонариков. Их зажигают к праздникам.']});garlands++;
    }
    // Кошки и воробьи на газонах — редкие живые точки.
    for(let ty=2;ty<m.h-2;ty++)for(let tx=2;tx<m.w-2;tx++){
      if(!G.tiles.GRASSY.has(m.get(tx,ty)))continue;
      const h=G.util.hash2(tx,ty,331);
      if(h>0.013)continue;
      const x=tx*T+8,y=ty*T+14;
      if(h<0.006){
        if(cats>=8||!freeSpot(m,{x:x-9,y:y-11,w:18,h:12}))continue;
        put('cat_sun',x,y,{talk:['Кошка дремлет на прогретом камне. Один глаз приоткрыт.']});cats++;
      }else{
        if(birds>=14||!freeSpot(m,{x:x-6,y:y-9,w:12,h:10}))continue;
        put('bird',x,y,{talk:['Воробей что-то клюёт в траве.']});birds++;
      }
    }
  }
  return {populate,decor,safe,freeSpot};
})();
